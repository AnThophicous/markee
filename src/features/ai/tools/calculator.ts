/**
 * Calculadora para a IA.
 *
 * Escrita como um analisador recursivo, e NUNCA com `eval` ou `new Function`.
 * A expressão aqui vem do modelo de linguagem, que por sua vez pode estar
 * repetindo algo que veio de uma nota ou de uma página da internet — ou seja,
 * é entrada de terceiros. `eval` nisso seria executar código arbitrário dentro
 * do aplicativo, com acesso a tudo.
 *
 * Gramática (precedência de cima para baixo):
 *   expressão := termo (('+' | '-') termo)*
 *   termo     := potência (('*' | '/' | '%') potência)*
 *   potência  := unário ('^' potência)?          -- associativo à direita
 *   unário    := ('-' | '+')? primário
 *   primário  := número | '(' expressão ')' | função '(' expressão ')' | constante
 */

const FUNCTIONS: Record<string, (value: number) => number> = {
  raiz: Math.sqrt,
  sqrt: Math.sqrt,
  abs: Math.abs,
  sen: Math.sin,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  tg: Math.tan,
  log: Math.log10,
  ln: Math.log,
  arredondar: Math.round,
  round: Math.round,
  teto: Math.ceil,
  piso: Math.floor,
};

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
};

class Parser {
  private pos = 0;

  constructor(private readonly input: string) {}

  parse(): number {
    const value = this.expression();
    this.skipSpaces();
    if (this.pos < this.input.length) {
      throw new Error(`Não entendi a partir de "${this.input.slice(this.pos, this.pos + 12)}"`);
    }
    return value;
  }

  private skipSpaces() {
    while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) this.pos += 1;
  }

  private peek(): string {
    this.skipSpaces();
    return this.input[this.pos] ?? '';
  }

  private eat(char: string): boolean {
    if (this.peek() === char) {
      this.pos += 1;
      return true;
    }
    return false;
  }

  private expression(): number {
    let value = this.term();
    for (;;) {
      if (this.eat('+')) value += this.term();
      else if (this.eat('-')) value -= this.term();
      else return value;
    }
  }

  private term(): number {
    let value = this.power();
    for (;;) {
      if (this.eat('*') || this.eat('×')) {
        value *= this.power();
      } else if (this.eat('/') || this.eat('÷')) {
        const divisor = this.power();
        if (divisor === 0) throw new Error('Divisão por zero.');
        value /= divisor;
      } else if (this.eat('%')) {
        const divisor = this.power();
        if (divisor === 0) throw new Error('Divisão por zero.');
        value %= divisor;
      } else {
        return value;
      }
    }
  }

  private power(): number {
    const base = this.unary();
    // Associativo à direita: 2^3^2 é 2^(3^2), não (2^3)^2.
    if (this.eat('^')) return base ** this.power();
    return base;
  }

  private unary(): number {
    if (this.eat('-')) return -this.unary();
    if (this.eat('+')) return this.unary();
    return this.primary();
  }

  private primary(): number {
    this.skipSpaces();

    if (this.eat('(')) {
      const value = this.expression();
      if (!this.eat(')')) throw new Error('Faltou fechar um parêntese.');
      return value;
    }

    const number = /^\d+(?:[.,]\d+)?/.exec(this.input.slice(this.pos));
    if (number) {
      this.pos += number[0].length;
      return Number(number[0].replace(',', '.'));
    }

    const word = /^[a-zA-ZÀ-ú]+/.exec(this.input.slice(this.pos));
    if (word) {
      const name = word[0].toLowerCase();
      this.pos += word[0].length;

      if (name in CONSTANTS) return CONSTANTS[name];

      const fn = FUNCTIONS[name];
      if (!fn) throw new Error(`Não conheço "${word[0]}".`);
      if (!this.eat('(')) throw new Error(`Faltou "(" depois de ${word[0]}.`);
      const argument = this.expression();
      if (!this.eat(')')) throw new Error('Faltou fechar um parêntese.');
      return fn(argument);
    }

    throw new Error('Expressão incompleta.');
  }
}

/** Avalia a expressão e devolve o resultado formatado, ou lança com o motivo. */
export function calculate(expression: string): string {
  const cleaned = expression.trim();
  if (!cleaned) throw new Error('Nada para calcular.');
  if (cleaned.length > 500) throw new Error('Expressão longa demais.');

  const value = new Parser(cleaned).parse();

  if (!Number.isFinite(value)) throw new Error('O resultado não é um número válido.');

  // Corta o lixo de ponto flutuante (0.1 + 0.2) sem virar notação científica
  // para números do dia a dia.
  const rounded = Math.round(value * 1e10) / 1e10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}
