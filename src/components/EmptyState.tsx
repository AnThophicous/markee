import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { AppText } from './AppText';
import { useTheme } from '@/theme/ThemeProvider';

type EmptyStateProps = {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  /** Ação sugerida, logo abaixo do texto. */
  children?: React.ReactNode;
};

export function EmptyState({ icon, title, subtitle, children }: EmptyStateProps) {
  const { tokens } = useTheme();
  return (
    <View className="flex-1 items-center justify-center gap-3 px-10">
      <Feather name={icon} size={32} color={tokens.muted} />
      <AppText variant="heading" className="text-center">
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="caption" className="text-center">
          {subtitle}
        </AppText>
      ) : null}
      {children}
    </View>
  );
}
