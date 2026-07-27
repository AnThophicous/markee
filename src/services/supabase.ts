import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { storage } from '@/storage/mmkv';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Estas duas variáveis viram texto fixo dentro do pacote na hora em que o Babel
 * compila, e não são lidas quando o app abre. Se elas faltarem na máquina que
 * compilou, o valor gravado é `undefined` — e não há nada que o aparelho possa
 * fazer a respeito depois.
 *
 * Este arquivo JÁ chegou a interromper a execução aqui mesmo, no carregamento do
 * módulo. Como o expo-router avalia as rotas antes de desenhar qualquer coisa,
 * isso derrubava o app antes da primeira tela: para quem instalou, virava só
 * "o app apresenta falhas continuamente", sem pista nenhuma da causa.
 *
 * Por isso agora o erro é anunciado em vez de lançado. Quem monta a interface
 * decide o que mostrar, e a pessoa lê o motivo. O `scripts/env-check.js` impede
 * que um pacote assim chegue a ser gerado; isto aqui é a rede de segurança de
 * baixo.
 */
export const configError =
  !supabaseUrl || !supabaseKey
    ? 'Este APK foi compilado sem o endereço do servidor. Não é um problema do seu aparelho: o pacote precisa ser gerado de novo com as variáveis EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
    : null;

/** Sessão persistida no MMKV — o mesmo storage já usado pelas preferências. */
const mmkvAuthStorage = {
  getItem: async (key: string) => storage.getString(key) ?? null,
  setItem: async (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: async (key: string) => {
    storage.remove(key);
  },
};

// Endereço de reserva só para o cliente conseguir ser construído quando a
// configuração faltou. `.invalid` é reservado pela RFC 2606 e nunca resolve, então
// qualquer chamada que escape falha na rede — jamais em um servidor de verdade.
export const supabase: SupabaseClient = createClient(
  supabaseUrl ?? 'https://nao-configurado.invalid',
  supabaseKey ?? 'sem-chave',
  {
    auth: {
      storage: mmkvAuthStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Não há URL de navegador para inspecionar em app nativo.
      detectSessionInUrl: false,
      // PKCE: o código volta pelo deep link e é trocado por sessão no app.
      flowType: 'pkce',
    },
  }
);

// Só renova o token enquanto o app está em primeiro plano, para poupar bateria.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
