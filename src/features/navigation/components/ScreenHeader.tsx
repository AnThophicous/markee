import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { IconButton } from '@/components/IconButton';
import { Toque } from '@/components/Toque';
import { useUiStore } from '../store/useUiStore';

type ScreenHeaderProps = {
  title: string;
  /** Linha menor sob o título — contagem de membros, estado da sala. */
  subtitle?: string;
  rightIcon?: keyof typeof Feather.glyphMap;
  onRightPress?: () => void;
  showMenu?: boolean;
  onBackPress?: () => void;
  /**
   * Tocar no título abre as informações do lugar onde se está.
   *
   * É o gesto do WhatsApp: o nome da conversa é o caminho para os detalhes
   * dela. Resolve um problema real — o mural do grupo tem um ícone só à
   * direita, já ocupado pelo compositor, e sem isto as configurações do grupo
   * ficariam inalcançáveis desde que a lista passou a abrir direto no mural.
   */
  onTitlePress?: () => void;
};

export function ScreenHeader({
  title,
  subtitle,
  rightIcon,
  onRightPress,
  showMenu = true,
  onBackPress,
  onTitlePress,
}: ScreenHeaderProps) {
  const openDrawer = useUiStore((state) => state.openDrawer);
  const insets = useSafeAreaInsets();

  return (
    <View style={{ paddingTop: insets.top + 4 }} className="flex-row items-center justify-between px-3 pb-2">
      {showMenu ? (
        <IconButton name="menu" onPress={openDrawer} />
      ) : (
        <IconButton name="chevron-left" onPress={onBackPress} />
      )}
      {onTitlePress ? (
        <Toque
          onPress={onTitlePress}
          escala={0.96}
          className="max-w-[65%] items-center"
          accessibilityRole="button"
          accessibilityHint="Abre as informações e ajustes"
        >
          <AppText variant="heading" numberOfLines={1}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="small" numberOfLines={1}>
              {subtitle}
            </AppText>
          ) : null}
        </Toque>
      ) : (
        <View className="max-w-[65%] items-center">
          <AppText variant="heading" numberOfLines={1}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="small" numberOfLines={1}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
      )}
      {rightIcon ? <IconButton name={rightIcon} onPress={onRightPress} /> : <View className="h-10 w-10" />}
    </View>
  );
}
