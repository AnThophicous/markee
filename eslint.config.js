// https://docs.expo.dev/guides/using-eslint/
const expo = require('eslint-config-expo/flat');

module.exports = [
  ...expo,
  {
    ignores: ['node_modules/**', 'android/**', 'ios/**', '.expo/**', 'scripts/**'],
  },
  {
    rules: {
      /**
       * Estas duas são o motivo de o linter existir aqui.
       *
       * `rules-of-hooks` pega hook dentro de condição ou depois de um `return`
       * antecipado. Em produção isso vira "Rendered fewer hooks than expected"
       * e derruba a tela — e só acontece no caminho específico que dispara a
       * condição, que é exatamente o padrão de "quebra quando eu faço X".
       *
       * `exhaustive-deps` fica em aviso: dependência faltando costuma dar valor
       * velho, não queda, e transformar em erro travaria o build por causa dos
       * casos em que a omissão é deliberada (já existem alguns, comentados).
       */
      'react-hooks/rules-of-hooks': 'error',

      /**
       * Desligada, e não é preguiça: as 12 ocorrências eram todas
       * `sharedValue.value = ...` do Reanimated, dentro de gesto ou de
       * onPressIn. Shared value é mutável por projeto — é assim que a animação
       * roda na thread de UI sem passar pelo React. A regra vem do React
       * Compiler e não sabe distinguir isso de estado comum, então marca uso
       * correto como erro. Mantida ligada, ela treinaria a gente a ignorar o
       * linter, que é pior do que não ter linter.
       */
      'react-hooks/immutability': 'off',

      // As três abaixo apontam defeito de verdade, mas de comportamento
      // (valor velho, render em cascata), não de queda. Ficam em aviso para não
      // travar o build por algo que não fecha o app.
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
