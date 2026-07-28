import { queryClient } from '@/services/queryClient';
import { supabase } from '@/services/supabase';

/**
 * Esvazia o cache quando a conta muda.
 *
 * O React Query guarda a resposta de cada consulta pela chave dela, e o cache
 * não sabe nada sobre quem estava logado quando aquilo foi buscado. Sair da
 * conta encerrava a sessão no Supabase e não encostava no cache — então a conta
 * seguinte abria o app vendo o que era da anterior, até cada consulta expirar e
 * ser buscada de novo.
 *
 * Foi assim que uma conta recém-criada apareceu como Pro: a chave `['usage']`
 * não leva o id de ninguém, o valor guardado dizia `pro` porque a conta antiga
 * era Pro, e o app mostrou o que tinha em mãos. O servidor sempre respondeu
 * `free` para a conta nova — quem estava errado era o cache.
 *
 * O selo de Pro é o sintoma visível e o menos grave. `['groups']` também não
 * leva id: a conta nova via a lista de grupos da anterior. Nomes de grupos de
 * outra pessoa na tela é coisa que não pode acontecer nem por um segundo.
 *
 * O corte é por MUDANÇA DE ID, e não pelo evento de logout. Trocar de conta
 * nem sempre passa por um `SIGNED_OUT` — dá para entrar direto por outro login
 * — e uma renovação de token dispara evento com a MESMA conta, quando limpar
 * seria só jogar fora trabalho já feito.
 */
export function instalarGuardaDeSessao(): () => void {
  // `undefined` = ainda não sabemos quem é; `null` = ninguém logado. A
  // diferença importa: na primeira leitura não há nada para limpar, e limpar
  // ali apagaria o que as telas acabaram de buscar durante a abertura.
  let idAnterior: string | null | undefined;

  const aplicar = (id: string | null) => {
    if (idAnterior === undefined) {
      idAnterior = id;
      return;
    }
    if (idAnterior === id) return;

    idAnterior = id;
    // `clear` e não `invalidateQueries`: invalidar marca como velho mas mantém
    // o valor na mão, e as telas continuariam desenhando o dado da conta
    // anterior enquanto a busca nova não volta. Aqui o certo é não ter nada.
    queryClient.clear();
  };

  supabase.auth
    .getSession()
    .then(({ data }) => aplicar(data.session?.user.id ?? null))
    .catch(() => undefined);

  const { data } = supabase.auth.onAuthStateChange((_evento, sessao) => {
    aplicar(sessao?.user.id ?? null);
  });

  return () => data.subscription.unsubscribe();
}
