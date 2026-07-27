import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ColorPicker } from '@/components/ColorPicker';
import { Sheet } from '@/components/Sheet';
import { ThemeBanner } from '@/components/ThemeBanner';
import { useTheme } from '@/theme/ThemeProvider';
import { cn } from '@/utils/cn';
import {
  CARD_ORDER,
  CARD_STYLES,
  EFFECTS,
  EFFECT_ORDER,
  MAX_GRADIENT_STOPS,
  describeProError,
  type VisualTheme,
} from '@/theme/visual';

type ThemePickerSheetProps = {
  visible: boolean;
  /** "Aparência do grupo" ou "Aparência do perfil". */
  title?: string;
  onClose: () => void;
  current: VisualTheme;
  isPro: boolean;
  /** O cartão só existe para grupos; no perfil a aba não aparece. */
  showCard?: boolean;
  onSave: (theme: VisualTheme) => Promise<void>;
  onUpgrade: () => void;
};

type Tab = 'cor' | 'efeito' | 'cartao';

export function ThemePickerSheet({
  visible,
  title = 'Aparência',
  onClose,
  current,
  isPro,
  showCard = false,
  onSave,
  onUpgrade,
}: ThemePickerSheetProps) {
  const { tokens } = useTheme();
  const [draft, setDraft] = useState<VisualTheme>(current);
  const [tab, setTab] = useState<Tab>('cor');
  const [stopIndex, setStopIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDraft(current);
    setTab('cor');
    setStopIndex(0);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  /** Recurso pago só entra no rascunho se a conta for Pro. */
  const requirePro = (apply: () => void) => {
    if (!isPro) {
      setError('Isso é do plano Pro. Cor sólida continua gratuita.');
      return;
    }
    setError(null);
    apply();
  };

  const isGradient = draft.kind === 'gradient';
  const colors = draft.colors;

  const setColorAt = (index: number, hex: string) =>
    setDraft((theme) => ({
      ...theme,
      colors: theme.colors.map((color, i) => (i === index ? hex : color)),
    }));

  /** Uma cor = sólido; duas ou mais = gradiente. Não há dois modos a escolher. */
  const addColor = () =>
    requirePro(() =>
      setDraft((theme) => {
        const next = [...theme.colors, theme.colors[theme.colors.length - 1]].slice(0, MAX_GRADIENT_STOPS);
        setStopIndex(next.length - 1);
        return { ...theme, kind: 'gradient', colors: next };
      })
    );

  const removeColor = (index: number) =>
    setDraft((theme) => {
      const next = theme.colors.filter((_, i) => i !== index);
      setStopIndex(0);
      return { ...theme, kind: next.length >= 2 ? 'gradient' : 'solid', colors: next };
    });

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Não foi possível salvar.';
      setError(describeProError(message) ?? message);
    } finally {
      setSaving(false);
    }
  };

  const tabs: Tab[] = showCard ? ['cor', 'efeito', 'cartao'] : ['cor', 'efeito'];
  const tabLabel: Record<Tab, string> = { cor: 'Cores', efeito: 'Efeito', cartao: 'Cartão' };

  return (
    <Sheet visible={visible} onClose={onClose} edge="bottom">
      <AppText variant="heading" className="mb-2 px-1">
        {title}
      </AppText>

      {/* Prévia ao vivo, com o efeito rodando. */}
      <View className="mb-3 overflow-hidden rounded-2xl">
        <ThemeBanner theme={draft} height={80} />
      </View>

      <View className="mb-3 flex-row gap-2">
        {tabs.map((key) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            className={cn(
              'flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2.5',
              tab === key ? 'bg-accent' : 'bg-subtle-light dark:bg-subtle-dark'
            )}
          >
            <AppText variant="small" className={tab === key ? 'text-white' : 'text-ink-light dark:text-ink-dark'}>
              {tabLabel[key]}
            </AppText>
            {key !== 'cor' && !isPro ? (
              <Feather name="lock" size={10} color={tab === key ? '#fff' : tokens.muted} />
            ) : null}
          </Pressable>
        ))}
      </View>

      <ScrollView className="max-h-[400px]" keyboardShouldPersistTaps="handled">
        {tab === 'cor' ? (
          <View>
            <View className="mb-1 flex-row items-center gap-2 px-1">
              <AppText variant="small" className="flex-1">
                {isGradient ? `GRADIENTE · ${colors.length} CORES` : 'COR'}
              </AppText>
              {!isPro ? (
                <View className="flex-row items-center gap-1">
                  <Feather name="lock" size={10} color={tokens.muted} />
                  <AppText variant="small">gradiente é Pro</AppText>
                </View>
              ) : null}
            </View>

            {/* Cada parada é um botão; a selecionada é a que o seletor edita. */}
            <View className="mb-2 flex-row items-center gap-2 px-1">
              {colors.map((color, index) => (
                <Pressable
                  key={index}
                  onPress={() => setStopIndex(index)}
                  onLongPress={() => colors.length > 1 && removeColor(index)}
                  className={cn(
                    'h-12 w-12 items-center justify-center rounded-xl',
                    stopIndex === index && 'border-2 border-accent'
                  )}
                  style={{ backgroundColor: color }}
                >
                  {colors.length > 1 && stopIndex === index ? (
                    <Feather name="x" size={14} color="#fff" />
                  ) : null}
                </Pressable>
              ))}

              {colors.length < MAX_GRADIENT_STOPS ? (
                <Pressable
                  onPress={addColor}
                  className="h-12 w-12 items-center justify-center rounded-xl border border-dashed border-hairline-light dark:border-hairline-dark"
                >
                  <Feather name="plus" size={17} color={tokens.muted} />
                </Pressable>
              ) : null}
            </View>

            <AppText variant="small" className="mb-3 px-1">
              {colors.length > 1
                ? 'Toque numa cor para editar; segure para remover.'
                : 'Toque no + para virar gradiente.'}
            </AppText>

            <ColorPicker value={colors[stopIndex] ?? colors[0]} onChange={(hex) => setColorAt(stopIndex, hex)} />
          </View>
        ) : tab === 'efeito' ? (
          <View style={{ opacity: isPro ? 1 : 0.45 }}>
            {EFFECT_ORDER.map((effect) => {
              const info = EFFECTS[effect];
              const active = draft.effect === effect;
              return (
                <Pressable
                  key={effect}
                  onPress={() =>
                    effect === 'none'
                      ? setDraft((theme) => ({ ...theme, effect }))
                      : requirePro(() => setDraft((theme) => ({ ...theme, effect })))
                  }
                  className="flex-row items-center gap-3 py-3"
                >
                  <View
                    className={cn(
                      'h-5 w-5 items-center justify-center rounded-full border-2',
                      active ? 'border-accent bg-accent' : 'border-hairline-light dark:border-hairline-dark'
                    )}
                  >
                    {active ? <Feather name="check" size={12} color="#fff" /> : null}
                  </View>
                  <View className="flex-1">
                    <AppText variant="body">{info.label}</AppText>
                    <AppText variant="small">{info.hint}</AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={{ opacity: isPro ? 1 : 0.45 }}>
            <AppText variant="small" className="mb-3 px-1">
              COMO O GRUPO APARECE PARA OS OUTROS
            </AppText>
            {CARD_ORDER.map((style) => {
              const info = CARD_STYLES[style];
              const active = draft.card === style;
              return (
                <Pressable
                  key={style}
                  onPress={() =>
                    style === 'plain'
                      ? setDraft((theme) => ({ ...theme, card: style }))
                      : requirePro(() => setDraft((theme) => ({ ...theme, card: style })))
                  }
                  className="mb-2 flex-row items-center gap-3"
                >
                  <View
                    className={cn(
                      'h-5 w-5 items-center justify-center rounded-full border-2',
                      active ? 'border-accent bg-accent' : 'border-hairline-light dark:border-hairline-dark'
                    )}
                  >
                    {active ? <Feather name="check" size={12} color="#fff" /> : null}
                  </View>
                  <View className="flex-1">
                    <AppText variant="body">{info.label}</AppText>
                    <AppText variant="small">{info.hint}</AppText>
                  </View>
                  <CardPreview theme={{ ...draft, card: style }} />
                </Pressable>
              );
            })}
          </View>
        )}

        {!isPro ? (
          <Pressable
            onPress={onUpgrade}
            className="mt-3 flex-row items-center gap-3 rounded-2xl bg-subtle-light p-4 dark:bg-subtle-dark"
          >
            <Feather name="zap" size={18} color={tokens.accent} />
            <View className="flex-1">
              <AppText variant="bodyEmphasis">Desbloquear com o Pro</AppText>
              <AppText variant="small">Gradiente seu, efeitos de luz e cartão personalizado.</AppText>
            </View>
            <Feather name="chevron-right" size={18} color={tokens.muted} />
          </Pressable>
        ) : null}
      </ScrollView>

      {error ? (
        <AppText variant="caption" className="mt-3 px-1 text-danger">
          {error}
        </AppText>
      ) : null}

      <Button label={saving ? 'Salvando…' : 'Salvar aparência'} onPress={save} className="mt-3" disabled={saving} />
    </Sheet>
  );
}

/** Miniatura de como o cartão do grupo vai ficar na lista. */
function CardPreview({ theme }: { theme: VisualTheme }) {
  if (theme.card === 'plain') {
    return (
      <View className="h-10 w-16 justify-center rounded-lg bg-surface-light px-2 dark:bg-surface-dark">
        <View className="h-1.5 w-8 rounded-full bg-hairline-light dark:bg-hairline-dark" />
        <View className="mt-1 h-1.5 w-5 rounded-full bg-hairline-light dark:bg-hairline-dark" />
      </View>
    );
  }

  if (theme.card === 'tinted') {
    return (
      <View
        className="h-10 w-16 justify-center rounded-lg px-2"
        style={{ backgroundColor: theme.colors[0] + '26' }}
      >
        <View className="h-1.5 w-8 rounded-full" style={{ backgroundColor: theme.colors[0] }} />
        <View className="mt-1 h-1.5 w-5 rounded-full opacity-50" style={{ backgroundColor: theme.colors[0] }} />
      </View>
    );
  }

  return (
    <View className="h-10 w-16 overflow-hidden rounded-lg">
      <ThemeBanner theme={theme} height={40} width={64} />
    </View>
  );
}
