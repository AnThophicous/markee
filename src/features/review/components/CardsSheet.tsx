import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Divider } from '@/components/Divider';
import { Sheet } from '@/components/Sheet';
import { avisar } from '@/services/avisos';
import { useTheme } from '@/theme/ThemeProvider';

import { useCartasDaNota, useCriarCartas, useMexerNaCarta } from '../hooks/useCards';
import { sugerirCartas, type Sugestao } from '../extrair';

type Props = {
  visible: boolean;
  onClose: () => void;
  noteId: string;
  /** O corpo da nota, de onde as sugestões saem. */
  conteudo: string;
};

/**
 * Transformar a nota em cartas de revisão.
 *
 * A tela abre já com as sugestões prontas e TODAS marcadas. É o oposto do que
 * parece cuidadoso — o instinto é abrir com nada marcado, para não criar o que
 * a pessoa não pediu. Mas quem abriu este painel já disse que quer cartas; ter
 * que marcar quinze caixas antes de conseguir uma é o atrito que faz desistir.
 * Desmarcar as duas ruins é mais rápido que marcar as treze boas.
 */
export function CardsSheet({ visible, onClose, noteId, conteudo }: Props) {
  const { tokens } = useTheme();
  const { data: existentes } = useCartasDaNota(noteId);
  const criar = useCriarCartas(noteId);
  const { apagar } = useMexerNaCarta(noteId);

  const sugestoes = useMemo(() => (visible ? sugerirCartas(conteudo) : []), [visible, conteudo]);
  const [recusadas, setRecusadas] = useState<Set<number>>(new Set());
  const [manual, setManual] = useState<{ frente: string; verso: string } | null>(null);

  const aceitas = sugestoes.filter((_, i) => !recusadas.has(i));

  function alternar(i: number) {
    setRecusadas((antes) => {
      const novo = new Set(antes);
      if (novo.has(i)) novo.delete(i);
      else novo.add(i);
      return novo;
    });
  }

  async function salvar(pares: { frente: string; verso: string }[]) {
    if (pares.length === 0) return;
    const quantas = await criar.mutateAsync(pares);
    avisar(quantas === 1 ? '1 carta criada' : `${quantas} cartas criadas`, 'ok');
    setRecusadas(new Set());
    setManual(null);
    onClose();
  }

  return (
    <Sheet visible={visible} onClose={onClose} edge="bottom">
      <View className="mb-3 flex-row items-center justify-between">
        <AppText variant="heading">Cartas de revisão</AppText>
        {existentes && existentes.length > 0 ? (
          <AppText variant="small">
            {existentes.length} {existentes.length === 1 ? 'já criada' : 'já criadas'}
          </AppText>
        ) : null}
      </View>

      {manual ? (
        <View>
          <AppText variant="small" className="mb-1">
            PERGUNTA
          </AppText>
          <TextInput
            value={manual.frente}
            onChangeText={(t) => setManual({ ...manual, frente: t })}
            placeholder="O que perguntar"
            placeholderTextColor={tokens.muted}
            autoFocus
            className="rounded-xl bg-subtle-light px-4 py-3.5 text-[16px] text-ink-light dark:bg-subtle-dark dark:text-ink-dark"
          />
          <AppText variant="small" className="mb-1 mt-3">
            RESPOSTA
          </AppText>
          <TextInput
            value={manual.verso}
            onChangeText={(t) => setManual({ ...manual, verso: t })}
            placeholder="O que precisa lembrar"
            placeholderTextColor={tokens.muted}
            multiline
            className="min-h-[80px] rounded-xl bg-subtle-light px-4 py-3.5 text-[16px] text-ink-light dark:bg-subtle-dark dark:text-ink-dark"
          />
          <View className="mt-4 flex-row gap-2">
            <Pressable
              onPress={() => setManual(null)}
              className="flex-1 items-center rounded-2xl bg-subtle-light py-3 active:opacity-70 dark:bg-subtle-dark"
            >
              <AppText variant="bodyEmphasis">Cancelar</AppText>
            </Pressable>
            <Pressable
              onPress={() => salvar([manual])}
              disabled={!manual.frente.trim() || !manual.verso.trim()}
              className="flex-1 items-center rounded-2xl bg-accent py-3 active:opacity-70 disabled:opacity-40"
            >
              <AppText variant="bodyEmphasis" className="text-white">
                Criar
              </AppText>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          {sugestoes.length === 0 ? (
            <View className="items-center py-6">
              <Feather name="layers" size={28} color={tokens.muted} />
              <AppText variant="caption" className="mt-3 text-center">
                Não achei nada que virasse carta sozinho. Escreva definições no formato
                {'\n'}
                <AppText variant="caption" className="font-semibold">
                  Termo: explicação
                </AppText>
                {'\n'}que elas aparecem aqui.
              </AppText>
            </View>
          ) : (
            <ScrollView className="max-h-[340px]" showsVerticalScrollIndicator={false}>
              {sugestoes.map((s, i) => (
                <Linha
                  key={`${s.frente}-${i}`}
                  sugestao={s}
                  marcada={!recusadas.has(i)}
                  onPress={() => alternar(i)}
                />
              ))}
            </ScrollView>
          )}

          {existentes && existentes.length > 0 ? (
            <>
              <Divider className="my-3" />
              <AppText variant="small" className="mb-2">
                JÁ CRIADAS
              </AppText>
              <ScrollView className="max-h-[120px]" showsVerticalScrollIndicator={false}>
                {existentes.map((c) => (
                  <View key={c.id} className="flex-row items-center gap-2 py-1.5">
                    <AppText variant="caption" numberOfLines={1} className="flex-1">
                      {c.frente}
                    </AppText>
                    <Pressable
                      onPress={() => apagar.mutate(c.id)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Apagar a carta ${c.frente}`}
                    >
                      <Feather name="x" size={15} color={tokens.muted} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            </>
          ) : null}

          <View className="mt-4 flex-row gap-2">
            <Pressable
              onPress={() => setManual({ frente: '', verso: '' })}
              className="items-center justify-center rounded-2xl bg-subtle-light px-4 py-3 active:opacity-70 dark:bg-subtle-dark"
              accessibilityRole="button"
              accessibilityLabel="Escrever uma carta à mão"
            >
              <Feather name="plus" size={18} color={tokens.ink} />
            </Pressable>
            <Pressable
              onPress={() => salvar(aceitas)}
              disabled={aceitas.length === 0 || criar.isPending}
              className="flex-1 items-center rounded-2xl bg-accent py-3 active:opacity-70 disabled:opacity-40"
              accessibilityRole="button"
            >
              <AppText variant="bodyEmphasis" className="text-white">
                {aceitas.length === 0
                  ? 'Nenhuma marcada'
                  : `Criar ${aceitas.length} ${aceitas.length === 1 ? 'carta' : 'cartas'}`}
              </AppText>
            </Pressable>
          </View>
        </>
      )}
    </Sheet>
  );
}

const ROTULO: Record<Sugestao['origem'], string> = {
  definicao: 'definição',
  titulo: 'título',
  lista: 'lista',
  destaque: 'destaque',
};

function Linha({
  sugestao,
  marcada,
  onPress,
}: {
  sugestao: Sugestao;
  marcada: boolean;
  onPress: () => void;
}) {
  const { tokens } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-start gap-3 py-2.5"
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcada }}
      accessibilityLabel={`${sugestao.frente}: ${sugestao.verso}`}
    >
      <View
        className="mt-0.5 h-5 w-5 items-center justify-center rounded-md border"
        style={{
          borderColor: marcada ? tokens.accent : tokens.hairline,
          backgroundColor: marcada ? tokens.accent : 'transparent',
        }}
      >
        {marcada ? <Feather name="check" size={13} color="#FFFFFF" /> : null}
      </View>

      <View className="flex-1" style={{ opacity: marcada ? 1 : 0.45 }}>
        <AppText variant="bodyEmphasis" numberOfLines={1}>
          {sugestao.frente}
        </AppText>
        <AppText variant="caption" numberOfLines={2}>
          {sugestao.verso}
        </AppText>
        <AppText variant="small" className="mt-0.5 uppercase">
          {ROTULO[sugestao.origem]}
        </AppText>
      </View>
    </Pressable>
  );
}
