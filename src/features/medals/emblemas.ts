/**
 * Emblemas: o que os OUTROS veem do seu lado dentro do grupo.
 *
 * A diferença entre emblema e medalha é de segurança, e vale repetir aqui
 * porque é ela que decide onde cada coisa pode morar:
 *
 *   MEDALHA  (medalhas.ts) sai do banco do aparelho e é vista só por quem
 *            conquistou. Um APK modificado se dá todas, e não engana ninguém
 *            além de si mesmo.
 *
 *   EMBLEMA  (este arquivo) aparece para terceiros. Por isso NADA aqui é
 *            calculado: a lista chega pronta do servidor, que a monta do que
 *            ele mesmo viu — a assinatura que a loja confirmou, a data em que a
 *            conta nasceu, as mensagens que passaram pelo banco dele.
 *
 * O que este arquivo faz é só traduzir um código curto ('pro', 'fundador') em
 * nome, ícone e cor. Se alguém trocar este catálogo num APK modificado, muda o
 * desenho na tela DELE e mais nada — porque quem decide quais códigos vêm na
 * lista é o servidor, e ele não pergunta ao aplicativo.
 */

export type Emblema = {
  codigo: string;
  nome: string;
  /** Como se ganha, em uma frase, para a tela que lista todos. */
  como: string;
  icone: string;
  cor: string;
  /** Emblemas que a pessoa carrega para qualquer grupo, e não só para este. */
  global: boolean;
};

/**
 * A ordem importa: é a de exibição, e a lista de membros só mostra os três
 * primeiros. Os raros e caros vêm na frente para não serem os cortados.
 */
export const EMBLEMAS: Emblema[] = [
  {
    codigo: 'dono',
    nome: 'Dono',
    como: 'Criou este grupo',
    icone: 'award',
    cor: '#F9AB00',
    global: false,
  },
  {
    codigo: 'pro',
    nome: 'Pro',
    como: 'Assina o Markee Pro',
    icone: 'zap',
    cor: '#0B57D0',
    global: true,
  },
  {
    codigo: 'padrinho',
    nome: 'Padrinho',
    como: 'Trouxe alguém que assinou o Pro',
    icone: 'users',
    cor: '#7C4DFF',
    global: true,
  },
  {
    codigo: 'fundador',
    nome: 'Desde o começo',
    como: 'Entre as 10 primeiras pessoas do grupo',
    icone: 'flag',
    cor: '#00897B',
    global: false,
  },
  {
    codigo: 'veterano',
    nome: 'Veterano',
    como: 'Conta com mais de 6 meses',
    icone: 'shield',
    cor: '#5F6368',
    global: true,
  },
  {
    codigo: 'voz',
    nome: 'Voz do grupo',
    como: 'Mandou 1000 mensagens aqui',
    icone: 'mic',
    cor: '#E5484D',
    global: false,
  },
  {
    codigo: 'querido',
    nome: 'Bem quisto',
    como: 'Recebeu 50 curtidas no mural',
    icone: 'heart',
    cor: '#EC407A',
    global: false,
  },
  {
    codigo: 'autor',
    nome: 'Autor',
    como: 'Publicou 10 vezes no mural',
    icone: 'edit-3',
    cor: '#00A97F',
    global: false,
  },
  {
    codigo: 'conversador',
    nome: 'Conversador',
    como: 'Mandou 100 mensagens aqui',
    icone: 'message-circle',
    cor: '#1E88E5',
    global: false,
  },
  {
    codigo: 'fundou',
    nome: 'Fundador',
    como: 'Criou um grupo',
    icone: 'flag',
    cor: '#00897B',
    global: true,
  },
];

const POR_CODIGO = new Map(EMBLEMAS.map((e) => [e.codigo, e]));
const POSICAO = new Map(EMBLEMAS.map((e, i) => [e.codigo, i]));

/**
 * Traduz um código do servidor.
 *
 * Devolve nulo para código desconhecido, e isso é de propósito: o servidor pode
 * passar a mandar um emblema novo antes de a pessoa atualizar o aplicativo, e
 * uma versão antiga precisa simplesmente ignorar o que não conhece — em vez de
 * desenhar um quadrado vazio ou derrubar a lista de membros inteira.
 */
export const acharEmblema = (codigo: string): Emblema | null => POR_CODIGO.get(codigo) ?? null;

/**
 * A lista pronta para desenhar: traduzida, sem os desconhecidos, na ordem do
 * catálogo — e não na ordem em que o servidor mandou, que é a do banco.
 */
export function emblemasDe(codigos: string[]): Emblema[] {
  return codigos
    .map(acharEmblema)
    .filter((e): e is Emblema => e !== null)
    .sort((a, b) => (POSICAO.get(a.codigo) ?? 99) - (POSICAO.get(b.codigo) ?? 99));
}

/**
 * Quantos cabem na linha do nome, e quantos sobraram.
 *
 * Três é o limite porque o nome vem antes e o apelido pode ser longo: a partir
 * do quarto ícone, o nome começa a ser cortado — e o nome importa mais que o
 * enfeite. O resto vira "+2", que é convite para tocar e ver todos.
 */
export function emblemasNaLinha(codigos: string[], limite = 3): { mostrar: Emblema[]; resto: number } {
  const todos = emblemasDe(codigos);
  return { mostrar: todos.slice(0, limite), resto: Math.max(0, todos.length - limite) };
}
