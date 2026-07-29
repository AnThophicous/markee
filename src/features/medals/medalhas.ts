/**
 * Medalhas: o que já foi conquistado, calculado do que já existe.
 *
 * SEGURANÇA, e a regra vale para o arquivo inteiro: tudo aqui sai do banco
 * LOCAL — dias de estudo, cartas, notas, minutos gravados — e é mostrado só
 * para quem conquistou. Nenhuma medalha vai para o servidor, nenhuma aparece
 * no perfil que os outros veem, nenhuma libera nada dentro de um grupo.
 *
 * Isso não é preguiça, é o desenho: um APK modificado consegue escrever
 * `study_days` à vontade e se dar todas as medalhas — e o estrago disso é
 * exatamente zero, porque o efeito não sai do aparelho de quem trapaceou. No
 * dia em que uma medalha valer alguma coisa para terceiros, ela terá de ser
 * calculada no servidor, a partir do que o servidor viu acontecer. Enquanto for
 * enfeite próprio, o banco local basta e ninguém é enganado além de si mesmo.
 */

export type NivelDeMedalha = 'bronze' | 'prata' | 'ouro' | 'diamante';

export type Medalha = {
  id: string;
  nome: string;
  /** O que precisa fazer, escrito para quem ainda não conquistou. */
  comoGanhar: string;
  icone: string;
  nivel: NivelDeMedalha;
  /** Quanto falta ou já passou, para a barra de progresso. */
  meta: number;
  familia: 'ofensiva' | 'cartas' | 'notas' | 'aulas';
};

export type Numeros = {
  ofensiva: number;
  recordeDeOfensiva: number;
  cartasRevisadas: number;
  cartasMaduras: number;
  notasEscritas: number;
  minutosGravados: number;
};

export const NUMEROS_ZERADOS: Numeros = {
  ofensiva: 0,
  recordeDeOfensiva: 0,
  cartasRevisadas: 0,
  cartasMaduras: 0,
  notasEscritas: 0,
  minutosGravados: 0,
};

/**
 * As metas.
 *
 * Quatro famílias com quatro degraus cada, e os degraus crescem por volta de
 * 3x. O primeiro é de propósito ridículo de fácil — 3 dias seguidos, 10 cartas
 * — porque medalha que só aparece no segundo mês não motiva ninguém no primeiro
 * dia, que é justo quando a pessoa está decidindo se continua usando o app.
 *
 * O último degrau de cada família é longo de verdade. Um conjunto que se
 * completa em duas semanas vira uma tela morta pelo resto do uso.
 */
const NIVEIS: NivelDeMedalha[] = ['bronze', 'prata', 'ouro', 'diamante'];

const FAMILIAS: {
  familia: Medalha['familia'];
  icone: string;
  nomes: [string, string, string, string];
  metas: [number, number, number, number];
  comoGanhar: (meta: number) => string;
}[] = [
  {
    familia: 'ofensiva',
    icone: 'zap',
    nomes: ['Constante', 'Semana cheia', 'Mês inteiro', 'Inabalável'],
    metas: [3, 7, 30, 100],
    comoGanhar: (m) => `Estude ${m} dias seguidos`,
  },
  {
    familia: 'cartas',
    icone: 'layers',
    nomes: ['Primeira revisão', 'Pegando o ritmo', 'Memória treinada', 'Enciclopédia'],
    metas: [10, 100, 500, 2000],
    comoGanhar: (m) => `Revise ${m} cartas`,
  },
  {
    familia: 'notas',
    icone: 'edit-3',
    nomes: ['Caderno aberto', 'Caderno cheio', 'Arquivista', 'Biblioteca'],
    metas: [5, 25, 100, 400],
    comoGanhar: (m) => `Escreva ${m} notas`,
  },
  {
    familia: 'aulas',
    icone: 'mic',
    nomes: ['Primeira aula', 'Semestre gravado', 'Ouvinte atento', 'Sala inteira'],
    metas: [30, 300, 1200, 5000],
    comoGanhar: (m) => `Grave ${m} minutos de aula`,
  },
];

export const MEDALHAS: Medalha[] = FAMILIAS.flatMap((f) =>
  f.metas.map((meta, i) => ({
    id: `${f.familia}-${NIVEIS[i]}`,
    nome: f.nomes[i],
    comoGanhar: f.comoGanhar(meta),
    icone: f.icone,
    nivel: NIVEIS[i],
    meta,
    familia: f.familia,
  }))
);

/** O número que conta para cada família. */
function valorDe(medalha: Medalha, n: Numeros): number {
  switch (medalha.familia) {
    case 'ofensiva':
      // O RECORDE, e não a ofensiva atual. Perder a sequência já dói; perder a
      // medalha junto seria punir duas vezes o mesmo dia esquecido — e ninguém
      // volta para um app que tira o que já deu.
      return Math.max(n.ofensiva, n.recordeDeOfensiva);
    case 'cartas':
      return n.cartasRevisadas;
    case 'notas':
      return n.notasEscritas;
    case 'aulas':
      return n.minutosGravados;
  }
}

export type EstadoDaMedalha = Medalha & {
  conquistada: boolean;
  atual: number;
  /** De 0 a 1. */
  fracao: number;
};

export function estadoDas(numeros: Numeros): EstadoDaMedalha[] {
  return MEDALHAS.map((m) => {
    const atual = Math.max(0, valorDe(m, numeros));
    return {
      ...m,
      atual,
      conquistada: atual >= m.meta,
      fracao: m.meta > 0 ? Math.min(1, atual / m.meta) : 0,
    };
  });
}

export const conquistadas = (numeros: Numeros): EstadoDaMedalha[] =>
  estadoDas(numeros).filter((m) => m.conquistada);

/**
 * A próxima a cair, para a tela mostrar um alvo em vez de uma parede.
 *
 * Escolhe a de maior fração entre as não conquistadas — a que está mais perto,
 * e não a mais fácil em números absolutos. "Faltam 2 dias" motiva; "faltam 1900
 * cartas" faz fechar a tela.
 */
export function proximaMedalha(numeros: Numeros): EstadoDaMedalha | null {
  const faltando = estadoDas(numeros).filter((m) => !m.conquistada);
  if (faltando.length === 0) return null;
  return faltando.reduce((melhor, m) => (m.fracao > melhor.fracao ? m : melhor));
}

/**
 * A cor de cada nível.
 *
 * Diamante é azul-claro e não branco: branco some no tema claro, e uma medalha
 * invisível justo no degrau mais difícil seria a pior troca possível.
 */
export const COR_DO_NIVEL: Record<NivelDeMedalha, string> = {
  bronze: '#B87333',
  prata: '#9AA0A6',
  ouro: '#F9AB00',
  diamante: '#4FC3F7',
};

/**
 * A moldura do perfil: o nível da melhor medalha conquistada.
 *
 * Nulo enquanto não houver nenhuma — um anel cinza em volta de todo mundo que
 * ainda não conquistou nada transforma "não comecei" em "sou o mais fraco".
 */
export function molduraDe(numeros: Numeros): NivelDeMedalha | null {
  const ganhas = conquistadas(numeros);
  if (ganhas.length === 0) return null;
  return ganhas.reduce((melhor, m) =>
    NIVEIS.indexOf(m.nivel) > NIVEIS.indexOf(melhor.nivel) ? m : melhor
  ).nivel;
}

/** Quantas de quantas, para o cabeçalho. */
export const placar = (numeros: Numeros) => ({
  ganhas: conquistadas(numeros).length,
  total: MEDALHAS.length,
});
