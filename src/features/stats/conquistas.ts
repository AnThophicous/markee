/**
 * As conquistas de ofensiva, e o protetor que impede a queda boba.
 *
 * Tudo aqui é função pura sobre listas de dias. Nada de banco, nada de relógio
 * escondido — o `hoje` sempre entra por parâmetro, porque a parte difícil de
 * ofensiva não é contar dias, é decidir o que conta e quando o dia vira.
 *
 * Segurança: isto sai do banco LOCAL e é visto só por quem conquistou, igual às
 * medalhas. Um APK modificado se dá 365 dias de ofensiva e engana exatamente
 * uma pessoa. O que aparece para terceiros são os emblemas (emblemas.ts), e
 * aqueles o servidor calcula sozinho.
 */

import { diaDe, diasAtras } from './streak';

export type Marco = {
  dias: number;
  nome: string;
  /** A frase que aparece quando cai — escrita para ser lida uma vez só. */
  festa: string;
  icone: string;
  cor: string;
};

/**
 * Os degraus.
 *
 * Começam em 3 porque o terceiro dia é onde a maioria desiste — é ali que a
 * novidade acabou e o hábito ainda não existe, e é justamente ali que uma
 * comemoração vale mais do que em qualquer outro ponto.
 *
 * Depois dobram sem exagero até 365. O intervalo entre 100 e 365 é enorme de
 * propósito: quem chegou nos 100 dias não precisa mais de estímulo de curto
 * prazo, precisa de uma coisa grande no horizonte.
 */
export const MARCOS: Marco[] = [
  { dias: 3, nome: 'Três dias', festa: 'Três dias seguidos. É aqui que a maioria para — e você não parou.', icone: 'sunrise', cor: '#F9AB00' },
  { dias: 7, nome: 'Uma semana', festa: 'Uma semana inteira. Já é rotina.', icone: 'calendar', cor: '#F57C00' },
  { dias: 14, nome: 'Duas semanas', festa: 'Duas semanas. Seu cérebro já espera o estudo.', icone: 'trending-up', cor: '#EF6C00' },
  { dias: 30, nome: 'Um mês', festa: 'Um mês seguido. Isso é mais do que a maioria consegue no ano.', icone: 'award', cor: '#E5484D' },
  { dias: 50, nome: 'Cinquenta', festa: 'Cinquenta dias. Você não está mais tentando — você faz.', icone: 'zap', cor: '#D81B60' },
  { dias: 100, nome: 'Cem dias', festa: 'CEM DIAS. Um terço de ano estudando todo santo dia.', icone: 'star', cor: '#8E24AA' },
  { dias: 180, nome: 'Meio ano', festa: 'Meio ano sem faltar um dia. Sinceramente: isso é raro.', icone: 'shield', cor: '#5E35B1' },
  { dias: 365, nome: 'Um ano', festa: 'Um ano. Trezentos e sessenta e cinco dias. Não há mais o que dizer.', icone: 'sun', cor: '#0B57D0' },
];

export type EstadoDoMarco = Marco & { conquistado: boolean; fracao: number };

/**
 * O estado de cada marco.
 *
 * Olha o RECORDE, e não a ofensiva de agora. Perder a sequência já dói; ver as
 * conquistas de 30 e 50 dias sumirem junto seria punir duas vezes o mesmo dia
 * esquecido, e é o tipo de coisa que faz desinstalar o app.
 */
export function marcosDa(recorde: number): EstadoDoMarco[] {
  return MARCOS.map((m) => ({
    ...m,
    conquistado: recorde >= m.dias,
    fracao: Math.min(1, Math.max(0, recorde) / m.dias),
  }));
}

/** O próximo alvo a partir da ofensiva de AGORA — este olha o presente. */
export function proximoMarco(atual: number): { marco: Marco; faltam: number } | null {
  const alvo = MARCOS.find((m) => m.dias > atual);
  return alvo ? { marco: alvo, faltam: alvo.dias - atual } : null;
}

/** O marco que a ofensiva de agora acabou de cruzar, se cruzou hoje. */
export function marcoAlcancado(atual: number): Marco | null {
  return MARCOS.find((m) => m.dias === atual) ?? null;
}

/* --------------------------------------------------------- o protetor */

/** Um protetor a cada sete dias estudados, e no máximo dois guardados. */
export const DIAS_POR_PROTETOR = 7;
export const TETO_DE_PROTETORES = 2;
export const TETO_PRO = 3;

/**
 * Quantos protetores existem para usar.
 *
 * O ganho vem do TOTAL de dias estudados na vida, e não da ofensiva atual, por
 * um motivo prático: total só cresce. Se o ganho viesse da ofensiva, perder a
 * sequência tiraria os protetores no exato momento em que eles são mais
 * necessários — e daí o recurso existiria só para quem nunca precisou dele.
 */
export function protetoresDisponiveis(
  diasEstudados: number,
  protetoresUsados: number,
  pro = false
): number {
  const ganhos = Math.floor(Math.max(0, diasEstudados) / DIAS_POR_PROTETOR);
  const sobrando = ganhos - Math.max(0, protetoresUsados);
  return Math.max(0, Math.min(pro ? TETO_PRO : TETO_DE_PROTETORES, sobrando));
}

/**
 * Que dias o protetor deve cobrir agora.
 *
 * A regra, e cada pedaço dela existe por um caso concreto:
 *
 *   1. Só cobre dias JÁ PASSADOS. Hoje ainda dá tempo de estudar, e gastar um
 *      protetor às nove da manhã seria roubar da pessoa a chance de não
 *      precisar dele.
 *   2. Só cobre buraco que está SALVANDO alguma coisa — precisa haver dia
 *      estudado logo antes do buraco. Sem isso, quem instalou o app e sumiu por
 *      um mês voltaria com dois protetores queimados à toa.
 *   3. Para no primeiro dia estudado. O buraco é um só, o mais recente.
 *   4. Nunca gasta mais do que tem.
 *
 * Devolve os dias a proteger, do mais antigo para o mais novo. Lista vazia quer
 * dizer "não faz nada" — o que é o caso quase sempre.
 */
export function protecaoNecessaria(
  diasComEstudo: string[],
  disponiveis: number,
  hoje = diaDe()
): string[] {
  if (disponiveis <= 0) return [];

  const conjunto = new Set(diasComEstudo);
  const base = new Date(`${hoje}T12:00:00`).getTime();

  // Se hoje ou ontem já contam, a ofensiva está viva e não há o que proteger.
  if (conjunto.has(hoje) || conjunto.has(diasAtras(1, base))) return [];

  const buraco: string[] = [];
  for (let atras = 1; atras <= disponiveis + 1; atras += 1) {
    const dia = diasAtras(atras, base);
    if (conjunto.has(dia)) {
      // Achou o dia estudado logo antes do buraco: o buraco vale a pena cobrir.
      return buraco.length > 0 && buraco.length <= disponiveis ? buraco.reverse() : [];
    }
    buraco.push(dia);
  }

  // Saiu do laço sem achar chão: o buraco é maior do que os protetores cobrem.
  return [];
}

/** Frase curta do estado do protetor, para o cartão. */
export function textoDoProtetor(disponiveis: number, teto: number): string {
  if (disponiveis === 0) return `Nenhum guardado. Você ganha um a cada ${DIAS_POR_PROTETOR} dias estudados.`;
  if (disponiveis === 1) return 'Um protetor guardado. Ele cobre um dia que você esquecer.';
  return `${disponiveis} protetores guardados, de ${teto}.`;
}
