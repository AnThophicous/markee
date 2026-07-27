import { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';
import { hexToHsv, hsvToHex, normalizeHex, type Hsv } from '@/utils/color';

type ColorPickerProps = {
  value: string;
  onChange: (hex: string) => void;
  label?: string;
};

const AREA_HEIGHT = 150;
const HUE_HEIGHT = 28;
const KNOB = 20;

/** Faixa de matiz: as seis paradas do círculo de cores. */
const HUE_STOPS = ['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000'];

/**
 * Seletor de cor livre — matiz numa faixa, saturação/brilho numa área, e o
 * hexadecimal editável para quem já sabe o código que quer.
 *
 * Feito à mão em vez de biblioteca porque só precisa de duas superfícies
 * arrastáveis, e o gesto roda na thread de UI (Reanimated), então o quadrado
 * acompanha o dedo sem passar por JS a cada movimento.
 */
export function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  const { tokens } = useTheme();

  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value));
  const [hexDraft, setHexDraft] = useState(value);
  const [areaWidth, setAreaWidth] = useState(0);
  const [hueWidth, setHueWidth] = useState(0);

  /**
   * Guarda o último hex que ESTE seletor emitiu.
   *
   * Sem isso o valor volta do pai, é convertido de hex para HSV e sobrescreve o
   * estado — e a conversão perde informação: preto não guarda matiz, cinza não
   * guarda saturação. Na prática, arrastar até o fundo do quadrado jogava o
   * matiz de volta para o vermelho e o ponto pulava.
   */
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    setHsv(hexToHsv(value));
    setHexDraft(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = (next: Hsv) => {
    setHsv(next);
    const hex = hsvToHex(next);
    lastEmitted.current = hex;
    setHexDraft(hex);
    onChange(hex);
  };

  const updateSv = (x: number, y: number) => {
    if (areaWidth === 0) return;
    emit({
      h: hsv.h,
      s: Math.min(1, Math.max(0, x / areaWidth)),
      v: 1 - Math.min(1, Math.max(0, y / AREA_HEIGHT)),
    });
  };

  const updateHue = (x: number) => {
    if (hueWidth === 0) return;
    emit({ ...hsv, h: Math.min(360, Math.max(0, (x / hueWidth) * 360)) });
  };

  const areaX = useSharedValue(0);
  const areaY = useSharedValue(0);
  const hueX = useSharedValue(0);

  useEffect(() => {
    areaX.value = hsv.s * areaWidth;
    areaY.value = (1 - hsv.v) * AREA_HEIGHT;
    hueX.value = (hsv.h / 360) * hueWidth;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hsv, areaWidth, hueWidth]);

  /**
   * `manualActivation` + activar no toque: sem isso o ScrollView em volta
   * ganha a disputa pelo gesto e o seletor só rola a folha em vez de mover o
   * ponto. Aqui o pan assume assim que o dedo encosta, e o scroll perde.
   */
  const areaGesture = Gesture.Pan()
    .manualActivation(true)
    .onTouchesDown((_event, manager) => {
      manager.activate();
    })
    .onBegin((event) => {
      areaX.value = event.x;
      areaY.value = event.y;
      runOnJS(updateSv)(event.x, event.y);
    })
    .onUpdate((event) => {
      areaX.value = event.x;
      areaY.value = event.y;
      runOnJS(updateSv)(event.x, event.y);
    });

  const hueGesture = Gesture.Pan()
    .manualActivation(true)
    .onTouchesDown((_event, manager) => {
      manager.activate();
    })
    .onBegin((event) => {
      hueX.value = event.x;
      runOnJS(updateHue)(event.x);
    })
    .onUpdate((event) => {
      hueX.value = event.x;
      runOnJS(updateHue)(event.x);
    });

  const areaKnob = useAnimatedStyle(() => ({
    transform: [
      { translateX: Math.min(areaWidth, Math.max(0, areaX.value)) - KNOB / 2 },
      { translateY: Math.min(AREA_HEIGHT, Math.max(0, areaY.value)) - KNOB / 2 },
    ],
  }));

  const hueKnob = useAnimatedStyle(() => ({
    transform: [{ translateX: Math.min(hueWidth, Math.max(0, hueX.value)) - KNOB / 2 }],
  }));

  const pureHue = hsvToHex({ h: hsv.h, s: 1, v: 1 });
  const current = hsvToHex(hsv);

  const commitHex = () => {
    const parsed = normalizeHex(hexDraft);
    if (parsed) {
      lastEmitted.current = parsed;
      setHsv(hexToHsv(parsed));
      setHexDraft(parsed);
      onChange(parsed);
    } else {
      setHexDraft(current);
    }
  };

  return (
    <View>
      {label ? (
        <AppText variant="small" className="mb-2 px-1">
          {label}
        </AppText>
      ) : null}

      {/* Saturação no eixo X, brilho no Y. */}
      <GestureDetector gesture={areaGesture}>
        <View
          onLayout={(event: LayoutChangeEvent) => setAreaWidth(event.nativeEvent.layout.width)}
          style={{ height: AREA_HEIGHT }}
          className="overflow-hidden rounded-2xl"
        >
          <LinearGradient
            colors={['#FFFFFF', pureHue]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1 }}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0)', '#000000']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              areaKnob,
              {
                position: 'absolute',
                width: KNOB,
                height: KNOB,
                borderRadius: KNOB / 2,
                borderWidth: 3,
                borderColor: '#fff',
                backgroundColor: current,
              },
            ]}
          />
        </View>
      </GestureDetector>

      <GestureDetector gesture={hueGesture}>
        <View
          onLayout={(event: LayoutChangeEvent) => setHueWidth(event.nativeEvent.layout.width)}
          style={{ height: HUE_HEIGHT, marginTop: 12 }}
          className="justify-center overflow-hidden rounded-full"
        >
          <LinearGradient
            colors={HUE_STOPS as [string, string, ...string[]]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ height: HUE_HEIGHT }}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              hueKnob,
              {
                position: 'absolute',
                width: KNOB,
                height: KNOB,
                borderRadius: KNOB / 2,
                borderWidth: 3,
                borderColor: '#fff',
                backgroundColor: pureHue,
              },
            ]}
          />
        </View>
      </GestureDetector>

      <View className="mt-3 flex-row items-center gap-2.5">
        <View style={{ backgroundColor: current }} className="h-10 w-10 rounded-xl" />
        <TextInput
          value={hexDraft}
          onChangeText={setHexDraft}
          onBlur={commitHex}
          onSubmitEditing={commitHex}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={7}
          placeholder="#F62283"
          placeholderTextColor={tokens.muted}
          className="flex-1 rounded-xl bg-subtle-light px-4 py-2.5 text-[16px] text-ink-light dark:bg-subtle-dark dark:text-ink-dark"
        />
      </View>
    </View>
  );
}
