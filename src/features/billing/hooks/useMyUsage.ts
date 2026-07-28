import { useQuery } from '@tanstack/react-query';

import { useSession } from '@/features/auth/hooks/useSession';
import { supabase } from '@/services/supabase';

export type UsageSummary = {
  plan: 'free' | 'pro';
  aiUsed: number;
  aiLimit: number;
  minUsed: number;
  minLimit: number;
};

/**
 * Plano e consumo do mês, vindos do servidor.
 *
 * Quem responde é a `my_usage`, que lê a assinatura ativa no banco. O app não
 * decide nada: não existe "virar Pro" no aparelho, e mexer no APK não muda o
 * que o servidor devolve — os gatilhos que cobram Pro conferem a assinatura por
 * conta própria, na hora de gravar.
 *
 * A chave leva o id de quem está logado. Sem isso, o valor guardado para uma
 * conta era servido para a seguinte: foi assim que uma conta recém-criada
 * apareceu como Pro, mostrando o `pro` que sobrou da conta anterior. O
 * `session-guard` esvazia o cache na troca de conta e já resolveria sozinho;
 * o id aqui é a segunda tranca, porque um selo de Pro errado é o sintoma
 * simpático de um problema que também servia lista de grupos trocada.
 */
export function useMyUsage(enabled = true) {
  const { user, isLoading: carregandoSessao } = useSession();

  return useQuery({
    queryKey: ['usage', user?.id ?? 'ninguem'],
    // Sem sessão não há o que perguntar, e perguntar assim mesmo devolveria o
    // plano de ninguém — que o `?? 'free'` lá embaixo transformaria em free e
    // guardaria no cache como se fosse resposta.
    enabled: enabled && !carregandoSessao && Boolean(user?.id),
    queryFn: async (): Promise<UsageSummary> => {
      const { data, error } = await supabase.rpc('my_usage');
      if (error) throw new Error(error.message);

      const row = Array.isArray(data) ? data[0] : data;
      return {
        plan: (row?.plan ?? 'free') as 'free' | 'pro',
        aiUsed: Number(row?.ai_used ?? 0),
        aiLimit: Number(row?.ai_limit ?? 0),
        minUsed: Number(row?.min_used ?? 0),
        minLimit: Number(row?.min_limit ?? 0),
      };
    },
  });
}

/**
 * `isPro` é falso enquanto a resposta não chega.
 *
 * O padrão tem de ser o plano de baixo: verdadeiro por omissão mostraria o selo
 * e liberaria os controles pagos por um instante a cada abertura, e a pessoa
 * escolheria um gradiente que o servidor recusaria em seguida.
 */
export function useIsPro(enabled = true) {
  const query = useMyUsage(enabled);
  return { ...query, isPro: query.data?.plan === 'pro' };
}
