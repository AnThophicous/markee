import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { storage } from '@/storage/mmkv';

/**
 * Registro de quedas do app.
 *
 * Existe porque "o app fecha sozinho às vezes" é impossível de consertar sem
 * saber ONDE. O aviso do Android não diz nada, e o log do sistema não é
 * acessível de fora do app. Então o próprio app anota o que aconteceu antes de
 * morrer, e mostra depois.
 *
 * Grava no MMKV de propósito: ele é síncrono. Um armazenamento assíncrono não
 * terminaria de escrever — o processo morre no meio. É essa característica que
 * faz o registro sobreviver justamente ao caso que interessa.
 *
 * Regra que vale para o arquivo inteiro: **nada aqui pode lançar**. Um relator
 * de quedas que derruba o app transforma um erro em dois e apaga a pista do
 * primeiro. Por isso cada passo está dentro de try/catch, inclusive a leitura
 * do que já estava salvo.
 */

const CHAVE = 'markee.crashes';
const CHAVE_QUEDA_ANTERIOR = 'markee.crashes.caiuNaUltimaVez';

/** Só os mais recentes: o objetivo é diagnosticar, não guardar histórico. */
const MAXIMO = 15;

export type CrashReport = {
  /** ISO 8601, para ordenar e mostrar. */
  em: string;
  /** Verdadeiro quando o app morreu; falso quando ele seguiu vivo apesar do erro. */
  fatal: boolean;
  nome: string;
  mensagem: string;
  pilha: string;
  /** Tela em que a pessoa estava. É o campo que mais economiza tempo. */
  rota: string;
  versao: string;
  sistema: string;
};

/**
 * A rota é guardada num módulo, e não em estado do React, porque quem lê é o
 * handler global — que roda fora da árvore de componentes, muitas vezes depois
 * dela já ter sido desmontada.
 */
let rotaAtual = '(início)';

export function registrarRota(rota: string): void {
  if (rota) rotaAtual = rota;
}

function lerLista(): CrashReport[] {
  try {
    const cru = storage.getString(CHAVE);
    if (!cru) return [];
    const lista = JSON.parse(cru);
    return Array.isArray(lista) ? (lista as CrashReport[]) : [];
  } catch {
    // Registro corrompido não pode impedir de registrar o próximo.
    return [];
  }
}

export function listarQuedas(): CrashReport[] {
  return lerLista();
}

export function limparQuedas(): void {
  try {
    storage.remove(CHAVE);
    storage.remove(CHAVE_QUEDA_ANTERIOR);
  } catch {
    // Sem ação: limpar é conveniência, não pode quebrar a tela.
  }
}

/**
 * Verdadeiro quando a sessão anterior terminou em queda. Serve para o app
 * avisar por conta própria, em vez de esperar a pessoa procurar o registro.
 * Ler já apaga a marca, para o aviso não reaparecer para sempre.
 */
export function caiuNaSessaoAnterior(): boolean {
  try {
    const caiu = storage.getString(CHAVE_QUEDA_ANTERIOR) === '1';
    if (caiu) storage.remove(CHAVE_QUEDA_ANTERIOR);
    return caiu;
  } catch {
    return false;
  }
}

export function anotarQueda(erro: unknown, fatal: boolean): void {
  try {
    const e = erro instanceof Error ? erro : new Error(String(erro));

    const relato: CrashReport = {
      em: new Date().toISOString(),
      fatal,
      nome: e.name || 'Error',
      mensagem: e.message || String(erro),
      // A pilha é o que aponta o arquivo. Cortada porque em release ela vem
      // com o pacote inteiro e o resto do registro não caberia.
      pilha: (e.stack ?? '').split('\n').slice(0, 24).join('\n'),
      rota: rotaAtual,
      versao: Constants.expoConfig?.version ?? '?',
      sistema: `${Platform.OS} ${String(Platform.Version)}`,
    };

    const lista = [relato, ...lerLista()].slice(0, MAXIMO);
    storage.set(CHAVE, JSON.stringify(lista));

    if (fatal) storage.set(CHAVE_QUEDA_ANTERIOR, '1');
  } catch {
    // Falhar aqui é aceitável; derrubar o app por causa disso não é.
  }
}

let instalado = false;

/**
 * Liga a captura. Chamar uma vez, o mais cedo possível — erros que acontecem
 * antes disto não têm como ser vistos.
 */
export function instalarRelatorDeQuedas(): void {
  if (instalado) return;
  instalado = true;

  try {
    // ErrorUtils é um global do React Native, não do JavaScript. O acesso é
    // defensivo porque ele não existe em teste nem em ambiente de nó.
    const utils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
    if (utils?.setGlobalHandler) {
      const anterior = utils.getGlobalHandler?.();

      utils.setGlobalHandler((erro: unknown, fatal?: boolean) => {
        anotarQueda(erro, fatal === true);
        // Encadeia no handler original em vez de substituí-lo: é ele que mostra
        // a tela vermelha em desenvolvimento. Engolir o erro aqui esconderia o
        // problema de quem está programando.
        anterior?.(erro, fatal);
      });
    }
  } catch {
    // Sem captura de fatais; o resto continua valendo.
  }

  try {
    // Promessa rejeitada sem catch não derruba o app, mas é a origem de "tocou
    // e não aconteceu nada" — que para quem usa é igualmente um defeito.
    const alvo = globalThis as unknown as {
      addEventListener?: (tipo: string, ouvinte: (evento: unknown) => void) => void;
    };
    alvo.addEventListener?.('unhandledrejection', (evento: unknown) => {
      const motivo = (evento as { reason?: unknown })?.reason ?? evento;
      anotarQueda(motivo, false);
    });
  } catch {
    // Nem toda versão expõe esse evento; não é motivo para parar.
  }
}

type ErrorUtilsLike = {
  getGlobalHandler?: () => ((erro: unknown, fatal?: boolean) => void) | undefined;
  setGlobalHandler?: (handler: (erro: unknown, fatal?: boolean) => void) => void;
};
