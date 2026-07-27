import { Pressable, type PressableProps } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { useTheme } from '@/theme/ThemeProvider';
import { cn } from '@/utils/cn';

type IconButtonProps = Omit<PressableProps, 'children'> & {
  name: keyof typeof Feather.glyphMap;
  size?: number;
  color?: string;
  className?: string;
};

export function IconButton({ name, size = 20, color, className, ...props }: IconButtonProps) {
  const { tokens } = useTheme();
  return (
    <Pressable
      className={cn('h-10 w-10 items-center justify-center rounded-full active:bg-subtle-light dark:active:bg-subtle-dark', className)}
      hitSlop={8}
      {...props}
    >
      <Feather name={name} size={size} color={color ?? tokens.ink} />
    </Pressable>
  );
}
