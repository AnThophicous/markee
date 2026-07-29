import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  apagarCarta,
  cartasDaNota,
  criarCartas,
  filaDeHoje,
  responderCarta,
  resumoDaFila,
  suspenderCarta,
  type CartaDeRevisao,
} from '../services/cards.service';
import type { Resposta } from '../sm2';

export const chavesDeRevisao = {
  todas: ['cartas'] as const,
  fila: () => ['cartas', 'fila'] as const,
  resumo: () => ['cartas', 'resumo'] as const,
  daNota: (noteId: string) => ['cartas', 'nota', noteId] as const,
};

/**
 * A fila é carregada UMA vez por sessão de revisão.
 *
 * `staleTime: Infinity` é de propósito: responder uma carta muda o vencimento
 * dela, e uma fila que se recarrega sozinha faria a carta sumir do meio da
 * sessão, embaralhando a ordem debaixo do dedo de quem está revisando. A tela
 * percorre a lista que recebeu e só busca de novo quando a sessão acaba.
 */
export function useFilaDeHoje(limite = 20) {
  return useQuery({
    queryKey: chavesDeRevisao.fila(),
    queryFn: () => filaDeHoje(limite),
    staleTime: Infinity,
    gcTime: 0,
  });
}

export function useResumoDaFila() {
  return useQuery({ queryKey: chavesDeRevisao.resumo(), queryFn: resumoDaFila });
}

export function useCartasDaNota(noteId: string) {
  return useQuery({
    queryKey: chavesDeRevisao.daNota(noteId),
    queryFn: () => cartasDaNota(noteId),
    enabled: Boolean(noteId),
  });
}

export function useResponderCarta() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({ carta, resposta }: { carta: CartaDeRevisao; resposta: Resposta }) =>
      responderCarta(carta, resposta),
    // Só o resumo e a estatística são invalidados; a fila NÃO, pelo motivo do
    // `staleTime` acima.
    onSuccess: () => {
      cliente.invalidateQueries({ queryKey: chavesDeRevisao.resumo() });
      cliente.invalidateQueries({ queryKey: ['painel'] });
    },
  });
}

export function useCriarCartas(noteId: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (pares: { frente: string; verso: string }[]) => criarCartas(noteId, pares),
    onSuccess: () => {
      cliente.invalidateQueries({ queryKey: chavesDeRevisao.daNota(noteId) });
      cliente.invalidateQueries({ queryKey: chavesDeRevisao.resumo() });
    },
  });
}

export function useMexerNaCarta(noteId: string) {
  const cliente = useQueryClient();
  const atualizar = () => {
    cliente.invalidateQueries({ queryKey: chavesDeRevisao.daNota(noteId) });
    cliente.invalidateQueries({ queryKey: chavesDeRevisao.resumo() });
  };

  return {
    apagar: useMutation({ mutationFn: apagarCarta, onSuccess: atualizar }),
    suspender: useMutation({
      mutationFn: ({ id, suspensa }: { id: string; suspensa: boolean }) =>
        suspenderCarta(id, suspensa),
      onSuccess: atualizar,
    }),
  };
}
