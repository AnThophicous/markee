import { Pressable, ScrollView, Text, View } from 'react-native';

type FatalScreenProps = {
  title: string;
  message: string;
  /** Detalhe técnico. Fica recolhido no fim, para não assustar quem só quer usar. */
  detail?: string;
  onRetry?: () => void;
};

/**
 * Tela de último recurso, para quando o app não consegue nem começar.
 *
 * De propósito ela não usa o ThemeProvider, o NativeWind, os ícones nem o
 * AppText: se a falha estiver justamente em um desses, uma tela que dependa
 * deles falha junto e a pessoa volta a ver só "o app apresenta falhas
 * continuamente". Aqui é React Native puro com estilo embutido, que funciona
 * enquanto o React conseguir desenhar qualquer coisa.
 *
 * As cores são fixas (fundo escuro) porque ler o tema exigiria o armazenamento,
 * que é mais uma peça que pode ser a culpada.
 */
export function FatalScreen({ title, message, detail, onRetry }: FatalScreenProps) {
  return (
    <View style={{ flex: 1, backgroundColor: '#0B0B0F' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 28 }}>
        <Text style={{ color: '#F62283', fontSize: 13, fontWeight: '600', letterSpacing: 1 }}>
          MARKEE
        </Text>

        <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '700', marginTop: 14 }}>
          {title}
        </Text>

        <Text style={{ color: '#A1A1AA', fontSize: 15, lineHeight: 22, marginTop: 12 }}>
          {message}
        </Text>

        {onRetry ? (
          <Pressable
            onPress={onRetry}
            style={{
              marginTop: 26,
              backgroundColor: '#F62283',
              borderRadius: 14,
              paddingVertical: 14,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
              Tentar de novo
            </Text>
          </Pressable>
        ) : null}

        {detail ? (
          <Text
            selectable
            style={{ color: '#52525B', fontSize: 12, lineHeight: 18, marginTop: 28 }}
          >
            {detail}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
