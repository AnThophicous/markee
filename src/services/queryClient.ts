import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { avisar, emPortugues } from './avisos';
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
 * A GRAVAÇÃO também avisa na tela, e não só no registro. O motivo é um defeito
 * de classe encontrado depois de "nem dá para apagar grupo": 53 chamadas de
 * gravação no app não tratavam erro nenhum, então qualquer recusa do servidor
 * sumia sem nada acontecer. Consertar uma a uma seria 53 remendos, e a 54ª
 * nasceria igual. Aqui passa toda gravação que existe.
 *
 * A CONSULTA não avisa: uma tela que não carregou já mostra isso por conta
 * própria, com lista vazia ou girando, e uma faixa vermelha a cada perda de
 * rede momentânea seria barulho constante.
 *
 * Quem quiser tratar o erro no lugar certo continua podendo: um `onError`
 * próprio não substitui este, ele soma.
 *
 * O `meta: { silencioso: true }` cala a faixa numa gravação específica. Hoje
 * ninguém usa: a repetição do salvamento automático, que era o caso previsto,
 * já é contida pela deduplicação do `avisar` — a mesma frase não reaparece
 * enquanto está na tela. Fica disponível para quando aparecer uma gravação
 * repetida cujo erro não valha interromper ninguém.
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

      if (!mutacao.options.meta?.silencioso) {
        avisar(emPortugues(erro.message));
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 0,
    },
  },
});
