/**
 * O programa de afiliados, do lado do aplicativo.
 *
 * Só formatação e texto. NENHUM cálculo de dinheiro acontece aqui, e isso não é
 * organização — é a regra que segura o programa de pé: valor de comissão, saldo
 * e resgate vêm inteiros do servidor, calculados por ele. O aplicativo mostra.
 *
 * O motivo é o de sempre neste app: o código é aberto e a chave publicável está
 * dentro do APK. Se o saldo fosse somado aqui e enviado, bastaria trocar um
 * número. Como o servidor é quem soma — a partir de compras que a loja
 * confirmou —, um APK modificado consegue exibir "R$ 900,00" na tela dele e
 * receber exatamente zero.
 */

export const LINK_BASE = 'https://markee.app';

/** O link que a pessoa espalha. */
export const linkDeAfiliado = (codigo: string): string => `${LINK_BASE}/i/${codigo}`;

/** O mesmo destino, mas abrindo direto no app de quem já tem instalado. */
export const linkDeAppDeAfiliado = (codigo: string): string => `markee://add/a/${codigo}`;

const CODIGO = /^[0-9a-f]{8}$/i;

/**
 * Entende as formas em que o código chega: link do site, link do app, ou o
 * código digitado. Devolve nulo se não reconhecer — nunca chuta, porque chutar
 * aqui manda uma comissão para a pessoa errada.
 */
export function lerCodigoDeAfiliado(entrada: string): string | null {
  const valor = entrada.trim();

  const link = valor.match(/^(?:markee:\/\/(?:add\/)?a\/|https?:\/\/[^/]+\/i\/)([0-9a-f]{8})/i);
  if (link) return link[1].toLowerCase();

  if (CODIGO.test(valor)) return valor.toLowerCase();
  return null;
}

/**
 * O texto do convite, pronto para colar no WhatsApp.
 *
 * Curto porque link comprido some no meio de texto comprido, e sem promessa de
 * ganho para quem clica: quem recebe não ganha nada por vir pelo link, e dizer
 * o contrário seria mentira que descobre sozinha na primeira tela.
 */
export function textoDoConvite(codigo: string): string {
  return (
    'Tô usando o Markee pra estudar — notas, gravação de aula e revisão espaçada num app só.\n\n' +
    linkDeAfiliado(codigo)
  );
}

export type Afiliado = {
  codigo: string;
  indicados: number;
  assinantes: number;
  totalCents: number;
  abertoCents: number;
  minimoCents: number;
  primeiraPct: number;
  recorrentePct: number;
  janelaDias: number;
  fuiIndicado: boolean;
  /** Quantos créditos vale um centavo de comissão, para a prévia do resgate. */
  porCredito: number;
};

/** Centavos em reais, para exibir. */
export const emReais = (centavos: number): string =>
  `R$ ${(centavos / 100).toFixed(2).replace('.', ',')}`;

export const emPorcento = (fracao: number): string => `${Math.round(fracao * 100)}%`;

/**
 * Quanto ainda falta para poder resgatar.
 *
 * Zero quer dizer "já dá". A tela usa isso para escolher entre o botão e a
 * frase do que falta — dizer "faltam R$ 3,10" é muito melhor do que um botão
 * desabilitado sem explicação, que a pessoa toca três vezes antes de desistir.
 */
export const faltaParaResgatar = (aberto: number, minimo: number): number =>
  Math.max(0, minimo - aberto);

/** Quantos créditos sairiam do resgate de agora. */
export const creditosDoResgate = (abertoCents: number, porCredito: number): number =>
  Math.floor(abertoCents * porCredito);

/**
 * Traduz o erro cru do servidor.
 *
 * O prefixo `AFILIADO:` é o combinado com as funções do banco, do mesmo jeito
 * que `PRO_REQUIRED:` é o combinado da validação de tema. Sem isto, a pessoa
 * veria a mensagem do Postgres na tela.
 */
export function descreverErroDeAfiliado(mensagem: string): string | null {
  const achado = mensagem.match(/AFILIADO:(\w+)(?::(\d+))?/);
  if (!achado) return null;

  switch (achado[1]) {
    case 'ja_indicado':
      return 'Sua conta já tem uma indicação registrada, e ela não muda.';
    case 'tarde_demais':
      return 'O código de indicação só vale nos primeiros dias de uma conta nova.';
    case 'codigo_invalido':
      return 'Esse código não existe.';
    case 'voce_mesmo':
      return 'Esse é o seu próprio código.';
    case 'abaixo_do_minimo':
      return achado[2]
        ? `O resgate mínimo é ${emReais(Number(achado[2]))}.`
        : 'Ainda não deu o mínimo para resgatar.';
    default:
      return 'Não deu para registrar a indicação.';
  }
}
