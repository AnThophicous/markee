import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { mmkvStorage } from '@/storage/mmkv';

export type ThemePreference = 'light' | 'dark' | 'system';

/** Rosa da marca. Ponto de partida de quem nunca mexeu na cor. */
/**
 * Azul do Material 3, o mesmo que o Google usa como primária nos apps dele.
 *
 * Não é o #4285F4 da marca: aquele dá 3,1:1 sobre branco e reprova como cor de
 * texto. Este é o azul que o Google adota justamente por causa disso.
 *
 * Continua trocável pela pessoa — personalizar a cor é a ideia do Material You.
 * O que mudou é o ponto de partida.
 */
export const DEFAULT_ACCENT = '#0B57D0';

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
