import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Divider } from '@/components/Divider';
import { useMyUsage } from '@/features/billing/hooks/useMyUsage';
import { ScreenHeader } from '@/features/navigation/components/ScreenHeader';
import { useBottomInset } from '@/hooks/useBottomInset';
import { useTheme } from '@/theme/ThemeProvider';

const PRO_FEATURES: { icon: keyof typeof Feather.glyphMap; title: string; detail: string }[] = [
  { icon: 'cpu', title: '500 usos de IA por mês', detail: 'Resumir, gerar flashcards e explicar trechos' },
  { icon: 'mic', title: '20 horas de transcrição', detail: 'Grave a aula e receba o texto' },
  { icon: 'droplet', title: 'Gradientes e efeitos', detail: 'Personalize a aparência dos seus grupos' },
  { icon: 'image', title: 'Ícone animado e banner', detail: 'GIF no ícone do grupo' },
  { icon: 'upload', title: 'Uploads maiores', detail: 'Mais espaço para materiais de estudo' },
];

const FREE_FEATURES = [
  'Notas, pastas, tags e busca — ilimitado',
  'Grupos, salas e chat — ilimitado',
  'Feed, comentários e compartilhamento',
  '20 usos de IA e 60 min de transcrição por mês',
];

export default function UpgradeScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const bottom = useBottomInset(40);
  const { data: usage } = useMyUsage();

  const isPro = usage?.plan === 'pro';

  return (
    <View className="flex-1 bg-canvas-light dark:bg-canvas-dark">
      <ScreenHeader title="Markee Pro" showMenu={false} onBackPress={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingBottom: bottom }}>
        <View className="mx-4 overflow-hidden rounded-3xl">
          <LinearGradient colors={['#F62283', '#7B2FF7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View className="p-6">
              <AppText style={{ fontSize: 30, fontWeight: '700', color: '#fff' }}>
                {isPro ? 'Você é Pro' : 'R$ 9,90'}
              </AppText>
              <AppText style={{ color: 'rgba(255,255,255,0.9)' }}>
                {isPro ? 'Obrigado por apoiar o Markee.' : 'por mês · cancele quando quiser'}
              </AppText>
            </View>
          </LinearGradient>
        </View>

        <View className="px-6 pt-6">
          {PRO_FEATURES.map((feature) => (
            <View key={feature.title} className="mb-4 flex-row items-start gap-3">
              <Feather name={feature.icon} size={18} color={tokens.accent} style={{ marginTop: 2 }} />
              <View className="flex-1">
                <AppText variant="bodyEmphasis">{feature.title}</AppText>
                <AppText variant="caption">{feature.detail}</AppText>
              </View>
            </View>
          ))}
        </View>

        <Divider className="mx-6 my-2" />

        <View className="px-6 pt-4">
          <AppText variant="small" className="mb-3">
            O PLANO GRATUITO CONTINUA COM
          </AppText>
          {FREE_FEATURES.map((item) => (
            <View key={item} className="mb-2 flex-row items-center gap-2.5">
              <Feather name="check" size={15} color={tokens.muted} />
              <AppText variant="caption" className="flex-1">
                {item}
              </AppText>
            </View>
          ))}
          <AppText variant="caption" className="mt-3">
            Nada essencial fica atrás do Pro. Só cobramos o que custa processamento.
          </AppText>
        </View>

        {usage ? (
          <View className="mx-4 mt-6 rounded-2xl bg-surface-light p-4 dark:bg-surface-dark">
            <AppText variant="small" className="mb-2">
              SEU USO ESTE MÊS
            </AppText>
            <AppText variant="body">
              IA: {usage.aiUsed} de {usage.aiLimit}
            </AppText>
            <AppText variant="body">
              Transcrição: {usage.minUsed} de {usage.minLimit} min
            </AppText>
          </View>
        ) : null}

        {!isPro ? (
          <View className="px-6 pt-6">
            <Button label="Assinar o Pro" onPress={() => router.push('/upgrade-soon')} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
