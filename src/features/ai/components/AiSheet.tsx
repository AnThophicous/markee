import { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Divider } from '@/components/Divider';
import { Sheet } from '@/components/Sheet';
import { useMyUsage } from '@/features/billing/hooks/useMyUsage';
import { useTheme } from '@/theme/ThemeProvider';
import {
  AI_ACTIONS,
  getApiKey,
  outcomeToMarkdown,
  type AiAction,
  type AiOutcome,
} from '../services/openrouter.service';
import { useAiAction } from '../hooks/useAiActions';

type AiSheetProps = {
  visible: boolean;
  onClose: () => void;
  content: string;
  onInsert: (markdown: string) => void;
  /** Só a ação "Sugerir título" grava aqui em vez de no corpo. */
  onSetTitle?: (title: string) => void;
  onOpenSettings: () => void;
  onUpgrade: () => void;
};

const ORDER: AiAction[] = [
  'summarize',
  'explain',
  'flashcards',
  'quiz',
  'outline',
  'improve',
  'continue',
  'studyPlan',
  'title',
  'translate',
];

export function AiSheet({
  visible,
  onClose,
  content,
  onInsert,
  onSetTitle,
  onOpenSettings,
  onUpgrade,
}: AiSheetProps) {
  const { tokens } = useTheme();
  const aiAction = useAiAction();
  const { data: usage } = useMyUsage();
  const hasApiKey = Boolean(getApiKey());

  useEffect(() => {
    if (visible) aiAction.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const result = aiAction.data;
  // Passar do limite do plano gratuito não trava nada enquanto a chave é do
  // próprio usuário; o número serve para ele saber onde está.
  const overPlan = Boolean(usage && usage.aiUsed >= usage.aiLimit);

  const applyResult = () => {
    if (!result) return;

    if (result.action === 'title' && result.kind === 'text' && onSetTitle) {
      onSetTitle(result.text.replace(/^["'#\s]+|["'\s]+$/g, ''));
    } else {
      onInsert(outcomeToMarkdown(result));
    }
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} edge="bottom">
      <View className="flex-row items-center gap-2 px-1 pb-1">
        <Feather name="cpu" size={18} color={tokens.accent} />
        <AppText variant="heading" className="flex-1">
          Assistente
        </AppText>
        {usage ? (
          <Pressable onPress={onUpgrade} hitSlop={8}>
            <AppText variant="small" className={overPlan ? 'text-accent' : undefined}>
              {usage.aiUsed}/{usage.aiLimit}
            </AppText>
          </Pressable>
        ) : null}
      </View>

      {!hasApiKey ? (
        <View className="gap-4 py-3">
          <AppText variant="caption">
            Configure sua chave da OpenRouter para usar o assistente. Ele funciona com modelos gratuitos.
          </AppText>
          <Button
            label="Ir para Configurações"
            onPress={() => {
              onClose();
              onOpenSettings();
            }}
          />
        </View>
      ) : aiAction.isPending ? (
        <View className="items-center gap-3 py-12">
          <ActivityIndicator color={tokens.accent} />
          <AppText variant="caption">Pensando…</AppText>
        </View>
      ) : result ? (
        <ResultView result={result} onApply={applyResult} onDiscard={() => aiAction.reset()} />
      ) : (
        <View>
          {aiAction.error ? (
            <View className="mb-2 gap-2 px-1">
              <AppText variant="caption" className="text-danger">
                {aiAction.error.message}
              </AppText>
              {aiAction.error.message.includes('Pro') ? (
                <Pressable onPress={onUpgrade}>
                  <AppText variant="caption" className="text-accent">
                    Ver o plano Pro →
                  </AppText>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <ScrollView className="max-h-[400px]">
            {ORDER.map((action, index) => {
              const spec = AI_ACTIONS[action];
              const disabled = action === 'title' && !onSetTitle;
              if (disabled) return null;

              return (
                <View key={action}>
                  <Pressable
                    onPress={() => aiAction.mutate({ action, content })}
                    className="flex-row items-center gap-3 py-3 active:opacity-60"
                  >
                    <View className="h-9 w-9 items-center justify-center rounded-xl bg-subtle-light dark:bg-subtle-dark">
                      <Feather name={spec.icon as never} size={16} color={tokens.ink} />
                    </View>
                    <View className="flex-1">
                      <AppText variant="body">{spec.label}</AppText>
                      <AppText variant="small">{spec.hint}</AppText>
                    </View>
                  </Pressable>
                  {index < ORDER.length - 1 ? <Divider /> : null}
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}
    </Sheet>
  );
}

function ResultView({
  result,
  onApply,
  onDiscard,
}: {
  result: AiOutcome;
  onApply: () => void;
  onDiscard: () => void;
}) {
  const applyLabel = result.action === 'title' ? 'Usar como título' : 'Inserir na nota';

  return (
    <View className="gap-3 pb-2">
      <ScrollView className="max-h-[360px]">
        {result.kind === 'text' ? (
          <AppText variant="body" selectable>
            {result.text}
          </AppText>
        ) : result.kind === 'cards' ? (
          <View className="gap-3">
            {result.cards.map((card, index) => (
              <View key={index} className="rounded-xl bg-subtle-light p-3 dark:bg-subtle-dark">
                <AppText variant="bodyEmphasis">{card.pergunta}</AppText>
                <AppText variant="caption" className="mt-1">
                  {card.resposta}
                </AppText>
              </View>
            ))}
          </View>
        ) : (
          <View className="gap-3">
            {result.questions.map((question, index) => (
              <View key={index} className="rounded-xl bg-subtle-light p-3 dark:bg-subtle-dark">
                <AppText variant="bodyEmphasis">
                  {index + 1}. {question.pergunta}
                </AppText>
                {question.alternativas.map((alternative, i) => (
                  <AppText
                    key={i}
                    variant="caption"
                    className={i === question.correta ? 'mt-1 text-accent' : 'mt-1'}
                  >
                    {String.fromCharCode(97 + i)}) {alternative}
                  </AppText>
                ))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Button label={applyLabel} onPress={onApply} />
      <Button label="Descartar" variant="ghost" onPress={onDiscard} />
    </View>
  );
}
