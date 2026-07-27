#!/usr/bin/env node
/**
 * Impede que saia um APK sem o endereço do servidor gravado dentro.
 *
 * Isto já aconteceu de verdade: o build passava, o APK era publicado, e ele
 * fechava sozinho na primeira tela. O motivo é que `process.env.EXPO_PUBLIC_*`
 * NÃO é lido quando o app abre — o babel-preset-expo troca a expressão pelo
 * valor literal durante a compilação (plugins/inline-env-vars.js, ramo
 * `isProduction`). Se a variável não estiver presente nesse instante, o que fica
 * gravado é `undefined`, para sempre, naquele arquivo.
 *
 * O erro era invisível porque as variáveis estavam declaradas no passo errado do
 * fluxo: no `expo prebuild`, que só gera a pasta android/, e não no `gradlew`,
 * que é quem de fato empacota o JavaScript.
 *
 * Conferir `process.env` aqui não bastaria — provaria apenas que a variável
 * existe neste processo, não que ela chega ao pacote. Então o teste compila o
 * arquivo real, do mesmo jeito que o build de produção compila, e procura o
 * valor no resultado.
 */
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

const RAIZ = path.join(__dirname, '..');
const ARQUIVO = path.join(RAIZ, 'src/services/supabase.ts');

const OBRIGATORIAS = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];

let falhas = 0;
const falhar = (mensagem) => {
  console.error(`  ✗ ${mensagem}`);
  falhas++;
};
const passar = (mensagem) => console.log(`  ✓ ${mensagem}`);

console.log('\nConferindo as variáveis que vão para dentro do pacote\n');

for (const nome of OBRIGATORIAS) {
  const valor = process.env[nome];
  if (!valor) {
    falhar(`${nome} está vazia`);
  } else if (/^(undefined|null|SEU-PROJETO|\.\.\.)$/i.test(valor)) {
    falhar(`${nome} tem um valor de exemplo: ${valor}`);
  } else {
    // Nunca imprimir o valor: o registro do build é público.
    passar(`${nome} definida (${valor.length} caracteres)`);
  }
}

if (falhas === 0) {
  // O mesmo caminho do build de release: `isDev: false` liga o ramo que grava o
  // literal. Com `isDev: true` o preset gera uma referência tardia e o teste
  // passaria sem provar nada.
  const { code } = babel.transformSync(fs.readFileSync(ARQUIVO, 'utf8'), {
    filename: ARQUIVO,
    presets: ['babel-preset-expo'],
    caller: { name: 'metro', platform: 'android', isDev: false, supportsStaticESM: true },
    babelrc: false,
    configFile: false,
  });

  // Lê o que ficou gravado na declaração. Procurar o valor solto no arquivo
  // inteiro seria frouxo — ele poderia aparecer num comentário. Aqui a pergunta
  // é exatamente a que importa: o que esta variável vale no APK?
  const gravado = (nome) => {
    const achado = code.match(new RegExp(`${nome}\\s*=\\s*("[^"]*"|'[^']*'|undefined)`));
    return achado ? achado[1].replace(/^["']|["']$/g, '') : null;
  };

  const conferir = (variavel, nomeEnv, rotulo) => {
    const esperado = process.env[nomeEnv];
    const obtido = gravado(variavel);

    if (obtido === null) {
      falhar(`não achei a declaração de ${variavel} no código compilado`);
    } else if (obtido === 'undefined') {
      falhar(`${rotulo}: ficou como undefined — este APK fecharia ao abrir`);
    } else if (obtido !== esperado) {
      falhar(`${rotulo}: valor diferente do esperado`);
    } else {
      passar(`${rotulo}: presente no código compilado`);
    }
  };

  conferir('supabaseUrl', 'EXPO_PUBLIC_SUPABASE_URL', 'endereço do servidor');
  conferir('supabaseKey', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'chave publicável');
}

console.log('');
if (falhas > 0) {
  console.error(`${falhas} problema(s). O APK sairia quebrado — build interrompido.\n`);
  process.exit(1);
}
console.log('Tudo certo: o pacote vai sair com o servidor configurado.\n');
