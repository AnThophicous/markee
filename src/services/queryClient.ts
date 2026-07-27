import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { anotarQueda } from './crash-reporter';

/**
 * Os dois caches recebem um `onError` global porque, sem ele, um erro de
 * consulta ou de gravação some.
 *
 * O React Query captura a exceção e guarda em `.error` — o app não cai, mas
 * também não conta nada. Para quem está usando, isso aparece como "toquei e não
 * aconteceu nada", que é indistinguível de travamento e igualmente grave.
 *
 * Aqui esses erros passam a ser registrados como não-fatais, e aparecem na tela
 * de Diagnóstico junto com as quedas de verdade. É o que permite descobrir, por
 * exemplo, que salvar a nota está falhando em silêncio há dias.
 *
 * Só registra; não mostra nada. Cada tela continua responsável por explicar a
 * falha à pessoa no lugar certo.
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (erro, consulta) => {
      anotarQueda(new Error(`Consulta [${String(consulta.queryKey)}]: ${erro.message}`), false);
    },
  }),
  mutationCache: new MutationCache({
    onError: (erro, _variaveis, _contexto, mutacao) => {
      const nome = mutacao.options.mutationKey
        ? String(mutacao.options.mutationKey)
        : 'sem nome';
      anotarQueda(new Error(`Gravação [${nome}]: ${erro.message}`), false);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 0,
    },
  },
});
