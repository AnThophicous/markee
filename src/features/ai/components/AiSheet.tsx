import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Divider } from '@/components/Divider';
import { Sheet } from '@/components/Sheet';
import { useMyUsage } from '@/features/billing/hooks/useMyUsage';
import { useSettingsStore } from '@/features/settings/store/useSettingsStore';
import { useTheme } from '@/theme/ThemeProvider';
import {
  AI_ACTIONS,
  outcomeToMarkdown,
  usesOwnKey,
  type AiAction,
  type AiOutcome,
} from '../services/openrouter.service';
import { useAiAction } from '../hooks/useAiActions';
import type { ToolTrace } from '../tools/types';

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
  'ask',
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
  const ownKey = usesOwnKey();

  const allowNotes = useSettingsStore((state) => state.allowAiNotes);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (visible) {
      aiAction.reset();
      setQuestion('');
      setAsking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const result = aiAction.data;
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
        {/* Com chave própria não há limite nosso — mostrar contador confundiria. */}
        {ownKey ? (
          <AppText variant="small">sua chave</AppText>
        ) : usage ? (
          <Pressable onPress={onUpgrade} hitSlop={8}>
            <AppText variant="small" className={overPlan ? 'text-accent' : undefined}>
              {usage.aiUsed}/{usage.aiLimit}
            </AppText>
          </Pressable>
        ) : null}
      </View>

      {aiAction.isPending ? (
        <View className="items-center gap-3 py-12">
          <ActivityIndicator color={tokens.accent} />
          <AppText variant="caption">Pensando…</AppText>
        </View>
      ) : result ? (
        <ResultView
          result={result}
          traces={result.traces}
          onApply={applyResult}
          onDiscard={() => aiAction.reset()}
        />
      ) : (
        asking ? (
        <View className="gap-3 pb-2">
          <AppText variant="caption" className="px-1">
            Pergunte o que quiser. Se precisar, ele pesquisa na internet, faz a conta
            {' '}
            {/* A menção às notas só aparece quando a permissão está ligada. */}
            e {allowNotes ? 'consulta as suas notas' : 'usa o que estiver na tela'}.
          </AppText>
          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder="Quando é a prova do ENEM 2026?"
            placeholderTextColor={tokens.muted}
            multiline
            autoFocus
            className="min-h-[90px] rounded-xl bg-subtle-light px-4 py-3 text-[16px] text-ink-light dark:bg-subtle-dark dark:text-ink-dark"
            style={{ textAlignVertical: 'top' }}
          />
          {aiAction.error ? (
            <AppText variant="caption" className="text-danger">
              {aiAction.error.message}
            </AppText>
          ) : null}
          <Button
            label="Perguntar"
            disabled={!question.trim()}
            className={question.trim() ? undefined : 'opacity-50'}
            onPress={() => aiAction.mutate({ action: 'ask', content: question })}
          />
          <Button label="Voltar" variant="ghost" onPress={() => setAsking(false)} />
        </View>
        ) : (
        <View>
          {aiAction.error ? (
            <View className="mb-2 gap-2 px-1">
              <AppText variant="caption" className="text-danger">
                {aiAction.error.message}
              </AppText>

              {/* O erro diz o que houve; aqui fica o caminho para resolver. */}
              {aiAction.error.message.includes('QUOTA_EXCEEDED') || aiAction.error.message.includes('Pro') ? (
                <Pressable onPress={onUpgrade}>
                  <AppText variant="caption" className="text-accent">
                    Ver o plano Pro →
                  </AppText>
                </Pressable>
              ) : aiAction.error.name === 'MissingApiKeyError' || aiAction.error.message.includes('chave') ? (
                <Button
                  label="Usar a minha chave da OpenRouter"
                  variant="secondary"
                  onPress={() => {
                    onClose();
                    onOpenSettings();
                  }}
                />
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
                    onPress={() =>
                      action === 'ask' ? setAsking(true) : aiAction.mutate({ action, content })
                    }
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
        )
      )}
    </Sheet>
  );
}

const TOOL_LABELS: Record<string, string> = {
  buscar: 'Pesquisou na internet',
  calcular: 'Fez a conta',
  minhas_notas: 'Leu suas notas',
  data: 'Conferiu a data',
};

function ResultView({
  result,
  traces,
  onApply,
  onDiscard,
}: {
  result: AiOutcome;
  traces?: ToolTrace[];
  onApply: () => void;
  onDiscard: () => void;
}) {
  const { tokens } = useTheme();
  const applyLabel = result.action === 'title' ? 'Usar como título' : 'Inserir na nota';

  return (
    <View className="gap-3 pb-2">
      <ScrollView className="max-h-[360px]">
        {/* Sem isto a resposta parece adivinhação; com isto dá para conferir a
            origem — e perceber quando ela NÃO pesquisou. */}
        {traces && traces.length > 0 ? (
          <View className="mb-3 gap-1.5 rounded-xl bg-subtle-light p-3 dark:bg-subtle-dark">
            {traces.map((trace, index) => (
              <View key={index} className="flex-row items-center gap-2">
                <Feather
                  name={trace.failed ? 'alert-circle' : 'check'}
                  size={12}
                  color={trace.failed ? tokens.muted : tokens.accent}
                />
                <AppText variant="small" className="flex-1" numberOfLines={1}>
                  {TOOL_LABELS[trace.tool] ?? trace.tool}
                  {trace.argument ? `: ${trace.argument}` : ''}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}

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
