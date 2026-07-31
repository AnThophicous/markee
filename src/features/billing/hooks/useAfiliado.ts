import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/features/auth/hooks/useSession';

import { carregarAfiliado, registrarIndicacao, resgatarComissao } from '../services/afiliado.service';

export function useAfiliado() {
  const { isSignedIn } = useSession();
  return useQuery({
    queryKey: ['afiliado'],
    queryFn: carregarAfiliado,
    enabled: isSignedIn,
    staleTime: 60 * 1000,
  });
}

export function useResgatar() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: resgatarComissao,
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: ['afiliado'] });
      // O resgate vira crédito. Sem esta linha, o saldo na tela de créditos
      // continuaria o de antes até alguém recarregar — e a pessoa acabou de ser
      // avisada de que ganhou crédito.
      //
      // A chave sem sufixo alcança `['creditos','saldo']` e
      // `['creditos','extrato']` de uma vez: o React Query casa por prefixo.
      void cliente.invalidateQueries({ queryKey: ['creditos'] });
    },
  });
}

export function useRegistrarIndicacao() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: registrarIndicacao,
    onSuccess: () => void cliente.invalidateQueries({ queryKey: ['afiliado'] }),
  });
}
