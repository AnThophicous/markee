import { Directory, File, Paths } from 'expo-file-system';
import * as Device from 'expo-device';

import {
  MODELOS,
  ORDEM,
  escolherModelo,
  espacoNecessario,
  tamanhoEmPalavras,
  urlDoModelo,
  type Escolha,
  type IdDeModelo,
  type Modelo,
} from '../whisper-local';

/**
 * O arquivo do modelo: baixar, conferir, apagar.
 *
 * O modelo NÃO vai dentro do APK, e não é escolha de estilo: o `medium`
 * quantizado tem 539 MB, mais do que o app inteiro por uma ordem de grandeza.
 * A Play Store recusa pacote acima de 200 MB, e mesmo que aceitasse, todo mundo
 * que só usa transcrição pela internet pagaria meio giga de download para nada.
 *
 * Então ele desce depois, uma vez, e fica no diretório de DOCUMENTOS — não no
 * de cache. O Android esvazia o cache sozinho quando o disco aperta, e perder
 * meio giga sem aviso, no meio de uma aula, seria um jeito muito caro de
 * descobrir isso.
 */

const PASTA = 'whisper';

function pasta(): Directory {
  const d = new Directory(Paths.document, PASTA);
  if (!d.exists) d.create({ intermediates: true });
  return d;
}

const arquivoDe = (m: Modelo) => new File(pasta(), m.arquivo);

/**
 * O selo de "baixou inteiro".
 *
 * Existe porque só a presença do arquivo não prova nada: download interrompido
 * deixa meio modelo no disco, que existe, abre, e faz o whisper.cpp morrer lá
 * dentro com um erro que não explica nada.
 *
 * E o selo guarda o tamanho em vez de eu comparar com o número do catálogo, o
 * que é a parte importante. Se o arquivo mudar no HuggingFace, ou se eu tiver
 * digitado um byte errado no catálogo, comparar com o catálogo faria TODO
 * download ser recusado como corrompido — e a pessoa ficaria baixando meio giga
 * em círculo, para sempre, sem nunca instalar nada. O selo compara o arquivo
 * com o que o servidor disse que ele era na hora em que desceu, que é a única
 * fonte que não pode estar desatualizada.
 */
const seloDe = (m: Modelo) => new File(pasta(), m.arquivo + '.ok');

function selar(m: Modelo, bytes: number) {
  const selo = seloDe(m);
  if (selo.exists) selo.delete();
  selo.create();
  selo.write(String(bytes));
}

function selado(m: Modelo): number {
  try {
    const selo = seloDe(m);
    if (!selo.exists) return 0;
    const n = Number(selo.textSync().trim());
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export type EstadoDoModelo = {
  modelo: Modelo;
  instalado: boolean;
  /** Caminho no disco. Só serve quando `instalado`. */
  uri: string;
  /** Bytes ocupados. Zero quando não está instalado. */
  bytes: number;
};

export function estadoDoModelo(id: IdDeModelo): EstadoDoModelo {
  const modelo = MODELOS[id];
  const arquivo = arquivoDe(modelo);

  const bytes = (arquivo.exists && arquivo.size) || 0;
  const completo = bytes > 0 && bytes === selado(modelo);

  return { modelo, instalado: completo, uri: arquivo.uri, bytes };
}

/** Todos os modelos que já estão no aparelho, do maior para o menor. */
export function modelosInstalados(): EstadoDoModelo[] {
  return ORDEM.map(estadoDoModelo)
    .filter((e) => e.instalado)
    .reverse();
}

/**
 * O melhor modelo já instalado, ou nulo.
 *
 * É o que a transcrição de reserva usa sem perguntar nada: se a pessoa baixou,
 * ela quer usar.
 */
export function melhorInstalado(): EstadoDoModelo | null {
  return modelosInstalados()[0] ?? null;
}

/** A memória do aparelho, em bytes. Zero quando o sistema não informa. */
export const ramDoAparelho = () => Device.totalMemory ?? 0;

/** O que dá para rodar aqui, já rebaixado se o pedido não couber. */
export const escolherParaEsteAparelho = (pedido: IdDeModelo): Escolha =>
  escolherModelo(pedido, ramDoAparelho());

export type ProgressoDoDownload = {
  bytes: number;
  total: number;
  /** De 0 a 1. Fica em 0 enquanto o servidor não disser o tamanho. */
  fracao: number;
};

export class ErroDeModelo extends Error {}

/**
 * Baixa o modelo, com progresso e cancelamento.
 *
 * Confere o espaço ANTES de começar. Sem isso o download vai até 480 MB e morre
 * com disco cheio — meia hora de espera e de dados móveis por nada, e o pior é
 * que o pedaço baixado fica ocupando o disco que já estava apertado.
 *
 * Grava direto no destino final e apaga o pedaço se algo der errado. Não há
 * arquivo temporário porque o `estadoDoModelo` já trata tamanho errado como
 * ausente — dois mecanismos para o mesmo problema seriam um a mais para manter.
 */
export async function baixarModelo(
  id: IdDeModelo,
  opcoes: {
    onProgresso?: (p: ProgressoDoDownload) => void;
    sinal?: AbortSignal;
  } = {}
): Promise<EstadoDoModelo> {
  const modelo = MODELOS[id];
  const ja = estadoDoModelo(id);
  if (ja.instalado) return ja;

  const preciso = espacoNecessario(modelo);
  const livre = Paths.availableDiskSpace;
  if (livre > 0 && livre < preciso) {
    throw new ErroDeModelo(
      `Falta espaço: são ${tamanhoEmPalavras(modelo.bytes)} e há ` +
        `${tamanhoEmPalavras(livre)} livres. Libere espaço e tente de novo.`
    );
  }

  const destino = arquivoDe(modelo);
  // Sobra de tentativa anterior. `idempotent` cuidaria do arquivo, mas apagar
  // antes deixa o disco livre durante o download em vez de exigir o dobro do
  // espaço. O selo vai junto: um selo velho sobre um arquivo novo daria o
  // instalado por bom sem que ele estivesse.
  limpar(destino);
  limpar(seloDe(modelo));

  // O que o SERVIDOR disse que o arquivo tem. É contra este número que a
  // integridade é conferida, não contra o catálogo.
  let anunciado = 0;

  try {
    await File.downloadFileAsync(urlDoModelo(modelo), destino, {
      idempotent: true,
      signal: opcoes.sinal,
      onProgress: ({ bytesWritten, totalBytes }) => {
        if (totalBytes > 0) anunciado = totalBytes;
        // Sem `Content-Length` vale o do catálogo — só para a barra de
        // progresso ter uma escala. A conferência do fim não depende dele.
        const total = anunciado > 0 ? anunciado : modelo.bytes;
        opcoes.onProgresso?.({
          bytes: bytesWritten,
          total,
          fracao: total > 0 ? Math.min(1, bytesWritten / total) : 0,
        });
      },
    });
  } catch {
    limpar(destino);
    if (opcoes.sinal?.aborted) throw new ErroDeModelo('Download cancelado.');
    throw new ErroDeModelo(
      'Não consegui baixar o modelo. Confira a internet e tente de novo.'
    );
  }

  const baixado = (destino.exists && destino.size) || 0;

  // Chegou ao fim com tamanho diferente do anunciado: proxy de operadora,
  // página de login de wi-fi público, conexão cortada no último segundo.
  // Guardar isso seria guardar lixo que só falha depois, longe daqui.
  if (baixado <= 0 || (anunciado > 0 && baixado !== anunciado)) {
    limpar(destino);
    throw new ErroDeModelo('O arquivo baixado veio incompleto. Tente de novo.');
  }

  // Um arquivo ridiculamente menor que o esperado é resposta de erro salva como
  // se fosse modelo — foi exatamente assim que os `q4_0` inexistentes
  // apareceram na conferência: 15 bytes de "Entry not found".
  if (baixado < modelo.bytes / 2) {
    limpar(destino);
    throw new ErroDeModelo(
      'O servidor não devolveu o modelo. Tente de novo mais tarde.'
    );
  }

  selar(modelo, baixado);
  return estadoDoModelo(id);
}

export function apagarModelo(id: IdDeModelo): void {
  limpar(arquivoDe(MODELOS[id]));
  limpar(seloDe(MODELOS[id]));
}

/** Quanto os modelos estão ocupando, para a tela de armazenamento. */
export const bytesOcupados = () =>
  modelosInstalados().reduce((soma, e) => soma + e.bytes, 0);

function limpar(arquivo: File) {
  try {
    if (arquivo.exists) arquivo.delete();
  } catch {
    // Apagar é limpeza; se falhar, o `estadoDoModelo` ainda vai ver o tamanho
    // errado e tratar como ausente. Não vale derrubar nada por isto.
  }
}
