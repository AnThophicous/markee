/**
 * Transcrever no próprio aparelho, sem servidor e sem crédito.
 *
 * Isto é a RESERVA, não o caminho principal. O caminho principal é a função de
 * borda `transcrever`, que manda o áudio para a OpenAI: sai mais caro e precisa
 * de internet, mas acerta muito mais. O local existe para quando o crédito
 * acaba, a rede cai, ou a pessoa simplesmente não quer pagar — e nesses casos
 * uma transcrição pior é infinitamente melhor do que nenhuma.
 *
 * Aqui só mora a POLÍTICA: qual modelo cabe no aparelho, quanto tempo vai
 * demorar, e com que opções chamar o whisper. Nada disto toca arquivo, rede ou
 * nativo — por isso dá para testar tudo sem aparelho, e por isso está separado
 * dos serviços ao lado.
 */

/**
 * Os modelos que existem de verdade.
 *
 * Os tamanhos foram conferidos um por um pedindo o cabeçalho do arquivo no
 * HuggingFace, e não copiados de tabela: tabela de README envelhece e um número
 * errado aqui vira barra de progresso mentindo para a pessoa.
 *
 * O detalhe que decide o cardápio: no repositório oficial `ggerganov/whisper.cpp`
 * o `medium` só tem DUAS quantizações publicadas, `q5_0` e `q8_0`. Não existe
 * `medium-q4_0`, `q4_k` nem `q5_1` — conferi os seis nomes e os quatro
 * responderam vazio. Então "medium quantizado ao máximo possível" tem uma
 * resposta só, e é `q5_0`.
 */
export type IdDeModelo = 'tiny' | 'base' | 'small' | 'medium';

export type Modelo = {
  id: IdDeModelo;
  /** O que vira o nome do arquivo, tanto na URL quanto no disco. */
  arquivo: string;
  /** Tamanho exato, conferido no servidor. */
  bytes: number;
  /** Como aparece para a pessoa. */
  nome: string;
  /**
   * Quantos segundos de processamento por segundo de áudio, num telefone
   * mediano de quatro linhas de execução. É ESTIMATIVA, e proposital pelo lado
   * pessimista — depois da primeira transcrição o valor medido toma o lugar
   * deste (veja `estimarSegundos`). Prometer rápido e entregar lento é pior do
   * que o contrário.
   */
  custo: number;
};

export const MODELOS: Record<IdDeModelo, Modelo> = {
  tiny: {
    id: 'tiny',
    arquivo: 'ggml-tiny-q5_1.bin',
    bytes: 32_152_673,
    nome: 'Mínimo',
    custo: 0.3,
  },
  base: {
    id: 'base',
    arquivo: 'ggml-base-q5_1.bin',
    bytes: 59_707_625,
    nome: 'Leve',
    custo: 0.6,
  },
  small: {
    id: 'small',
    arquivo: 'ggml-small-q5_1.bin',
    bytes: 190_085_487,
    nome: 'Equilibrado',
    custo: 1.6,
  },
  medium: {
    id: 'medium',
    arquivo: 'ggml-medium-q5_0.bin',
    bytes: 539_212_467,
    nome: 'Caprichado',
    custo: 5,
  },
};

export const ORDEM: IdDeModelo[] = ['tiny', 'base', 'small', 'medium'];

/**
 * O que se recomenda, e o que o app oferece primeiro.
 *
 * É o `base`, e a escolha é por TEMPO, não por qualidade. A conta que decide:
 * uma aula de cinquenta minutos sai em cerca de meia hora no `base`, uma hora e
 * vinte no `small` e mais de quatro horas no `medium`. Como isto é a RESERVA de
 * quando o crédito acabou ou a internet caiu, o que a pessoa precisa é do texto
 * hoje — uma transcrição pior em trinta minutos vale mais do que uma um pouco
 * melhor amanhã de manhã.
 *
 * O `base` também é o único que cabe em qualquer aparelho: 57 MB de arquivo,
 * 0,4 GB de RAM exigida. Nenhum telefone em uso reprova nesse número.
 */
export const RECOMENDADO: IdDeModelo = 'base';

export const BASE_DOS_MODELOS =
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/';

export const urlDoModelo = (m: Modelo) => BASE_DOS_MODELOS + m.arquivo;

/**
 * Memória de pico durante a transcrição.
 *
 * Os pesos ficam todos residentes — é um arquivo mapeado inteiro — e por cima
 * disso vêm o grafo do codificador, o cache de chaves e valores e o mel. Meia
 * vez o tamanho do arquivo é a folga que cobre isso com margem.
 */
export const memoriaDe = (m: Modelo) => Math.round(m.bytes * 1.5);

/**
 * Quanta RAM o aparelho precisa TER para o modelo caber.
 *
 * O Android não deixa um app usar a memória toda: bem antes disso o sistema
 * mata o processo para atender quem está na frente. Um quarto do total é o
 * orçamento em que dá para contar — acima disso a transcrição não fica lenta,
 * ela morre no meio, e a pessoa perde a aula que já gravou.
 *
 * É por este número que o `medium` reprova em quase todo telefone: 539 MB de
 * arquivo viram ~808 MB de pico, que exigem ~3,2 GB de RAM total.
 */
export const ORCAMENTO_DE_RAM = 0.25;

export const ramNecessaria = (m: Modelo) => Math.round(memoriaDe(m) / ORCAMENTO_DE_RAM);

export const cabeNaMemoria = (m: Modelo, ramTotal: number) =>
  // Sem saber a RAM, não se reprova ninguém: bloquear por falta de informação
  // seria pior do que deixar tentar. `expo-device` devolve 0 em aparelho que
  // não informa.
  ramTotal <= 0 || memoriaDe(m) <= ramTotal * ORCAMENTO_DE_RAM;

/** Espaço em disco para baixar: o arquivo mais uma folga para o sistema respirar. */
export const espacoNecessario = (m: Modelo) => m.bytes + 64 * 1024 * 1024;

export type Escolha = {
  modelo: Modelo;
  /** Verdadeiro quando não foi possível entregar o que a pessoa pediu. */
  rebaixado: boolean;
  /** Explicação em português, para mostrar. Vazio quando deu o pedido. */
  motivo: string;
};

/**
 * O maior modelo que cabe, sem passar do que foi pedido.
 *
 * Rebaixa em vez de recusar. Recusar deixaria a pessoa sem transcrição nenhuma
 * num aparelho que rodaria o `small` sem esforço; e deixar passar entregaria um
 * app que fecha sozinho quinze minutos depois de começar, o que é a pior das
 * três saídas porque desperdiça o tempo dela antes de falhar.
 */
export function escolherModelo(pedido: IdDeModelo, ramTotal: number): Escolha {
  const desejado = MODELOS[pedido];
  if (cabeNaMemoria(desejado, ramTotal)) {
    return { modelo: desejado, rebaixado: false, motivo: '' };
  }

  const menores = ORDEM.slice(0, ORDEM.indexOf(pedido));
  for (let i = menores.length - 1; i >= 0; i--) {
    const m = MODELOS[menores[i]];
    if (cabeNaMemoria(m, ramTotal)) {
      return {
        modelo: m,
        rebaixado: true,
        motivo:
          `O modelo ${desejado.nome} pede ${emGb(ramNecessaria(desejado))} de memória e ` +
          `este aparelho tem ${emGb(ramTotal)}. Usando o ${m.nome} no lugar.`,
      };
    }
  }

  // Nem o menor cabe. Ainda assim devolve o menor: um aparelho que reprova no
  // `tiny` (menos de 200 MB de RAM total) quase certamente informou a memória
  // errado, e travar por causa de um número suspeito é pior do que tentar.
  return {
    modelo: MODELOS.tiny,
    rebaixado: pedido !== 'tiny',
    motivo:
      `Este aparelho tem pouca memória (${emGb(ramTotal)}). Vou tentar com o ` +
      `${MODELOS.tiny.nome}, mas a transcrição pode falhar.`,
  };
}

const emGb = (bytes: number) => `${(bytes / 1024 ** 3).toFixed(1).replace('.', ',')} GB`;

/**
 * As opções com que o whisper roda mais rápido sem ficar burro.
 *
 * Cada uma destas custou leitura do código do whisper.rn, e nenhuma é palpite:
 *
 * `language` fixo: sem isto o whisper gasta uma passada inteira do codificador
 * só para descobrir que a aula é em português. É a economia mais barata que
 * existe aqui, e ainda melhora o resultado.
 *
 * SEM `beamSize`: o whisper.rn só liga busca em feixe se o campo vier maior que
 * zero. Omitindo, fica na decodificação gulosa, que é o caminho rápido. Feixe 5
 * multiplicaria o trabalho do decodificador por cinco.
 *
 * `bestOf: 2`: com temperatura zero e guloso, este número não faz nada — só
 * entra em ação quando um trecho reprova no limiar de confiança e o whisper
 * tenta de novo com temperatura maior. O padrão do whisper.cpp é 5, e cinco
 * decodificadores num trecho difícil, com o `medium`, estouram qualquer
 * orçamento de tempo. Dois preserva a rede de segurança pela metade do preço.
 *
 * SEM `maxThreads`: de propósito. O whisper.rn decide isso no nativo lendo
 * `hardware_concurrency` e usa 2 linhas em aparelho de 4 núcleos e 4 nos
 * demais. Parece pouco, mas é a regra certa para os telefones de núcleos
 * desiguais: mandar trabalho para os núcleos fracos faz a barreira do produto
 * de matrizes esperar por eles, e o todo fica mais lento. O JavaScript não
 * enxerga a contagem de núcleos, então qualquer número que eu fixasse aqui
 * seria um chute pior do que a informação que o nativo já tem.
 *
 * `tokenTimestamps` fica desligado (é o padrão): ele liga um alinhamento por
 * dentro que custa caro e não serve para nada numa nota de aula.
 */
export function opcoesDeTranscricao(pista = '') {
  return {
    language: 'pt',
    translate: false,
    bestOf: 2,
    ...(pista ? { prompt: pista } : {}),
  };
}

/**
 * Opções de abertura do contexto.
 *
 * `useGpu` fica ligado sempre. No iPhone existe Metal e ele muda tudo; no
 * Android o pacote não compila back-end de GPU nenhum, então lá o pedido é
 * ignorado e a biblioteca cai no processador sozinha.
 *
 * `useFlashAttn` SÓ no iOS, e isto é uma correção de rota: eu tinha concluído
 * que valia no processador, porque o `ggml_flash_attn_ext` tem implementação de
 * CPU. Tem mesmo — mas a documentação do whisper.rn diz, com todas as letras,
 * "only recommended if GPU available". Existir a operação não é o mesmo que ela
 * ser mais rápida: no processador, a atenção fundida troca passadas de memória
 * por conta, e é justamente aí que um telefone perde. Entre o que eu deduzi
 * lendo o código e o que quem escreveu a biblioteca recomenda, vale o segundo.
 */
export function opcoesDeContexto(plataforma: string) {
  return { useGpu: true, useFlashAttn: plataforma === 'ios' };
}

/**
 * Quanto tempo a transcrição vai levar, em segundos.
 *
 * Enquanto não houver medição, usa o custo estimado do modelo — pessimista de
 * propósito. Depois da primeira transcrição, o valor MEDIDO manda: o mesmo
 * modelo roda três vezes mais rápido num aparelho novo do que num velho, e
 * nenhuma tabela minha vai adivinhar em qual dos dois a pessoa está.
 */
export function estimarSegundos(
  segundosDeAudio: number,
  modelo: Modelo,
  medido?: number
): number {
  const custo = medido && medido > 0 ? medido : modelo.custo;
  return Math.round(Math.max(0, segundosDeAudio) * custo);
}

/**
 * O tempo em palavras, arredondado para cima.
 *
 * Para cima porque a pessoa vai decidir se espera ou se deixa o telefone de
 * lado, e "3 minutos" que viram 4 irrita muito mais do que "4 minutos" que
 * viram 3.
 */
export function emPalavras(segundos: number): string {
  if (segundos < 60) return 'menos de um minuto';
  const minutos = Math.ceil(segundos / 60);
  if (minutos < 60) return minutos === 1 ? '1 minuto' : `${minutos} minutos`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  const h = horas === 1 ? '1 hora' : `${horas} horas`;
  return resto ? `${h} e ${resto} min` : h;
}

/** O tamanho do arquivo em palavras, para a tela de download. */
export function tamanhoEmPalavras(bytes: number): string {
  const mb = bytes / 1024 ** 2;
  if (mb < 1000) return `${Math.round(mb)} MB`;
  return `${(mb / 1024).toFixed(1).replace('.', ',')} GB`;
}

/**
 * O aviso que a pessoa precisa ler ANTES de baixar meio giga.
 *
 * Nulo quando não há nada de estranho. Existe porque o `medium` num telefone é
 * uma escolha que se arrepende depois, e o momento de saber disso é antes do
 * download, não no meio da transcrição da prova.
 */
export function avisoDoModelo(
  modelo: Modelo,
  segundosDeAudio: number,
  medido?: number
): string | null {
  const espera = estimarSegundos(segundosDeAudio, modelo, medido);
  if (espera <= segundosDeAudio) return null;

  return (
    `Neste aparelho o ${modelo.nome} demora cerca de ${emPalavras(espera)} para ` +
    `transcrever ${emPalavras(segundosDeAudio)} de aula — mais tempo do que a ` +
    `própria aula. Dá para deixar rodando com a tela apagada.`
  );
}
