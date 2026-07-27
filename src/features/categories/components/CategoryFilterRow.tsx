import { Pressable, ScrollView, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';
import type { Category } from '@/types';

/**
 * Filtro de categoria da lista de notas.
 *
 * Fica sempre visível em vez de dentro de um menu: filtro escondido não é
 * usado, e a fileira também é o que ensina que categorias existem.
 *
 * A cor preenche a etiqueta escolhida e fica só num pontinho nas demais. Assim
 * dá para ver de longe qual está ativa sem precisar ler.
 */

type CategoryFilterRowProps = {
  categorias: Category[];
  contagens: Record<string, number>;
  selecionada: string | null;
  onSelecionar: (id: string | null) => void;
  onGerenciar: () => void;
};

export function CategoryFilterRow({
  categorias,
  contagens,
  selecionada,
  onSelecionar,
  onGerenciar,
}: CategoryFilterRowProps) {
  const { tokens } = useTheme();

  // Sem nenhuma categoria a fileira não aparece: uma linha com um botão só
  // ocuparia espaço da lista sem oferecer nada.
  if (categorias.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 10 }}
    >
      <Pressable
        onPress={() => onSelecionar(null)}
        className={`flex-row items-center rounded-full px-3.5 py-2 ${
          selecionada === null ? 'bg-ink-light dark:bg-ink-dark' : 'bg-subtle-light dark:bg-subtle-dark'
        }`}
      >
        <AppText
          variant="small"
          className={selecionada === null ? 'text-canvas-light dark:text-canvas-dark' : undefined}
        >
          Tudo
        </AppText>
      </Pressable>

      {categorias.map((categoria) => {
        const ativa = selecionada === categoria.id;
        const total = contagens[categoria.id] ?? 0;

        return (
          <Pressable
            key={categoria.id}
            onPress={() => onSelecionar(ativa ? null : categoria.id)}
            style={ativa ? { backgroundColor: categoria.color } : undefined}
            className={`flex-row items-center gap-2 rounded-full px-3.5 py-2 ${
              ativa ? '' : 'bg-subtle-light dark:bg-subtle-dark'
            }`}
          >
            <Feather
              name={categoria.icon as keyof typeof Feather.glyphMap}
              size={13}
              color={ativa ? '#FFFFFF' : categoria.color}
            />
            <AppText variant="small" style={ativa ? { color: '#FFFFFF' } : undefined}>
              {categoria.name}
            </AppText>
            {total > 0 ? (
              <AppText variant="small" style={ativa ? { color: '#FFFFFFAA' } : undefined}>
                {total}
              </AppText>
            ) : null}
          </Pressable>
        );
      })}

      <Pressable
        onPress={onGerenciar}
        className="flex-row items-center gap-1.5 rounded-full border border-hairline-light px-3.5 py-2 dark:border-hairline-dark"
      >
        <Feather name="settings" size={13} color={tokens.muted} />
        <AppText variant="small">Editar</AppText>
      </Pressable>
    </ScrollView>
  );
}
