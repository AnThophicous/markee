import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { clearKeys } from '@/features/crypto/e2e';
import { supabase } from '@/services/supabase';

WebBrowser.maybeCompleteAuthSession();

/**
 * Google é o único provedor ativo no projeto. Login por e-mail/senha está
 * desligado no painel do Supabase — para reativar, ligue o provedor Email lá
 * e volte a usar supabase.auth.signInWithPassword / signUp aqui.
 */
export async function signInWithGoogle(): Promise<void> {
  const redirectTo = Linking.createURL('/');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw new Error(translateAuthError(error.message));
  if (!data.url) throw new Error('Não foi possível iniciar o login com Google.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') {
    throw new Error('Login cancelado.');
  }

  const code = extractCode(result.url);
  if (!code) throw new Error('O Google não devolveu um código de acesso.');

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw new Error(translateAuthError(exchangeError.message));
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(translateAuthError(error.message));

  // A chave privada é o que abre as conversas. Deixá-la num aparelho de onde a
  // pessoa saiu seria guardar a chave da casa na fechadura.
  clearKeys();
}

/**
 * O suporte a `new URL().searchParams` é irregular no Hermes, e o código pode
 * voltar tanto na query quanto no fragmento. Extraímos na mão para não depender
 * disso.
 */
function extractCode(url: string): string | null {
  const match = url.match(/[?#&]code=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function translateAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('provider is not enabled')) {
    return 'O login com Google não está ativo no servidor.';
  }
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return 'Muitas tentativas. Aguarde um momento.';
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Sem conexão. Verifique sua internet e tente de novo.';
  }
  return message;
}
