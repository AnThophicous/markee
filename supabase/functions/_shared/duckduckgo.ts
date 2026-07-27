/**
 * Busca na web via DuckDuckGo, sem chave de API.
 *
 * Roda no servidor, e não no celular, por dois motivos:
 *   1. Privacidade — buscar direto do aparelho entregaria o IP de quem
 *      perguntou ao mecanismo de busca, a cada pergunta.
 *   2. O endpoint devolve HTML, e raspar HTML no cliente esbarra em CORS.
 *
 * O endpoint `html.duckduckgo.com/html/` é a versão sem JavaScript, feita para
 * navegadores antigos. É estável, mas continua sendo HTML de terceiro: se a
 * marcação mudar, a extração devolve vazio em vez de quebrar.
 */

export type SearchResult = { title: string; url: string; snippet: string };

const ENDPOINT = 'https://html.duckduckgo.com/html/';
const MAX_RESULTS = 5;
const TIMEOUT_MS = 12_000;

/** Desfaz entidades HTML e tira as tags que sobram nos trechos. */
function clean(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * O DuckDuckGo embrulha os links num redirecionador
 * (`//duckduckgo.com/l/?uddg=<url-codificada>`); aqui devolvemos o destino real.
 */
function realUrl(href: string): string {
  const match = href.match(/[?&]uddg=([^&]+)/);
  if (match) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return href;
    }
  }
  return href.startsWith('//') ? 'https:' + href : href;
}

export async function search(query: string): Promise<SearchResult[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // Sem um user-agent de navegador a resposta vem vazia.
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      },
      body: new URLSearchParams({ q: query, kl: 'br-pt' }).toString(),
      signal: controller.signal,
    });

    if (!response.ok) return [];

    const html = await response.text();
    const results: SearchResult[] = [];

    // Cada resultado é um <a class="result__a" href="...">título</a> seguido,
    // mais adiante, de um <a class="result__snippet">trecho</a>.
    const blocks = html.split('result__body').slice(1);

    for (const block of blocks) {
      if (results.length >= MAX_RESULTS) break;

      const link = block.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      if (!link) continue;

      const snippet = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);

      const title = clean(link[2]);
      if (!title) continue;

      results.push({
        title,
        url: realUrl(link[1]),
        snippet: snippet ? clean(snippet[1]) : '',
      });
    }

    return results;
  } catch {
    // Tempo esgotado ou rede fora: quem chama trata como "sem resultado".
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Formato que vai para o modelo — curto, numerado e com a fonte. */
export function formatResults(query: string, results: SearchResult[]): string {
  if (results.length === 0) {
    return `A busca por "${query}" não retornou resultados.`;
  }

  return (
    `Resultados para "${query}":\n\n` +
    results
      .map((result, index) => {
        const snippet = result.snippet.length > 300 ? result.snippet.slice(0, 300) + '…' : result.snippet;
        return `${index + 1}. ${result.title}\n   ${snippet}\n   Fonte: ${result.url}`;
      })
      .join('\n\n')
  );
}
