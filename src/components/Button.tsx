import { type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from './AppText';
import { Toque } from './Toque';
import { cn } from '@/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

/**
 * Botão no formato do Material 3.
 *
 * Duas mudanças em relação ao que era:
 *
 * CANTO INTEIRO em vez de `rounded-xl`. A pílula é a forma do botão no Material
 * 3, e é o que separa "botão" de "caixa com texto dentro" num olhar. Não é
 * enfeite: numa tela com cartões arredondados, o botão precisa de outra forma
 * para não sumir entre eles.
 *
 * AFUNDA em vez de apagar. O `active:opacity` que estava aqui reduz a opacidade
 * ao toque — e apagar é o que se faz com coisa desabilitada, o oposto da
 * mensagem que um toque deve passar. Agora encolhe, que é o gesto do Material:
 * o dedo empurra a superfície para dentro.
 */

const fundo: Record<Variant, string> = {
  primary: 'bg-accent',
  secondary: 'bg-subtle-light dark:bg-subtle-dark',
  ghost: 'bg-transparent',
  danger: 'bg-transparent',
};

const texto: Record<Variant, string> = {
  primary: 'text-white font-semibold',
  secondary: 'text-ink-light dark:text-ink-dark font-semibold',
  ghost: 'text-ink-light dark:text-ink-dark font-medium',
  danger: 'text-danger font-medium',
};

// `style` omitido pelo mesmo motivo do Toque: a forma de função reagiria ao
// toque por conta própria, disputando com a animação.
type ButtonProps = Omit<PressableProps, 'style'> & {
  label: string;
  variant?: Variant;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, variant = 'primary', className, ...props }: ButtonProps) {
  return (
    <Toque
      // Os sem fundo próprio somem um pouco junto com o encolher: sem fundo, o
      // encolhimento sozinho quase não se percebe.
      comOpacidade={variant === 'ghost' || variant === 'danger'}
      className={cn(
        'flex-row items-center justify-center rounded-full px-6 py-3.5',
        fundo[variant],
        className
      )}
      {...props}
    >
      <AppText className={texto[variant]} style={{ fontSize: 16 }}>
        {label}
      </AppText>
    </Toque>
  );
}
