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
import { Toggle } from '@/components/Toggle';
import { ScreenHeader } from '@/features/navigation/components/ScreenHeader';
import {
  DEFAULT_ACCENT,
  useSettingsStore,
  type ThemePreference,
} from '@/features/settings/store/useSettingsStore';
import { useBottomInset } from '@/hooks/useBottomInset';
import { listarQuedas } from '@/services/crash-reporter';
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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  // Contado na montagem: mostrar o número no próprio item evita que a pessoa
  // precise abrir a tela para descobrir que não há nada lá.
  const [quedas] = useState(() => listarQuedas().length);
  const allowAiNotes = useSettingsStore((state) => state.allowAiNotes);
  const setAllowAiNotes = useSettingsStore((state) => state.setAllowAiNotes);

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

        <View className="rounded-2xl bg-surface-light px-4 py-3.5 dark:bg-surface-dark">
          <View className="flex-row items-center gap-3">
            <Feather name="file-text" size={18} color={tokens.accent} />
            <View className="flex-1 pr-2">
              <AppText variant="body">Deixar a IA ler minhas notas</AppText>
              <AppText variant="small">
                Só o trecho relacionado ao que você perguntar, e só quando você perguntar.
              </AppText>
            </View>
            <Toggle value={allowAiNotes} onChange={setAllowAiNotes} />
          </View>

          {allowAiNotes ? (
            <AppText variant="small" className="mt-2.5">
              Suas notas passam a sair do aparelho quando a IA precisar delas. Desligue a qualquer momento.
            </AppText>
          ) : null}
        </View>

        {/* A chave própria fica recolhida: quase ninguém precisa dela, e ver um
            campo de chave de API na primeira tela assusta sem motivo. */}
        <Pressable
          onPress={() => setAdvancedOpen((current) => !current)}
          className="mt-4 flex-row items-center gap-2 px-1 py-2"
        >
          <Feather name={advancedOpen ? 'chevron-down' : 'chevron-right'} size={14} color={tokens.muted} />
          <AppText variant="small">AVANÇADO</AppText>
        </Pressable>

        {advancedOpen ? (
          <View>
            <AppText variant="small" className="mb-2 px-1">
              A IA já vem funcionando pela nossa conta. Se preferir usar a sua chave da OpenRouter, ela
              substitui a nossa e passa a valer sem limite — os pedidos saem por sua conta.
            </AppText>
            <ApiKeyField />
          </View>
        ) : null}

        <Pressable
          onPress={() => router.push('/stats')}
          className="mt-3 flex-row items-center gap-3 rounded-2xl bg-surface-light px-4 py-3.5 active:opacity-70 dark:bg-surface-dark"
        >
          <Feather name="trending-up" size={18} color={tokens.ink} />
          <View className="flex-1">
            <AppText variant="body">Seu estudo</AppText>
            <AppText variant="small">Ofensiva, mapa das últimas semanas e totais</AppText>
          </View>
          <Feather name="chevron-right" size={18} color={tokens.muted} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/diagnostics')}
          className="mt-4 flex-row items-center gap-3 rounded-2xl bg-surface-light px-4 py-3.5 active:opacity-70 dark:bg-surface-dark"
        >
          <Feather name="activity" size={18} color={tokens.ink} />
          <View className="flex-1">
            <AppText variant="body">Diagnóstico</AppText>
            <AppText variant="small">
              {quedas === 0
                ? 'Nenhuma falha registrada'
                : `${quedas} ${quedas === 1 ? 'falha registrada' : 'falhas registradas'} · toque para enviar`}
            </AppText>
          </View>
          <Feather name="chevron-right" size={18} color={tokens.muted} />
        </Pressable>

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
