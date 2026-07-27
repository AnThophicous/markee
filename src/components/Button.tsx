import { Pressable, type PressableProps } from 'react-native';

import { AppText } from './AppText';
import { cn } from '@/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const containerVariants: Record<Variant, string> = {
  primary: 'bg-accent active:opacity-80',
  secondary: 'bg-subtle-light dark:bg-subtle-dark active:opacity-70',
  ghost: 'bg-transparent active:opacity-60',
  danger: 'bg-transparent active:opacity-60',
};

const textVariants: Record<Variant, string> = {
  primary: 'text-white font-semibold',
  secondary: 'text-ink-light dark:text-ink-dark font-semibold',
  ghost: 'text-ink-light dark:text-ink-dark font-medium',
  danger: 'text-danger font-medium',
};

type ButtonProps = PressableProps & {
  label: string;
  variant?: Variant;
  className?: string;
};

export function Button({ label, variant = 'primary', className, ...props }: ButtonProps) {
  return (
    <Pressable
      className={cn(
        'flex-row items-center justify-center rounded-xl px-5 py-3.5',
        containerVariants[variant],
        className
      )}
      {...props}
    >
      <AppText className={textVariants[variant]} style={{ fontSize: 16 }}>
        {label}
      </AppText>
    </Pressable>
  );
}
