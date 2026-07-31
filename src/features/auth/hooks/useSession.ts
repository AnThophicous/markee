import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { aplicarPendente } from '@/features/billing/services/afiliado.service';
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

    // Quem tocou num link de indicação sem ter conta foi mandado para o
    // cadastro, e o código ficou guardado esperando esta hora. `aplicarPendente`
    // não faz nada quando não há código guardado — que é o caso de quase toda
    // abertura do app — e tem tranca própria contra as várias telas que usam
    // este hook chamarem juntas.
    aplicarPendente().catch(() => undefined);
  }, [session]);

  return { session, user: session?.user ?? null, isLoading, isSignedIn: Boolean(session) };
}
