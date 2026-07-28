import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { assinarAvisos, limparAviso, type Aviso } from '@/services/avisos';

/**
 * A faixa de aviso, no alto de tudo.
 *
 * Fica no layout raiz, acima de qualquer tela, para funcionar também quando a
 * falha acontece com um painel aberto por cima — que é justamente quando a
 * pessoa acabou de tocar em algo e espera resposta.
 *
 * Não usa cor de tema para o fundo: um aviso de erro precisa da mesma cara nos
 * dois temas, e ele aparece por cima de fundos que não controlamos.
 */
export function AvisoBar() {
  const insets = useSafeAreaInsets();
  const [aviso, setAviso] = useState<Aviso | null>(null);

  useEffect(() => assinarAvisos(setAviso), []);

  if (!aviso) return null;

  const erro = aviso.tom === 'erro';

  return (
    <Animated.View
      // `key` no id: dois avisos seguidos re-executam a animação de entrada em
      // vez de trocar o texto sem nada acontecer na tela.
      key={aviso.id}
      entering={FadeInUp.duration(180)}
      exiting={FadeOutUp.duration(140)}
      pointerEvents="box-none"
      style={{ position: 'absolute', top: insets.top + 6, left: 12, right: 12, zIndex: 999 }}
    >
      <Pressable onPress={limparAviso}>
        <View
          className="flex-row items-center gap-2.5 rounded-2xl px-4 py-3"
          style={{
            backgroundColor: erro ? '#B3261E' : '#146B3A',
            shadowColor: '#000',
            shadowOpacity: 0.25,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          }}
        >
          <Feather name={erro ? 'alert-circle' : 'check-circle'} size={16} color="#FFFFFF" />
          <AppText style={{ flex: 1, color: '#FFFFFF', fontSize: 13.5, lineHeight: 18 }}>
            {aviso.texto}
          </AppText>
          <Feather name="x" size={15} color="rgba(255,255,255,0.7)" />
        </View>
      </Pressable>
    </Animated.View>
  );
}
