import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, vars } from 'nativewind';

import { useSettingsStore } from '@/features/settings/store/useSettingsStore';
import { softTint } from '@/utils/color';
import { themes, type ThemeMode } from './tokens';

type ThemeContextValue = {
  mode: ThemeMode;
  tokens: (typeof themes)['light'];
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const themePreference = useSettingsStore((state) => state.themePreference);
  const accentColor = useSettingsStore((state) => state.accentColor);
  const { colorScheme, setColorScheme } = useColorScheme();

  useEffect(() => {
    setColorScheme(themePreference);
  }, [themePreference, setColorScheme]);

  const mode: ThemeMode = colorScheme === 'dark' ? 'dark' : 'light';

  /**
   * A cor de destaque chega às classes (`bg-accent`, `text-accent`) por
   * variável CSS, porque o Tailwind compila as classes antes do app rodar — não
   * dá para trocar a cor de uma classe já compilada. O `vars()` define a
   * variável nesta View, e todas as telas abaixo herdam.
   */
  const accentVars = useMemo(
    () =>
      vars({
        '--accent': accentColor,
        '--accent-soft': softTint(accentColor, false),
        '--accent-softdark': softTint(accentColor, true),
      }),
    [accentColor]
  );

  // Os tokens em JS (usados nos ícones, que recebem `color=` direto) precisam
  // seguir a mesma cor das classes.
  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      tokens: {
        ...themes[mode],
        accent: accentColor,
        accentSoft: softTint(accentColor, mode === 'dark'),
      },
    }),
    [mode, accentColor]
  );

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <View style={[{ flex: 1 }, accentVars]}>{children}</View>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
