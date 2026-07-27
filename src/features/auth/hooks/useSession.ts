import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { publishPublicKey } from '@/features/friends/services/friends.service';
import { supabase } from '@/services/supabase';

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  /**
   * Publica a chave pública deste aparelho assim que há sessão. Sem ela, os
   * amigos não conseguem cifrar nada para nós — e o envio deles falharia com
   * uma mensagem que não explicaria nada.
   *
   * Falhar aqui não pode derrubar a tela: sem rede, tenta de novo na próxima
   * abertura.
   */
  useEffect(() => {
    if (!session) return;
    publishPublicKey().catch(() => undefined);
  }, [session]);

  return { session, user: session?.user ?? null, isLoading, isSignedIn: Boolean(session) };
}
