import { useQuery } from '@tanstack/react-query';

import { carregarEmblemasDoGrupo, carregarEmblemasDoPerfil } from '../services/emblemas.service';

/**
 * Cinco minutos de validade.
 *
 * O cálculo varre mensagens, publicações e curtidas do grupo inteiro — não é
 * caro, mas também não é de graça, e nada disso muda de segundo em segundo.
 * Ninguém liga de o emblema de "100 mensagens" aparecer cinco minutos depois da
 * centésima; todo mundo ligaria se abrir a lista de membros ficasse lento.
 */
const VALIDADE = 5 * 60 * 1000;

export function useEmblemasDoGrupo(groupId: string | undefined) {
  return useQuery({
    queryKey: ['emblemas', 'grupo', groupId],
    queryFn: () => carregarEmblemasDoGrupo(groupId!),
    enabled: Boolean(groupId),
    staleTime: VALIDADE,
  });
}

export function useEmblemasDoPerfil(userId: string | undefined) {
  return useQuery({
    queryKey: ['emblemas', 'perfil', userId],
    queryFn: () => carregarEmblemasDoPerfil(userId!),
    enabled: Boolean(userId),
    staleTime: VALIDADE,
  });
}
