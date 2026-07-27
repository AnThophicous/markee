import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { mmkvStorage } from '@/storage/mmkv';

export type ThemePreference = 'light' | 'dark' | 'system';

/** Rosa da marca. Ponto de partida de quem nunca mexeu na cor. */
export const DEFAULT_ACCENT = '#F62283';

type SettingsState = {
  themePreference: ThemePreference;
  /** Cor de destaque do app inteiro — fica no aparelho, não no servidor. */
  accentColor: string;
  setThemePreference: (preference: ThemePreference) => void;
  setAccentColor: (hex: string) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      themePreference: 'system',
      accentColor: DEFAULT_ACCENT,
      setThemePreference: (preference) => set({ themePreference: preference }),
      setAccentColor: (hex) => set({ accentColor: hex }),
    }),
    {
      name: 'markee-settings',
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);
