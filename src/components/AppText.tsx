import { Text, type TextProps } from 'react-native';

import { cn } from '@/utils/cn';

type Variant = 'title' | 'heading' | 'body' | 'bodyEmphasis' | 'caption' | 'small';

const variantClasses: Record<Variant, string> = {
  title: 'text-[28px] font-bold leading-[34px] text-ink-light dark:text-ink-dark',
  heading: 'text-[20px] font-semibold leading-[26px] text-ink-light dark:text-ink-dark',
  body: 'text-[17px] leading-[24px] text-ink-light dark:text-ink-dark',
  bodyEmphasis: 'text-[17px] font-semibold leading-[24px] text-ink-light dark:text-ink-dark',
  caption: 'text-[13px] leading-[18px] text-muted-light dark:text-muted-dark',
  small: 'text-[12px] font-medium leading-[16px] text-muted-light dark:text-muted-dark',
};

type AppTextProps = TextProps & { variant?: Variant };

export function AppText({ variant = 'body', className, ...props }: AppTextProps) {
  return <Text className={cn(variantClasses[variant], className)} {...props} />;
}
