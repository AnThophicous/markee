import { Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';
import { statusAtivo, type Profile } from '../services/profile.service';

type StatusBadgeProps = {
  profile: Pick<Profile, 'statusText' | 'statusEmoji' | 'statusUntil'> | null | undefined;
  /** Só no próprio perfil: sem recado, vira o convite para escrever um. */
  onPress?: () => void;
};

/**
 * O recado, do jeito que os outros veem.
 *
 * Some sozinho quando vence — quem decide é o `statusAtivo`, comparando com o
 * horário de agora. No perfil de outra pessoa, sem recado não desenha nada; no
 * próprio, vira o convite para escrever.
 */
export function StatusBadge({ profile, onPress }: StatusBadgeProps) {
  const { tokens } = useTheme();
  const ativo = statusAtivo(profile);

  if (!ativo) {
    if (!onPress) return null;
    return (
      <Pressable
        onPress={onPress}
        className="mt-2 flex-row items-center gap-1.5 self-start rounded-full bg-subtle-light px-3 py-1.5 active:opacity-60 dark:bg-subtle-dark"
      >
        <Feather name="message-circle" size={13} color={tokens.muted} />
        <AppText variant="small" style={{ color: tokens.muted }}>
          Adicionar recado
        </AppText>
      </Pressable>
    );
  }

  const conteudo = (
    <View className="mt-2 flex-row items-center gap-1.5 self-start rounded-full bg-subtle-light px-3 py-1.5 dark:bg-subtle-dark">
      {ativo.emoji ? <AppText style={{ fontSize: 14 }}>{ativo.emoji}</AppText> : null}
      {ativo.texto ? (
        <AppText variant="small" numberOfLines={1}>
          {ativo.texto}
        </AppText>
      ) : null}
    </View>
  );

  if (!onPress) return conteudo;
  return (
    <Pressable onPress={onPress} className="active:opacity-60">
      {conteudo}
    </Pressable>
  );
}
