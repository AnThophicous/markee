import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { useTheme } from '@/theme/ThemeProvider';
import { pickPostImages, type NewPost } from '../services/feed.service';

type ComposerSheetProps = {
  visible: boolean;
  onClose: () => void;
  onPublish: (post: NewPost) => void;
  isPending: boolean;
  error: string | null;
  /** Quando presente, a folha vira "editar publicação". */
  editing?: { id: string; content: string } | null;
};

const MAX_OPTIONS = 5;

export function ComposerSheet({ visible, onClose, onPublish, isPending, error, editing }: ComposerSheetProps) {
  const { tokens } = useTheme();

  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [pollOpen, setPollOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setContent(editing?.content ?? '');
    setImages([]);
    setPollOpen(false);
    setQuestion('');
    setOptions(['', '']);
    setAllowMultiple(false);
    setPickError(null);
  }, [visible, editing]);

  const attach = async () => {
    setPickError(null);
    try {
      setImages(await pickPostImages());
    } catch (e) {
      setPickError(e instanceof Error ? e.message : 'Falha ao escolher imagens.');
    }
  };

  const setOption = (index: number, value: string) =>
    setOptions((current) => current.map((option, i) => (i === index ? value : option)));

  const filledOptions = options.map((option) => option.trim()).filter(Boolean);
  const pollReady = pollOpen && filledOptions.length >= 2;
  const canPublish = content.trim().length > 0 || images.length > 0 || pollReady;

  const publish = () => {
    if (!canPublish) return;
    onPublish({
      content,
      images: editing ? [] : images,
      poll: pollReady ? { question, options, allowMultiple } : undefined,
    });
  };

  return (
    <Sheet visible={visible} onClose={onClose} edge="bottom">
      <AppText variant="heading" className="mb-3 px-1">
        {editing ? 'Editar publicação' : 'Nova publicação'}
      </AppText>

      <ScrollView className="max-h-[430px]" keyboardShouldPersistTaps="handled">
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="O que a turma precisa saber?"
          placeholderTextColor={tokens.muted}
          multiline
          autoFocus
          className="min-h-[110px] rounded-xl bg-subtle-light px-4 py-3 text-[16px] text-ink-light dark:bg-subtle-dark dark:text-ink-dark"
          style={{ textAlignVertical: 'top' }}
        />

        {images.length > 0 ? (
          <View className="mt-3 flex-row flex-wrap gap-2">
            {images.map((uri) => (
              <Pressable key={uri} onPress={() => setImages((current) => current.filter((item) => item !== uri))}>
                <Image source={{ uri }} className="h-16 w-16 rounded-lg" />
                <View className="absolute -right-1 -top-1 h-5 w-5 items-center justify-center rounded-full bg-ink-light dark:bg-subtle-dark">
                  <Feather name="x" size={11} color={tokens.canvas} />
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        {pollOpen ? (
          <View className="mt-3 rounded-2xl border border-hairline-light p-3 dark:border-hairline-dark">
            <TextInput
              value={question}
              onChangeText={setQuestion}
              placeholder="Pergunta da enquete"
              placeholderTextColor={tokens.muted}
              className="mb-2 rounded-xl bg-subtle-light px-3 py-2.5 text-[15px] text-ink-light dark:bg-subtle-dark dark:text-ink-dark"
            />

            {options.map((option, index) => (
              <View key={index} className="mb-2 flex-row items-center gap-2">
                <TextInput
                  value={option}
                  onChangeText={(value) => setOption(index, value)}
                  placeholder={`Opção ${index + 1}`}
                  placeholderTextColor={tokens.muted}
                  className="flex-1 rounded-xl bg-subtle-light px-3 py-2.5 text-[15px] text-ink-light dark:bg-subtle-dark dark:text-ink-dark"
                />
                {options.length > 2 ? (
                  <Pressable
                    onPress={() => setOptions((current) => current.filter((_, i) => i !== index))}
                    hitSlop={8}
                  >
                    <Feather name="x" size={16} color={tokens.muted} />
                  </Pressable>
                ) : null}
              </View>
            ))}

            <View className="flex-row items-center justify-between">
              {options.length < MAX_OPTIONS ? (
                <Pressable
                  onPress={() => setOptions((current) => [...current, ''])}
                  className="flex-row items-center gap-1.5 py-1"
                >
                  <Feather name="plus" size={14} color={tokens.accent} />
                  <AppText variant="caption" className="text-accent">
                    Opção
                  </AppText>
                </Pressable>
              ) : (
                <View />
              )}

              <Pressable
                onPress={() => setAllowMultiple((current) => !current)}
                className="flex-row items-center gap-1.5 py-1"
              >
                <Feather
                  name={allowMultiple ? 'check-square' : 'square'}
                  size={15}
                  color={allowMultiple ? tokens.accent : tokens.muted}
                />
                <AppText variant="caption">Escolha múltipla</AppText>
              </Pressable>
            </View>
          </View>
        ) : null}

        {pickError || error ? (
          <AppText variant="caption" className="mt-2 text-danger">
            {pickError ?? error}
          </AppText>
        ) : null}
      </ScrollView>

      {!editing ? (
        <View className="mt-3 flex-row items-center gap-5">
          <Pressable onPress={attach} className="flex-row items-center gap-2 py-2">
            <Feather name="image" size={18} color={tokens.accent} />
            <AppText variant="caption" className="text-accent">
              Fotos
            </AppText>
          </Pressable>

          <Pressable onPress={() => setPollOpen((current) => !current)} className="flex-row items-center gap-2 py-2">
            <Feather name="bar-chart-2" size={18} color={pollOpen ? tokens.accent : tokens.muted} />
            <AppText variant="caption" className={pollOpen ? 'text-accent' : undefined}>
              Enquete
            </AppText>
          </Pressable>
        </View>
      ) : (
        <View className="h-3" />
      )}

      <Button
        label={isPending ? 'Publicando…' : editing ? 'Salvar' : 'Publicar'}
        onPress={publish}
        disabled={isPending || !canPublish}
        className={canPublish ? undefined : 'opacity-50'}
      />
    </Sheet>
  );
}
