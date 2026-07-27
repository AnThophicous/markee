import { Pressable, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';
import type { Poll, PollOption } from '../services/feed.service';

type PollBlockProps = {
  poll: Poll;
  onVote: (optionId: string) => void;
};

export function PollBlock({ poll, onVote }: PollBlockProps) {
  const { tokens } = useTheme();
  const closed = Boolean(poll.closesAt && new Date(poll.closesAt).getTime() < Date.now());
  const iVoted = poll.options.some((option) => option.votedByMe);

  return (
    <View className="mt-2.5 rounded-2xl border border-hairline-light p-3 dark:border-hairline-dark">
      <View className="mb-2 flex-row items-center gap-2">
        <Feather name="bar-chart-2" size={14} color={tokens.accent} />
        <AppText variant="bodyEmphasis" className="flex-1">
          {poll.question}
        </AppText>
      </View>

      <View className="gap-1.5">
        {poll.options.map((option) => (
          <PollBar
            key={option.id}
            option={option}
            total={poll.totalVotes}
            // Antes de votar, as barras ficam escondidas — senão a primeira
            // resposta ancora todo mundo.
            revealed={iVoted || closed}
            disabled={closed}
            onPress={() => onVote(option.id)}
          />
        ))}
      </View>

      <AppText variant="small" className="mt-2">
        {poll.totalVotes} {poll.totalVotes === 1 ? 'voto' : 'votos'}
        {poll.allowMultiple ? ' · escolha múltipla' : ''}
        {closed ? ' · encerrada' : iVoted ? ' · toque de novo para desfazer' : ''}
      </AppText>
    </View>
  );
}

function PollBar({
  option,
  total,
  revealed,
  disabled,
  onPress,
}: {
  option: PollOption;
  total: number;
  revealed: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { tokens } = useTheme();
  const share = total > 0 ? option.voteCount / total : 0;
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(revealed ? share : 0, { duration: 260, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [share, revealed]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="overflow-hidden rounded-xl bg-subtle-light active:opacity-70 dark:bg-subtle-dark"
    >
      <Animated.View
        style={[fillStyle, { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: tokens.accentSoft }]}
      />
      <View className="flex-row items-center gap-2 px-3 py-2.5">
        <Feather
          name={option.votedByMe ? 'check-circle' : 'circle'}
          size={15}
          color={option.votedByMe ? tokens.accent : tokens.muted}
        />
        <AppText variant="body" className="flex-1" numberOfLines={2}>
          {option.label}
        </AppText>
        {revealed ? (
          <AppText variant="small" className={option.votedByMe ? 'text-accent' : undefined}>
            {Math.round(share * 100)}%
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}
