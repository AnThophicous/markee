import { Pressable, ScrollView, View } from 'react-native';
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
  { icon: 'cpu', title: '500 pedidos de IA por mês', detail: 'Sem precisar de chave própria — a conta é nossa' },
  { icon: 'droplet', title: 'Gradiente que você monta', detail: 'Escolhe cada cor, no grupo e no perfil' },
  { icon: 'zap', title: 'Efeitos de luz', detail: 'Varredura, pulso, deriva e giro' },
  { icon: 'image', title: 'Banner e ícone animado', detail: 'GIF no ícone do grupo' },
  { icon: 'layout', title: 'Cartão do grupo', detail: 'Como ele aparece para os outros' },
];

const FREE_FEATURES = [
  'Notas, pastas, tags, busca e lembretes — sem limite',
  'Grupos, salas, feed, enquetes e agenda — sem limite',
  'Amigos por QR e conversa cifrada — sem limite',
  'IA ilimitada com a sua própria chave da OpenRouter',
  '20 pedidos de IA por mês na nossa conta',
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
          <LinearGradient colors={['#0B57D0', '#34A853']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
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
            Nada essencial fica atrás do Pro. E se você usar a sua própria chave da OpenRouter, a IA é ilimitada
            e de graça — não faria sentido cobrar para limitar o que você já paga.
          </AppText>
        </View>

        {usage ? (
          <View className="mx-4 mt-6 rounded-2xl bg-surface-light p-4 dark:bg-surface-dark">
            <AppText variant="small" className="mb-2">
              SEU USO ESTE MÊS
            </AppText>
            <AppText variant="body">
              IA pela nossa conta: {usage.aiUsed} de {usage.aiLimit}
            </AppText>
            <AppText variant="small" className="mt-1">
              Pedidos feitos com a sua própria chave não entram nesta conta.
            </AppText>

          </View>
        ) : null}

        {!isPro ? (
          <View className="px-6 pt-6">
            <Button label="Assinar o Pro" onPress={() => router.push('/upgrade-soon')} />
          </View>
        ) : null}

        {/* Fica aqui embaixo, e não no topo: quem abriu esta tela veio ver o
            Pro, e oferecer "ganhe dinheiro indicando" antes de explicar o
            produto é o jeito mais rápido de parecer esquema de pirâmide. */}
        <Pressable
          onPress={() => router.push('/afiliados')}
          className="mx-4 mt-6 flex-row items-center gap-3 rounded-2xl bg-surface-light p-4 active:opacity-70 dark:bg-surface-dark"
        >
          <Feather name="users" size={18} color={tokens.accent} />
          <View className="flex-1">
            <AppText variant="body">Indique e ganhe</AppText>
            <AppText variant="small">
              Quem assinar pelo seu link te dá uma parte da mensalidade.
            </AppText>
          </View>
          <Feather name="chevron-right" size={18} color={tokens.muted} />
        </Pressable>
      </ScrollView>
    </View>
  );
}
