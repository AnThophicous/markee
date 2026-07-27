import { parseMarkdown } from '../utils/markdown-parser';

/**
 * Modelo do editor por blocos.
 *
 * A nota continua sendo guardada como markdown, e não como uma estrutura
 * própria. Isso não é apego a formato: a busca do app indexa o texto da nota, a
 * exportação entrega um .md, a IA lê esse mesmo texto e quem abrir o arquivo em
 * qualquer outro editor precisa entender o que está lá. Trocar por um formato
 * particular quebraria as quatro coisas de uma vez e prenderia as notas dentro
 * do app.
 *
 * Então o editor converte markdown em blocos ao abrir e blocos em markdown ao
 * salvar. O que muda é só a interface: a pessoa nunca mais vê `#` ou `- [ ]` na
 * tela — vê um título que parece um título e uma tarefa com caixa de marcar.
 *
 * O par de funções precisa ser estável: converter para blocos e voltar tem que
 * devolver o mesmo texto, senão a nota muda sozinha a cada vez que é aberta.
 * É a propriedade mais testada em blocks-test.js.
 */

export type TipoBloco =
  | 'texto'
  | 'titulo'
  | 'subtitulo'
  | 'lista'
  | 'numerada'
  | 'tarefa'
  | 'citacao'
  | 'codigo'
  | 'divisor'
  | 'imagem'
  | 'grafico'
  | 'tabela';

export type PontoGrafico = { rotulo: string; valor: number };

export type DadosGrafico = {
  tipo: 'barra' | 'linha' | 'pizza';
  titulo: string;
  dados: PontoGrafico[];
};

export type Bloco = {
  /** Só existe em memória. É o que dá chave estável ao React e permite focar o bloco certo. */
  id: string;
  tipo: TipoBloco;
  texto: string;
  /** Tarefa marcada. */
  marcado?: boolean;
  /** Imagem. */
  url?: string;
  /** Gráfico já decodificado; volta a virar JSON na serialização. */
  grafico?: DadosGrafico;
  /** Tabela: primeira linha é o cabeçalho. */
  linhas?: string[][];
};

let proximoId = 0;

/**
 * Contador simples em vez de UUID: o id nunca é gravado nem sai deste módulo,
 * serve só para o React não embaralhar as linhas enquanto se digita.
 */
export function novoId(): string {
  proximoId += 1;
  return `b${proximoId}`;
}

export function criarBloco(tipo: TipoBloco = 'texto', texto = ''): Bloco {
  const bloco: Bloco = { id: novoId(), tipo, texto };

  if (tipo === 'tarefa') bloco.marcado = false;
  if (tipo === 'tabela') bloco.linhas = [['', ''], ['', '']];
  if (tipo === 'grafico') {
    bloco.grafico = { tipo: 'barra', titulo: '', dados: [{ rotulo: '', valor: 0 }] };
  }

  return bloco;
}

/** Tipos que a pessoa digita dentro. Os outros são editados por controles próprios. */
export const TIPOS_DE_TEXTO: TipoBloco[] = [
  'texto',
  'titulo',
  'subtitulo',
  'lista',
  'numerada',
  'tarefa',
  'citacao',
  'codigo',
];

export function ehDeTexto(tipo: TipoBloco): boolean {
  return TIPOS_DE_TEXTO.includes(tipo);
}

const LINGUAGEM_GRAFICO = 'grafico';

/* ------------------------------------------------------------------ leitura */

export function paraBlocos(markdown: string): Bloco[] {
  const analisados = parseMarkdown(markdown ?? '');
  const blocos: Bloco[] = [];

  for (const item of analisados) {
    switch (item.type) {
      case 'heading':
        blocos.push({
          id: novoId(),
          // O markdown tem três níveis; o editor oferece dois. Nível 3 cai em
          // subtítulo em vez de virar parágrafo, que perderia o destaque.
          tipo: item.level === 1 ? 'titulo' : 'subtitulo',
          texto: item.text,
        });
        break;

      case 'quote':
        blocos.push({ id: novoId(), tipo: 'citacao', texto: item.text });
        break;

      case 'checklist':
        blocos.push({ id: novoId(), tipo: 'tarefa', texto: item.text, marcado: item.checked });
        break;

      case 'bullet':
        blocos.push({ id: novoId(), tipo: 'lista', texto: item.text });
        break;

      case 'numbered':
        blocos.push({ id: novoId(), tipo: 'numerada', texto: item.text });
        break;

      case 'code': {
        if (item.lang === LINGUAGEM_GRAFICO) {
          const grafico = lerGrafico(item.lines.join('\n'));
          // JSON estragado vira bloco de código comum em vez de sumir: perder
          // conteúdo da pessoa é pior do que mostrar o dado cru.
          if (grafico) {
            blocos.push({ id: novoId(), tipo: 'grafico', texto: '', grafico });
            break;
          }
        }
        blocos.push({ id: novoId(), tipo: 'codigo', texto: item.lines.join('\n') });
        break;
      }

      case 'table':
        blocos.push({
          id: novoId(),
          tipo: 'tabela',
          texto: '',
          linhas: item.rows.length > 0 ? item.rows : [['', '']],
        });
        break;

      case 'image':
        blocos.push({ id: novoId(), tipo: 'imagem', texto: item.alt, url: item.url });
        break;

      case 'hr':
        blocos.push({ id: novoId(), tipo: 'divisor', texto: '' });
        break;

      case 'blank':
        // Linha em branco não vira bloco: no editor por blocos o espaçamento é
        // do layout. Mantê-las criaria blocos vazios que a pessoa teria de
        // apagar um a um, e eles se multiplicariam a cada ida e volta.
        break;

      default:
        blocos.push({ id: novoId(), tipo: 'texto', texto: item.text });
        break;
    }
  }

  // Nota vazia ainda precisa de uma linha para receber o cursor.
  return blocos.length > 0 ? blocos : [criarBloco('texto')];
}

/**
 * Exportada porque o modo de leitura também precisa dela: lá o gráfico é lido
 * direto do markdown, sem passar pelo modelo de blocos do editor.
 */
export function lerGrafico(cru: string): DadosGrafico | null {
  try {
    const dado = JSON.parse(cru);
    if (!dado || typeof dado !== 'object') return null;

    const tipo = dado.tipo === 'linha' || dado.tipo === 'pizza' ? dado.tipo : 'barra';
    const pontos = Array.isArray(dado.dados) ? dado.dados : [];

    return {
      tipo,
      titulo: typeof dado.titulo === 'string' ? dado.titulo : '',
      dados: pontos
        .filter((p: unknown) => p && typeof p === 'object')
        .map((p: { rotulo?: unknown; valor?: unknown }) => ({
          rotulo: typeof p.rotulo === 'string' ? p.rotulo : '',
          // Number(null) é 0 e Number(undefined) é NaN; o guarda cobre os dois,
          // e um NaN aqui viraria barra de altura inválida lá na frente.
          valor: Number.isFinite(Number(p.valor)) ? Number(p.valor) : 0,
        })),
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ escrita */

export function paraMarkdown(blocos: Bloco[]): string {
  const linhas: string[] = [];
  let numero = 0;

  for (const bloco of blocos) {
    // A numeração reinicia quando a sequência é interrompida, para uma segunda
    // lista na mesma nota não continuar de onde a primeira parou.
    if (bloco.tipo !== 'numerada') numero = 0;

    switch (bloco.tipo) {
      case 'titulo':
        linhas.push(`# ${bloco.texto}`);
        break;
      case 'subtitulo':
        linhas.push(`## ${bloco.texto}`);
        break;
      case 'lista':
        linhas.push(`- ${bloco.texto}`);
        break;
      case 'numerada':
        numero += 1;
        linhas.push(`${numero}. ${bloco.texto}`);
        break;
      case 'tarefa':
        linhas.push(`- [${bloco.marcado ? 'x' : ' '}] ${bloco.texto}`);
        break;
      case 'citacao':
        linhas.push(`> ${bloco.texto}`);
        break;
      case 'codigo':
        linhas.push('```', ...bloco.texto.split('\n'), '```');
        break;
      case 'divisor':
        linhas.push('---');
        break;
      case 'imagem':
        linhas.push(`![${bloco.texto}](${bloco.url ?? ''})`);
        break;
      case 'grafico':
        linhas.push(
          '```' + LINGUAGEM_GRAFICO,
          JSON.stringify(bloco.grafico ?? { tipo: 'barra', titulo: '', dados: [] }),
          '```'
        );
        break;
      case 'tabela': {
        const linhasTabela = bloco.linhas ?? [];
        if (linhasTabela.length === 0) break;

        linhasTabela.forEach((linha, indice) => {
          linhas.push(`| ${linha.join(' | ')} |`);
          // O markdown exige a régua logo abaixo do cabeçalho; sem ela a tabela
          // não é reconhecida como tabela ao ser lida de volta.
          if (indice === 0) linhas.push(`| ${linha.map(() => '---').join(' | ')} |`);
        });
        break;
      }
      default:
        linhas.push(bloco.texto);
        break;
    }
  }

  return linhas.join('\n');
}
