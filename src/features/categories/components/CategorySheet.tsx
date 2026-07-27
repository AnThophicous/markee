import { useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { useTheme } from '@/theme/ThemeProvider';
import type { Category } from '@/types';
import { useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from '../hooks/useCategories';

/**
 * Escolher, criar, renomear e apagar categoria — tudo no mesmo painel.
 *
 * Uma tela separada só para gerenciar seria mais arrumada e pior de usar: quem
 * está marcando uma nota e percebe que falta a categoria certa teria de sair da
 * nota, criar, e voltar. Aqui o "Nova" abre no mesmo lugar.
 *
 * `modo` decide o que aparece: no modo "escolher" há a opção de tirar a
 * categoria da nota; no modo "gerenciar", não — ali não existe nota nenhuma
 * envolvida.
 */

/**
 * Mesmas cores dos gráficos e das categorias iniciais. Vieram de uma paleta
 * conferida com validador, então continuam distinguíveis para quem enxerga
 * cores de forma diferente — o que importa aqui, já que a cor é a pista que se
 * procura correndo o olho pela lista.
 */
const CORES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];

const ICONES: (keyof typeof Feather.glyphMap)[] = [
  'book-open', 'edit-3', 'briefcase', 'heart', 'star', 'flag',
  'coffee', 'code', 'music', 'activity', 'globe', 'zap',
];

type CategorySheetProps = {
  visible: boolean;
  onClose: () => void;
  modo: 'escolher' | 'gerenciar';
  /** Categoria da nota, no modo escolher. */
  selecionada?: string | null;
  onSelecionar?: (id: string | null) => void;
};

export function CategorySheet({
  visible,
  onClose,
  modo,
  selecionada,
  onSelecionar,
}: CategorySheetProps) {
  const { tokens } = useTheme();
  const { data: categorias } = useCategories();
  const criar = useCreateCategory();
  const atualizar = useUpdateCategory();
  const apagar = useDeleteCategory();

  const [editando, setEditando] = useState<Category | 'nova' | null>(null);
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState(CORES[0]);
  const [icone, setIcone] = useState<string>(ICONES[0]);

  // Fechar e reabrir volta para a lista: deixar o formulário aberto de uma vez
  // anterior faria o painel abrir num estado que ninguém pediu.
  useEffect(() => {
    if (!visible) setEditando(null);
  }, [visible]);

  const abrirFormulario = (categoria: Category | 'nova') => {
    setEditando(categoria);
    setNome(categoria === 'nova' ? '' : categoria.name);
    setCor(categoria === 'nova' ? CORES[0] : categoria.color);
    setIcone(categoria === 'nova' ? ICONES[0] : categoria.icon);
  };

  const salvar = () => {
    const limpo = nome.trim();
    if (!limpo) return;

    if (editando === 'nova') {
      criar.mutate({ name: limpo, color: cor, icon: icone });
    } else if (editando) {
      atualizar.mutate({ id: editando.id, patch: { name: limpo, color: cor, icon: icone } });
    }
    setEditando(null);
  };

  const remover = (categoria: Category) => {
    apagar.mutate(categoria.id);
    // A nota que estava nela fica sem categoria; se o filtro apontava para a
    // que sumiu, volta para "tudo".
    if (selecionada === categoria.id) onSelecionar?.(null);
    setEditando(null);
  };

  return (
    <Sheet visible={visible} onClose={onClose} edge="bottom">
      {editando ? (
        <View>
          <AppText variant="heading" className="mb-3 px-1">
            {editando === 'nova' ? 'Nova categoria' : 'Editar categoria'}
          </AppText>

          <TextInput
            value={nome}
            onChangeText={setNome}
            placeholder="Nome"
            placeholderTextColor={tokens.muted}
            autoFocus
            className="mb-4 rounded-xl bg-subtle-light px-4 py-3 text-[16px] text-ink-light dark:bg-subtle-dark dark:text-ink-dark"
          />

          <AppText variant="caption" className="mb-2 px-1">
            Cor
          </AppText>
          <View className="mb-4 flex-row flex-wrap gap-2.5">
            {CORES.map((opcao) => (
              <Pressable
                key={opcao}
                onPress={() => setCor(opcao)}
                style={{ backgroundColor: opcao }}
                className="h-9 w-9 items-center justify-center rounded-full"
              >
                {cor === opcao ? <Feather name="check" size={16} color="#FFFFFF" /> : null}
              </Pressable>
            ))}
          </View>

          <AppText variant="caption" className="mb-2 px-1">
            Ícone
          </AppText>
          <View className="mb-5 flex-row flex-wrap gap-2">
            {ICONES.map((opcao) => (
              <Pressable
                key={opcao}
                onPress={() => setIcone(opcao)}
                style={icone === opcao ? { backgroundColor: cor } : undefined}
                className={`h-10 w-10 items-center justify-center rounded-xl ${
                  icone === opcao ? '' : 'bg-subtle-light dark:bg-subtle-dark'
                }`}
              >
                <Feather name={opcao} size={17} color={icone === opcao ? '#FFFFFF' : tokens.ink} />
              </Pressable>
            ))}
          </View>

          <View className="gap-2">
            <Button
              label="Salvar"
              disabled={!nome.trim()}
              className={nome.trim() ? undefined : 'opacity-50'}
              onPress={salvar}
            />
            {editando !== 'nova' ? (
              <Button label="Apagar categoria" variant="danger" onPress={() => remover(editando)} />
            ) : null}
            <Button label="Voltar" variant="ghost" onPress={() => setEditando(null)} />
          </View>
        </View>
      ) : (
        <View>
          <AppText variant="heading" className="mb-1 px-1">
            {modo === 'escolher' ? 'Categoria da nota' : 'Categorias'}
          </AppText>
          <AppText variant="caption" className="mb-3 px-1">
            {modo === 'escolher'
              ? 'Aparece como etiqueta na lista e serve para filtrar.'
              : 'Toque numa para renomear, trocar a cor ou apagar.'}
          </AppText>

          <ScrollView className="max-h-[360px]" showsVerticalScrollIndicator={false}>
            {modo === 'escolher' ? (
              <Pressable
                onPress={() => {
                  onSelecionar?.(null);
                  onClose();
                }}
                className="flex-row items-center gap-3 py-2.5 active:opacity-60"
              >
                <View className="h-9 w-9 items-center justify-center rounded-xl bg-subtle-light dark:bg-subtle-dark">
                  <Feather name="slash" size={16} color={tokens.muted} />
                </View>
                <AppText variant="body" className="flex-1">
                  Sem categoria
                </AppText>
                {!selecionada ? <Feather name="check" size={16} color={tokens.accent} /> : null}
              </Pressable>
            ) : null}

            {(categorias ?? []).map((categoria) => (
              <Pressable
                key={categoria.id}
                onPress={() => {
                  if (modo === 'gerenciar') {
                    abrirFormulario(categoria);
                  } else {
                    onSelecionar?.(categoria.id);
                    onClose();
                  }
                }}
                className="flex-row items-center gap-3 py-2.5 active:opacity-60"
              >
                <View
                  style={{ backgroundColor: categoria.color }}
                  className="h-9 w-9 items-center justify-center rounded-xl"
                >
                  <Feather
                    name={categoria.icon as keyof typeof Feather.glyphMap}
                    size={16}
                    color="#FFFFFF"
                  />
                </View>
                <AppText variant="body" className="flex-1">
                  {categoria.name}
                </AppText>

                {modo === 'escolher' && selecionada === categoria.id ? (
                  <Feather name="check" size={16} color={tokens.accent} />
                ) : null}

                {/* No modo escolher, a alça de edição continua acessível — sem
                    ela seria preciso sair da nota para corrigir um nome. */}
                {modo === 'escolher' ? (
                  <Pressable onPress={() => abrirFormulario(categoria)} hitSlop={10} className="pl-2">
                    <Feather name="edit-2" size={14} color={tokens.muted} />
                  </Pressable>
                ) : (
                  <Feather name="chevron-right" size={16} color={tokens.muted} />
                )}
              </Pressable>
            ))}
          </ScrollView>

          <Button label="Nova categoria" variant="secondary" onPress={() => abrirFormulario('nova')} />
        </View>
      )}
    </Sheet>
  );
}
