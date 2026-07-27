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
  /**
   * Autorização para a IA ler as notas. Nasce desligada e só muda por toque
   * explícito: é o único caminho pelo qual conteúdo pessoal sai do aparelho.
   */
  allowAiNotes: boolean;
  setThemePreference: (preference: ThemePreference) => void;
  setAccentColor: (hex: string) => void;
  setAllowAiNotes: (allow: boolean) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      themePreference: 'system',
      accentColor: DEFAULT_ACCENT,
      allowAiNotes: false,
      setThemePreference: (preference) => set({ themePreference: preference }),
      setAccentColor: (hex) => set({ accentColor: hex }),
      setAllowAiNotes: (allow) => set({ allowAiNotes: allow }),
    }),
    {
      name: 'markee-settings',
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);
