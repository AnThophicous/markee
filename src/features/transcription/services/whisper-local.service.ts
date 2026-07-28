import { Platform } from 'react-native';
import { File, FileMode } from 'expo-file-system';
// O `paths` do tsconfig aponta este pacote direto para as tipagens dele. Não é
// capricho: o `exports` do whisper.rn declara só `"./*"` e esqueceu a raiz
// `"."`, então `moduleResolution: bundler` não acha o pacote pelo nome. O Metro
// contorna sozinho caindo no `main` antigo; o TypeScript não contorna.
import { initWhisper, type WhisperContext } from 'whisper.rn';

import { opcoesDeContexto, opcoesDeTranscricao, type IdDeModelo } from '../whisper-local';
import { estadoDoModelo, melhorInstalado, type EstadoDoModelo } from './whisper-model.service';

/**
 * O whisper.cpp rodando aqui dentro, no processador do telefone.
 *
 * Duas coisas separam este arquivo de um `initWhisper` solto numa tela:
 *
 * O CONTEXTO É CARO E FICA VIVO. Abrir o contexto lê o modelo inteiro do disco
 * — meio giga, no caso do `medium` — e reserva a memória de trabalho. Fazer
 * isso a cada trecho de áudio transformaria uma aula de dez trechos em dez
 * leituras de meio giga. Ele abre uma vez, atende todos os trechos, e só é
 * liberado quando a gravação termina.
 *
 * SÓ ENTRA WAV. Isto não é escolha minha: o decodificador do whisper.rn no
 * Android é uma função que lê `RIFF`/`WAVE` e mais nada. Passar um `.m4a` não
 * dá erro — devolve texto VAZIO, calado, como se a aula não tivesse áudio. É o
 * pior tipo de falha que existe, então a conferência do cabeçalho acontece
 * aqui, antes, e vira uma mensagem que diz o que houve.
 */

let contexto: WhisperContext | null = null;
let modeloAberto: IdDeModelo | null = null;

export class ErroLocal extends Error {}

/**
 * Abre (ou reaproveita) o contexto do modelo pedido.
 *
 * Trocar de modelo fecha o anterior antes de abrir o novo. Dois contextos de
 * meio giga vivos ao mesmo tempo é o caminho mais curto para o Android matar o
 * app no meio da transcrição.
 */
async function abrir(estado: EstadoDoModelo): Promise<WhisperContext> {
  if (contexto && modeloAberto === estado.modelo.id) return contexto;
  await liberar();

  try {
    contexto = await initWhisper({
      filePath: estado.uri,
      ...opcoesDeContexto(Platform.OS),
    });
  } catch {
    throw new ErroLocal(
      'Não consegui abrir o modelo. Ele pode ter vindo corrompido — apague e baixe de novo.'
    );
  }

  modeloAberto = estado.modelo.id;
  return contexto;
}

/** Fecha o contexto e devolve a memória. Seguro de chamar a qualquer momento. */
export async function liberar(): Promise<void> {
  const atual = contexto;
  contexto = null;
  modeloAberto = null;
  try {
    await atual?.release();
  } catch {
    // Já liberado, ou o app está fechando. Não há o que fazer com este erro, e
    // deixá-lo subir derrubaria a limpeza de quem chamou.
  }
}

export const modeloEmMemoria = () => modeloAberto;

export type ResultadoLocal = {
  texto: string;
  /**
   * Quanto tempo de parede por segundo de áudio. É o que alimenta a estimativa
   * da PRÓXIMA transcrição — a partir daqui a espera prevista para de ser chute
   * de tabela e passa a ser a velocidade real deste aparelho.
   */
  custoMedido: number;
  /** Verdadeiro quando a pessoa cancelou no meio. O texto até ali vem junto. */
  cancelado: boolean;
};

/**
 * Transcreve um arquivo WAV no aparelho.
 *
 * `contexto` (a pista) são as últimas palavras do trecho anterior, pelo mesmo
 * motivo do caminho pela internet: sem elas o nome próprio sai grafado de um
 * jeito num trecho e de outro no seguinte.
 */
export async function transcreverLocalmente(
  uri: string,
  opcoes: {
    pista?: string;
    modelo?: IdDeModelo;
    onProgresso?: (fracao: number) => void;
    sinal?: AbortSignal;
  } = {}
): Promise<ResultadoLocal> {
  const estado = opcoes.modelo ? estadoDoModelo(opcoes.modelo) : melhorInstalado();

  if (!estado?.instalado) {
    throw new ErroLocal(
      'Nenhum modelo de transcrição baixado. Baixe um nas configurações para transcrever sem internet.'
    );
  }

  conferirWav(uri);

  const ctx = await abrir(estado);
  const comecou = Date.now();

  const { stop, promise } = ctx.transcribe(uri, {
    ...opcoesDeTranscricao(opcoes.pista),
    // O whisper.rn conta de 0 a 100; o resto do app fala em fração.
    onProgress: (p) => opcoes.onProgresso?.(Math.min(1, Math.max(0, p / 100))),
  });

  // O cancelamento não rejeita a promessa: ele para o whisper, que devolve o
  // que já transcreveu com `isAborted`. Quem cancelou uma aula de quarenta
  // minutos no minuto trinta e cinco prefere trinta e cinco minutos de nota a
  // nenhuma.
  const cancelar = () => {
    void stop();
  };
  opcoes.sinal?.addEventListener('abort', cancelar);

  try {
    const { result, isAborted } = await promise;
    const segundos = (Date.now() - comecou) / 1000;
    const duracao = duracaoDoWav(uri);

    return {
      texto: (result ?? '').trim(),
      // Sem saber a duração do áudio não dá para medir velocidade; devolver
      // zero faz a estimativa continuar usando a tabela, que é o certo.
      custoMedido: duracao > 0 ? segundos / duracao : 0,
      cancelado: Boolean(isAborted),
    };
  } catch {
    throw new ErroLocal('A transcrição falhou no aparelho. Tente um modelo menor.');
  } finally {
    opcoes.sinal?.removeEventListener('abort', cancelar);
  }
}

/** Cabeçalho WAV: `RIFF` nos bytes 0-3 e `WAVE` nos 8-11. */
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WAVE = [0x57, 0x41, 0x56, 0x45];

function cabecalho(uri: string): Uint8Array | null {
  let alca: ReturnType<File['open']> | null = null;
  try {
    const arquivo = new File(uri);
    if (!arquivo.exists) return null;

    // Abre e lê 44 bytes — o cabeçalho canônico inteiro. É de propósito que
    // não se use `bytesSync()`: ele traria a aula inteira, dezenas de
    // megabytes, para a memória do JavaScript só para olhar quatro letras.
    alca = arquivo.open(FileMode.ReadOnly);
    return alca.readBytes(44);
  } catch {
    return null;
  } finally {
    try {
      alca?.close();
    } catch {
      // Fechar é limpeza. Um descritor vazado é ruim; derrubar a transcrição
      // por causa dele seria pior.
    }
  }
}

function conferirWav(uri: string): void {
  const bytes = cabecalho(uri);
  if (!bytes || bytes.length < 44) {
    throw new ErroLocal('Não consegui ler o arquivo de áudio.');
  }

  const casa = (marca: number[], em: number) => marca.every((b, i) => bytes[em + i] === b);
  if (!casa(RIFF, 0) || !casa(WAVE, 8)) {
    throw new ErroLocal(
      'A transcrição no aparelho só aceita áudio WAV. Grave pelo próprio app ' +
        'ou use a transcrição pela internet.'
    );
  }
}

/**
 * Quantos segundos de áudio há no WAV, lidos do cabeçalho.
 *
 * Serve só para medir a velocidade do aparelho, então uma leitura ingênua
 * basta: assume o cabeçalho canônico de 44 bytes, que é o que qualquer gravador
 * de PCM escreve. Se vier um WAV com blocos extras a conta sai errada — e por
 * isso o valor só alimenta uma ESTIMATIVA, nunca a cobrança.
 */
function duracaoDoWav(uri: string): number {
  const bytes = cabecalho(uri);
  if (!bytes || bytes.length < 44) return 0;

  const u32 = (em: number) =>
    bytes[em] | (bytes[em + 1] << 8) | (bytes[em + 2] << 16) | (bytes[em + 3] << 24);

  const bytesPorSegundo = u32(28);
  const dados = u32(40);
  return bytesPorSegundo > 0 ? dados / bytesPorSegundo : 0;
}
