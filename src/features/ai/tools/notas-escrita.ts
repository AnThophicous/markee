/**
 * As ferramentas com que a IA MEXE na nota.
 *
 * As quatro que existiam antes só liam: buscar, calcular, procurar nas notas,
 * dizer a data. Estas mudam o caderno de alguém, e é uma diferença de espécie,
 * não de grau — uma busca errada é um parágrafo que se apaga; uma reorganização
 * errada é a aula de ontem embaralhada, sem desfazer.
 *
 * POR ISSO NADA AQUI ESCREVE. Cada ferramenta devolve uma MUDANÇA PROPOSTA, em
 * português, e quem aplica é a pessoa com um toque. É mais chato de programar e
 * é a única forma honesta: o modelo acerta muito, não acerta sempre, e o custo
 * de errar recai sobre quem não estava olhando.
 *
 * Todo este arquivo é função pura sobre texto. Nem banco, nem rede, nem relógio
 * — o relógio entra por parâmetro. É o que permite testar o caso que mais
 * importa: o argumento vindo torto do modelo.
 */

export type MudancaNaNota =
  | { tipo: 'titulo'; titulo: string }
  | { tipo: 'tags'; tags: string[] }
  | { tipo: 'secao'; titulo: string; corpo: string }
  | { tipo: 'lembrete'; quando: number; texto: string }
  | { tipo: 'cartas'; pares: { frente: string; verso: string }[] }
  | { tipo: 'reorganizar'; conteudo: string };

export type ContextoDaNota = {
  titulo: string;
  conteudo: string;
  /** Injetado para o teste não depender do relógio da máquina. */
  agora?: number;
};

const LIMITE_DE_TITULO = 80;

/* ------------------------------------------------------------------ título */

export function proporTitulo(argumento: string): MudancaNaNota | null {
  // O modelo adora devolver o título entre aspas, com "Título:" na frente, ou
  // terminado em ponto. Nenhum dos três é um título.
  const limpo = argumento
    .trim()
    .replace(/^["'“”']+|["'“”']+$/g, '')
    .replace(/^t[ií]tulo\s*:\s*/i, '')
    .replace(/[.。]$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (limpo.length < 2 || limpo.length > LIMITE_DE_TITULO) return null;
  return { tipo: 'titulo', titulo: limpo };
}

/* -------------------------------------------------------------------- tags */

/**
 * As tags do app saem dos `#hashtag` escritos no corpo da nota — não há tabela
 * separada que a IA possa preencher. Então marcar uma tag é ACRESCENTAR texto,
 * e é por isso que esta função precisa do conteúdo atual: para não repetir uma
 * tag que já está lá.
 */
export function proporTags(argumento: string, contexto: ContextoDaNota): MudancaNaNota | null {
  const jaTem = new Set(
    (contexto.conteudo.match(/#[\p{L}\p{N}_-]+/gu) ?? []).map((t) => t.slice(1).toLowerCase())
  );

  const tags = argumento
    .split(/[,;\n]+/)
    .map((t) =>
      t
        .trim()
        .replace(/^#/, '')
        // Tag com espaço não existe: o extrator do app para no primeiro branco,
        // e "#prova de biologia" viraria a tag "prova" seguida de texto solto.
        .replace(/\s+/g, '-')
        .replace(/[^\p{L}\p{N}_-]/gu, '')
        .toLowerCase()
    )
    .filter((t) => t.length >= 2 && t.length <= 30 && !jaTem.has(t));

  const unicas = [...new Set(tags)].slice(0, 8);
  return unicas.length > 0 ? { tipo: 'tags', tags: unicas } : null;
}

/* ------------------------------------------------------------------- seção */

export function proporSecao(argumento: string): MudancaNaNota | null {
  // Formato pedido ao modelo: "Título | corpo da seção". A barra é separador
  // raro em texto de aula, ao contrário dos dois pontos.
  const [cabeca, ...resto] = argumento.split('|');
  const titulo = (cabeca ?? '').trim().replace(/^#+\s*/, '');
  const corpo = resto.join('|').trim();

  if (titulo.length < 2 || titulo.length > LIMITE_DE_TITULO) return null;
  if (corpo.length < 2) return null;
  return { tipo: 'secao', titulo, corpo };
}

/* ---------------------------------------------------------------- lembrete */

const DIAS_DA_SEMANA = [
  'domingo',
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
];

/**
 * A data do lembrete, aceitando o que o modelo realmente devolve.
 *
 * A ordem das tentativas importa: ISO primeiro, porque é o formato pedido e o
 * mais confiável; depois dd/mm; depois as palavras. Se a leitura por palavra
 * viesse antes, "amanhã" dentro de "amanhã, 12/08" ganharia da data explícita.
 */
export function proporLembrete(
  argumento: string,
  contexto: ContextoDaNota
): MudancaNaNota | null {
  const agora = contexto.agora ?? Date.now();
  const [dataBruta, ...textoResto] = argumento.split('|');
  const texto = textoResto.join('|').trim() || contexto.titulo.trim() || 'Lembrete';
  const bruto = (dataBruta ?? '').trim();

  const quando = lerData(bruto, agora);
  if (quando === null) return null;

  // Data no passado é quase sempre o modelo alucinando o ano, e um lembrete no
  // passado nunca dispara — ficaria gravado dando a impressão de estar armado.
  if (quando <= agora) return null;
  // Mais de dois anos à frente também é alucinação, e nesse caso a pessoa
  // esqueceria que existe muito antes de ele tocar.
  if (quando > agora + 2 * 365 * 24 * 60 * 60 * 1000) return null;

  return { tipo: 'lembrete', quando, texto: texto.slice(0, 120) };
}

function lerData(bruto: string, agora: number): number | null {
  const texto = bruto.toLowerCase();

  const iso = texto.match(/(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?/);
  if (iso) {
    return montar(+iso[1], +iso[2], +iso[3], iso[4] ? +iso[4] : 9, iso[5] ? +iso[5] : 0);
  }

  const br = texto.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:\s+(?:às?\s+)?(\d{1,2})[:h](\d{2})?)?/);
  if (br) {
    const ano = br[3] ? (br[3].length === 2 ? 2000 + +br[3] : +br[3]) : new Date(agora).getFullYear();
    return montar(ano, +br[2], +br[1], br[4] ? +br[4] : 9, br[5] ? +br[5] : 0);
  }

  const hora = texto.match(/(\d{1,2})[:h](\d{2})/);
  const h = hora ? +hora[1] : 9;
  const m = hora?.[2] ? +hora[2] : 0;

  // `\b` não serve aqui: em JavaScript ele se apoia em [A-Za-z0-9_], então
  // depois do "ã" de "amanhã" não existe fronteira nenhuma e /\bamanhã\b/ nunca
  // casa. A palavra mais usada em português para marcar prazo é justamente a
  // que a regex ingênua perde. O lookahead com \p{L} e a flag u resolvem.
  const sozinha = (palavra: string) => new RegExp(`(^|[^\\p{L}])${palavra}(?![\\p{L}])`, 'u');

  // "depois de amanhã" ANTES de "amanhã": a segunda casa dentro da primeira, e
  // testar na outra ordem marcaria o lembrete um dia cedo demais.
  if (sozinha('depois de amanh[ãa]').test(texto)) return comHora(agora, 2, h, m);
  if (sozinha('amanh[ãa]').test(texto)) return comHora(agora, 1, h, m);
  if (sozinha('hoje').test(texto)) return comHora(agora, 0, h, m);

  const semana = DIAS_DA_SEMANA.findIndex((d) => texto.includes(d));
  if (semana >= 0) {
    const atual = new Date(agora).getDay();
    // Sempre a PRÓXIMA ocorrência: "terça" numa terça significa a semana que
    // vem, não daqui a zero dias.
    const faltam = ((semana - atual + 7) % 7) || 7;
    return comHora(agora, faltam, h, m);
  }

  const emDias = texto.match(/em\s+(\d{1,3})\s+dias?/);
  if (emDias) return comHora(agora, +emDias[1], h, m);

  return null;
}

function montar(ano: number, mes: number, dia: number, hora: number, minuto: number): number | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || hora > 23 || minuto > 59) return null;
  const d = new Date(ano, mes - 1, dia, hora, minuto, 0, 0);
  // 31 de fevereiro vira 3 de março sozinho no Date. Conferir de volta é o que
  // separa "data válida" de "data que o JavaScript aceitou".
  if (d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
  return d.getTime();
}

function comHora(agora: number, maisDias: number, hora: number, minuto: number): number | null {
  if (hora > 23 || minuto > 59) return null;
  const d = new Date(agora);
  d.setDate(d.getDate() + maisDias);
  d.setHours(hora, minuto, 0, 0);
  return d.getTime();
}

/* ------------------------------------------------------------------ cartas */

export function proporCartas(argumento: string): MudancaNaNota | null {
  const pares = argumento
    .split('\n')
    .map((linha) => {
      const [frente, ...resto] = linha.split('|');
      return { frente: (frente ?? '').trim().replace(/^[-*\d.\s]+/, ''), verso: resto.join('|').trim() };
    })
    .filter((p) => p.frente.length >= 2 && p.verso.length >= 2)
    .slice(0, 20);

  return pares.length > 0 ? { tipo: 'cartas', pares } : null;
}

/* ------------------------------------------------------------- reorganizar */

export function proporReorganizacao(
  argumento: string,
  contexto: ContextoDaNota
): MudancaNaNota | null {
  const novo = argumento.trim();
  if (novo.length < 20) return null;

  // A peneira que importa: reorganizar é MOVER, não resumir. Uma resposta com
  // menos da metade do texto original é o modelo tendo resumido sem avisar, e
  // aplicar isso apagaria metade da aula com um toque de "aplicar".
  const antes = contexto.conteudo.trim().length;
  if (antes > 0 && novo.length < antes * 0.5) return null;
  if (novo === contexto.conteudo.trim()) return null;

  return { tipo: 'reorganizar', conteudo: novo };
}

/* ------------------------------------------------------ mostrar e aplicar */

/** O que vai acontecer, escrito para a pessoa ler ANTES de aprovar. */
export function descrever(mudanca: MudancaNaNota): string {
  switch (mudanca.tipo) {
    case 'titulo':
      return `Renomear para "${mudanca.titulo}"`;
    case 'tags':
      return `Marcar ${mudanca.tags.map((t) => `#${t}`).join(' ')}`;
    case 'secao':
      return `Acrescentar a seção "${mudanca.titulo}"`;
    case 'lembrete':
      return `Lembrar em ${new Date(mudanca.quando).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    case 'cartas':
      return mudanca.pares.length === 1
        ? 'Criar 1 carta de revisão'
        : `Criar ${mudanca.pares.length} cartas de revisão`;
    case 'reorganizar':
      return 'Reescrever a nota organizada em seções';
  }
}

/**
 * O conteúdo depois da mudança.
 *
 * Só as que mexem no CORPO da nota. Título, lembrete e cartas vão para outros
 * lugares e são aplicados por quem tem acesso a eles — esta função devolve o
 * conteúdo intocado nesses casos, em vez de nulo, para quem chama não precisar
 * decidir nada.
 */
export function aplicarNoConteudo(mudanca: MudancaNaNota, conteudo: string): string {
  switch (mudanca.tipo) {
    case 'tags': {
      const marcas = mudanca.tags.map((t) => `#${t}`).join(' ');
      const base = conteudo.replace(/\s+$/, '');
      return base ? `${base}\n\n${marcas}` : marcas;
    }
    case 'secao': {
      const base = conteudo.replace(/\s+$/, '');
      const bloco = `## ${mudanca.titulo}\n\n${mudanca.corpo}`;
      return base ? `${base}\n\n${bloco}` : bloco;
    }
    case 'reorganizar':
      return mudanca.conteudo;
    default:
      return conteudo;
  }
}
