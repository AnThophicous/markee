import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { encodeQr } from '@/utils/qrcode';

type QrCodeProps = {
  value: string;
  size?: number;
  color?: string;
  background?: string;
};

/** Margem clara exigida pela norma; sem ela muitos leitores não acham o código. */
const QUIET_ZONE = 4;

/**
 * Desenha o QR num único `Path`.
 *
 * Um `<Rect>` por módulo daria mais de mil nós numa versão média, o que pesa
 * para renderizar e para animar. Concatenar tudo num caminho só mantém a árvore
 * enxuta e o resultado é idêntico.
 */
export function QrCode({ value, size = 220, color = '#000000', background = '#FFFFFF' }: QrCodeProps) {
  const { path, dimension } = useMemo(() => {
    const matrix = encodeQr(value);
    const dimension = matrix.length + QUIET_ZONE * 2;

    let path = '';
    for (let row = 0; row < matrix.length; row += 1) {
      for (let col = 0; col < matrix.length; col += 1) {
        if (matrix[row][col]) {
          path += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
        }
      }
    }
    return { path, dimension };
  }, [value]);

  return (
    <View style={{ backgroundColor: background, borderRadius: 16, padding: 8 }}>
      <Svg width={size} height={size} viewBox={`0 0 ${dimension} ${dimension}`}>
        <Rect x={0} y={0} width={dimension} height={dimension} fill={background} />
        <Path d={path} fill={color} />
      </Svg>
    </View>
  );
}
