import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';
import { clearApiKey, getApiKey, setApiKey } from '../services/openrouter.service';

export function ApiKeyField() {
  const { tokens } = useTheme();
  const [value, setValue] = useState(getApiKey() ?? '');
  const [saved, setSaved] = useState(Boolean(getApiKey()));

  const handleSave = () => {
    const trimmed = value.trim();
    if (trimmed) {
      setApiKey(trimmed);
      setSaved(true);
    } else {
      clearApiKey();
      setSaved(false);
    }
  };

  return (
    <View className="rounded-2xl bg-surface-light px-4 py-4 dark:bg-surface-dark">
      <View className="flex-row items-center gap-2">
        <Feather name="key" size={16} color={tokens.ink} />
        <AppText variant="bodyEmphasis">Chave da OpenRouter</AppText>
        {saved ? <Feather name="check-circle" size={14} color={tokens.accent} /> : null}
      </View>

      <AppText variant="caption" className="mt-1">
        O assistente usa modelos gratuitos. A chave fica apenas neste dispositivo.
      </AppText>

      <View className="mt-3 flex-row items-center gap-2">
        <TextInput
          value={value}
          onChangeText={(text) => {
            setValue(text);
            setSaved(false);
          }}
          placeholder="sk-or-v1-…"
          placeholderTextColor={tokens.muted}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          className="flex-1 rounded-xl bg-subtle-light dark:bg-subtle-dark px-3 py-2.5 text-[15px] text-ink-light dark:text-ink-dark"
        />
        <Pressable
          onPress={handleSave}
          className="rounded-xl bg-accent px-4 py-2.5 active:opacity-80"
        >
          <AppText className="font-semibold text-white">Salvar</AppText>
        </Pressable>
      </View>
    </View>
  );
}
