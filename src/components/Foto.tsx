import { Image } from 'expo-image';
import type { ImageStyle, StyleProp } from 'react-native';

type FotoProps = {
  uri: string;
  style?: StyleProp<ImageStyle>;
  /** `cover` corta para preencher (padrão); `contain` cabe inteira. */
  ajuste?: 'cover' | 'contain';
  /** Cantos redondos sem precisar de folha de estilo para o caso comum. */
  raio?: number;
};

/**
 * Foto de pessoa ou de grupo — sempre esta, nunca o `Image` do react-native.
 *
 * O MOTIVO É GIF ANIMADO, e ele custou uma descoberta: o `Image` do React
 * Native no Android desenha o PRIMEIRO QUADRO de um GIF e para ali. A animação
 * depende de uma dependência do Fresco (`com.facebook.fresco:animated-gif`) que
 * vem comentada no template, e a pasta android/ é gerada de novo a cada build —
 * qualquer conserto feito lá dentro seria apagado no prebuild seguinte.
 *
 * Ou seja: o Pro prometia foto animada, o banco aceitava o GIF, o arquivo subia
 * animado e ele aparecia parado. Ninguém veria erro nenhum — só uma foto que
 * não mexe, e a conclusão óbvia de que o recurso pago não funciona.
 *
 * O `expo-image` resolve nos dois sistemas, e como bônus traz cache em disco e
 * transição de entrada, o que tira o pisca-branco ao rolar a lista de membros.
 *
 * `style` em vez de `className`: o NativeWind só entende className em
 * componentes que passaram por cssInterop, e este não passou.
 */
export function Foto({ uri, style, ajuste = 'cover', raio }: FotoProps) {
  return (
    <Image
      source={{ uri }}
      style={[raio !== undefined ? { borderRadius: raio } : null, style]}
      contentFit={ajuste}
      // A animação toca sozinha. É o padrão da biblioteca, mas está escrito
      // porque é justamente o ponto de existir este componente.
      autoplay
      // Curta de propósito. Uma transição longa numa lista que rola vira
      // sensação de app lento; 120 ms só esconde o quadro branco do carregamento.
      transition={120}
    />
  );
}
