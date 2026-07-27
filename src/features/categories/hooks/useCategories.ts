import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Category } from '@/types';
import {
  countNotesByCategory,
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '../services/categories.service';

const categoriesKey = ['categories'] as const;
const countsKey = ['categories', 'counts'] as const;

export function useCategories() {
  return useQuery({ queryKey: categoriesKey, queryFn: listCategories });
}

export function useCategoryCounts() {
  return useQuery({ queryKey: countsKey, queryFn: countNotesByCategory });
}

/**
 * Mexer em categoria muda a lista de notas junto: a etiqueta some do cartão, e
 * o filtro que estava ativo pode ter deixado de existir. Invalidar as duas
 * consultas evita a tela mostrar uma categoria já apagada.
 */
function useInvalidarCategorias() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: categoriesKey });
    queryClient.invalidateQueries({ queryKey: ['notes'] });
  };
}

export function useCreateCategory() {
  const invalidar = useInvalidarCategorias();
  return useMutation({
    mutationFn: (input: { name: string; color: string; icon: string }) => createCategory(input),
    onSuccess: invalidar,
  });
}

export function useUpdateCategory() {
  const invalidar = useInvalidarCategorias();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Pick<Category, 'name' | 'color' | 'icon'>> }) =>
      updateCategory(id, patch),
    onSuccess: invalidar,
  });
}

export function useDeleteCategory() {
  const invalidar = useInvalidarCategorias();
  return useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: invalidar,
  });
}
