import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { IconButton } from '@/components/IconButton';
import { useUiStore } from '../store/useUiStore';

type ScreenHeaderProps = {
  title: string;
  rightIcon?: keyof typeof Feather.glyphMap;
  onRightPress?: () => void;
  showMenu?: boolean;
  onBackPress?: () => void;
};

export function ScreenHeader({ title, rightIcon, onRightPress, showMenu = true, onBackPress }: ScreenHeaderProps) {
  const openDrawer = useUiStore((state) => state.openDrawer);
  const insets = useSafeAreaInsets();

  return (
    <View style={{ paddingTop: insets.top + 4 }} className="flex-row items-center justify-between px-3 pb-2">
      {showMenu ? (
        <IconButton name="menu" onPress={openDrawer} />
      ) : (
        <IconButton name="chevron-left" onPress={onBackPress} />
      )}
      <AppText variant="heading" numberOfLines={1} className="max-w-[65%]">
        {title}
      </AppText>
      {rightIcon ? <IconButton name={rightIcon} onPress={onRightPress} /> : <View className="h-10 w-10" />}
    </View>
  );
}
