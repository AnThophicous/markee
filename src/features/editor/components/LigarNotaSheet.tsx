import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Sheet } from '@/components/Sheet';
import { chaveDeNota } from '@/features/editor/utils/markdown-parser';
import { listNotes } from '@/features/notes/services/notes.service';
import { useTheme } from '@/theme/ThemeProvider';

type LigarNotaSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** O id da nota aberta, que não deve aparecer na lista. */
  noteId?: string;
  onEscolher: (titulo: string) => void;
};

/**
 * Escolher a nota a citar.
 *
 * Poderia ser um botão que enfia `[[]]` no texto e deixa a pessoa digitar. Não
 * é, por duas razões que se somam:
 *
 *   1. O editor não sabe onde está o cursor — os blocos guardam só o texto. Um
 *      botão de inserir colocaria os colchetes no fim da linha, longe de onde a
 *      pessoa estava escrevendo.
 *   2. Digitado à mão, o título precisa BATER com o da outra nota. Um acento
 *      trocado e a ligação aponta para uma nota que não existe. Escolher da
 *      lista acerta sempre.
 *
 * E quem quiser citar uma nota que ainda não existe digita o nome e usa
 * "criar" — que é o mesmo caminho, sem a armadilha de errar o nome de uma que
 * existe.
 */
export function LigarNotaSheet({ visible, onClose, noteId, onEscolher }: LigarNotaSheetProps) {
  const { tokens } = useTheme();
  const [busca, setBusca] = useState('');

  const { data: notas } = useQuery({
    queryKey: ['notes', 'paraLigar'],
    queryFn: () => listNotes(),
    enabled: visible,
  });

  const alvo = chaveDeNota(busca);
  const lista = (notas ?? [])
    .filter((n) => n.id !== noteId)
    .filter((n) => (alvo ? chaveDeNota(n.title).includes(alvo) : true))
    .slice(0, 40);

  // Só oferece criar quando o que foi digitado não é o título exato de uma nota
  // que já existe: senão a folha mostraria "criar Fotossíntese" logo abaixo da
  // própria nota Fotossíntese, e alguém criaria a segunda sem querer.
  const podeCriar = busca.trim().length > 0 && !lista.some((n) => chaveDeNota(n.title) === alvo);

  const escolher = (titulo: string) => {
    onEscolher(titulo);
    setBusca('');
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} edge="bottom">
      <AppText variant="heading" className="mb-1 px-1">
        Citar outra nota
      </AppText>
      <AppText variant="small" className="mb-3 px-1">
        Ela vira um link tocável, e esta nota aparece nas menções da outra.
      </AppText>

      <TextInput
        value={busca}
        onChangeText={setBusca}
        placeholder="Procurar pelo título"
        placeholderTextColor={tokens.muted}
        autoCorrect={false}
        className="mb-2 rounded-xl bg-subtle-light px-4 py-3.5 text-[16px] text-ink-light dark:bg-subtle-dark dark:text-ink-dark"
      />

      <ScrollView className="max-h-80" keyboardShouldPersistTaps="handled">
        {podeCriar ? (
          <Pressable
            onPress={() => escolher(busca.trim())}
            className="flex-row items-center gap-2.5 py-3"
          >
            <Feather name="plus-circle" size={16} color={tokens.accent} />
            <AppText variant="body" numberOfLines={1} className="flex-1">
              Criar “{busca.trim()}”
            </AppText>
          </Pressable>
        ) : null}

        {lista.map((n) => (
          <Pressable
            key={n.id}
            onPress={() => escolher(n.title)}
            className="flex-row items-center gap-2.5 py-3"
          >
            {n.emoji ? (
              <AppText style={{ fontSize: 16 }}>{n.emoji}</AppText>
            ) : (
              <Feather name="file-text" size={16} color={tokens.muted} />
            )}
            <AppText variant="body" numberOfLines={1} className="flex-1">
              {n.title || 'Sem título'}
            </AppText>
          </Pressable>
        ))}

        {lista.length === 0 && !podeCriar ? (
          <AppText variant="small" className="py-6 text-center">
            Nenhuma nota com esse nome.
          </AppText>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}
