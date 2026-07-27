import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ScreenHeader } from '@/features/navigation/components/ScreenHeader';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Placeholder honesto: as tabelas de plano e cota já existem e são aplicadas
 * pelo banco, mas a troca de plano precisa de um gateway de pagamento com
 * webhook usando a service key. Até lá, não fingimos que dá para assinar.
 */
export default function UpgradeSoonScreen() {
  const router = useRouter();
  const { tokens } = useTheme();

  return (
    <View className="flex-1 bg-canvas-light dark:bg-canvas-dark">
      <ScreenHeader title="Assinatura" showMenu={false} onBackPress={() => router.back()} />

      <View className="flex-1 items-center justify-center gap-4 px-10">
        <Feather name="clock" size={32} color={tokens.accent} />
        <AppText variant="heading" className="text-center">
          Pagamento em breve
        </AppText>
        <AppText variant="caption" className="text-center">
          O plano Pro já está pronto por dentro — falta apenas conectar o meio de pagamento. Enquanto isso, tudo o que
          é gratuito segue sem limite.
        </AppText>
        <Button label="Voltar" variant="ghost" onPress={() => router.back()} />
      </View>
    </View>
  );
}
