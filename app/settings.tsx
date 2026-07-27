import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ColorPicker } from '@/components/ColorPicker';
import { Divider } from '@/components/Divider';
import { Sheet } from '@/components/Sheet';
import { ApiKeyField } from '@/features/ai/components/ApiKeyField';
import { ScreenHeader } from '@/features/navigation/components/ScreenHeader';
import {
  DEFAULT_ACCENT,
  useSettingsStore,
  type ThemePreference,
} from '@/features/settings/store/useSettingsStore';
import { useBottomInset } from '@/hooks/useBottomInset';
import { useTheme } from '@/theme/ThemeProvider';
import { cn } from '@/utils/cn';

const OPTIONS: { key: ThemePreference; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'light', label: 'Claro', icon: 'sun' },
  { key: 'dark', label: 'Escuro', icon: 'moon' },
  { key: 'system', label: 'Sistema', icon: 'smartphone' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const bottom = useBottomInset(24);
  const themePreference = useSettingsStore((state) => state.themePreference);
  const setThemePreference = useSettingsStore((state) => state.setThemePreference);
  const accentColor = useSettingsStore((state) => state.accentColor);
  const setAccentColor = useSettingsStore((state) => state.setAccentColor);
  const [accentVisible, setAccentVisible] = useState(false);

  return (
    <View className="flex-1 bg-canvas-light dark:bg-canvas-dark">
      <ScreenHeader title="Configurações" showMenu={false} onBackPress={() => router.back()} />

      <ScrollView className="px-4 pt-2" contentContainerStyle={{ paddingBottom: bottom }}>
        <AppText variant="caption" className="mb-2 px-1">
          Aparência
        </AppText>
        <View className="overflow-hidden rounded-2xl bg-surface-light dark:bg-surface-dark">
          {OPTIONS.map((option, index) => (
            <View key={option.key}>
              <Pressable
                onPress={() => setThemePreference(option.key)}
                className="flex-row items-center justify-between px-4 py-3.5"
              >
                <View className="flex-row items-center gap-3">
                  <Feather name={option.icon} size={18} color={tokens.ink} />
                  <AppText variant="body">{option.label}</AppText>
                </View>
                {themePreference === option.key ? (
                  <Feather name="check" size={18} color={tokens.accent} />
                ) : null}
              </Pressable>
              {index < OPTIONS.length - 1 ? (
                <Divider className={cn('ml-4')} />
              ) : null}
            </View>
          ))}
        </View>

        <Pressable
          onPress={() => setAccentVisible(true)}
          className="mt-3 flex-row items-center gap-3 rounded-2xl bg-surface-light px-4 py-3.5 active:opacity-70 dark:bg-surface-dark"
        >
          <View style={{ backgroundColor: accentColor }} className="h-7 w-7 rounded-full" />
          <View className="flex-1">
            <AppText variant="body">Cor de destaque</AppText>
            <AppText variant="small">
              {accentColor}
              {accentColor.toUpperCase() === DEFAULT_ACCENT ? ' · padrão' : ''}
            </AppText>
          </View>
          <Feather name="chevron-right" size={18} color={tokens.muted} />
        </Pressable>

        <AppText variant="caption" className="mb-2 mt-6 px-1">
          Assistente
        </AppText>
        <ApiKeyField />

        <AppText variant="caption" className="mb-2 mt-6 px-1">
          Sobre
        </AppText>
        <View className="rounded-2xl bg-surface-light px-4 py-4 dark:bg-surface-dark">
          <AppText variant="bodyEmphasis">Markee</AppText>
          <AppText variant="caption" className="mt-1">
            Versão {Constants.expoConfig?.version ?? '1.0.0'}
          </AppText>
          <AppText variant="caption" className="mt-3">
            Um caderno infinito no bolso. Suas notas ficam no dispositivo, sempre disponíveis, mesmo offline.
          </AppText>
        </View>
      </ScrollView>

      <Sheet visible={accentVisible} onClose={() => setAccentVisible(false)} edge="bottom">
        <AppText variant="heading" className="mb-1 px-1">
          Cor de destaque
        </AppText>
        <AppText variant="caption" className="mb-3 px-1">
          Vale para o app inteiro: botão de nova nota, links, favoritos e estados ativos. Fica só no seu
          aparelho.
        </AppText>

        <ColorPicker value={accentColor} onChange={setAccentColor} />

        <View className="mt-4 gap-2">
          <Button label="Pronto" onPress={() => setAccentVisible(false)} />
          <Button label="Voltar ao rosa padrão" variant="ghost" onPress={() => setAccentColor(DEFAULT_ACCENT)} />
        </View>
      </Sheet>
    </View>
  );
}
