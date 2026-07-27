import { useState } from 'react';
import { Pressable, ScrollView, Share, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ScreenHeader } from '@/features/navigation/components/ScreenHeader';
import { useBottomInset } from '@/hooks/useBottomInset';
import { limparQuedas, listarQuedas, type CrashReport } from '@/services/crash-reporter';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Mostra as quedas registradas pelo app.
 *
 * O botão de compartilhar é o motivo desta tela existir: sem ele, a informação
 * fica presa dentro do aparelho e não chega a quem pode consertar.
 */
export default function DiagnosticsScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const bottom = useBottomInset(24);

  // Lido uma vez na montagem: a lista não muda enquanto a tela está aberta, e
  // reler a cada render só gastaria trabalho.
  const [quedas, setQuedas] = useState<CrashReport[]>(() => listarQuedas());
  const [aberta, setAberta] = useState<number | null>(null);

  const compartilhar = () => {
    const texto = quedas
      .map(
        (q, i) =>
          `#${i + 1} ${q.em}\n` +
          `${q.fatal ? 'FECHOU O APP' : 'seguiu funcionando'} · tela: ${q.rota}\n` +
          `Markee ${q.versao} · ${q.sistema}\n` +
          `${q.nome}: ${q.mensagem}\n${q.pilha}`
      )
      .join('\n\n———\n\n');

    void Share.share({ message: texto || 'Nenhuma queda registrada.' });
  };

  const limpar = () => {
    limparQuedas();
    setQuedas([]);
    setAberta(null);
  };

  return (
    <View className="flex-1 bg-canvas-light dark:bg-canvas-dark">
      <ScreenHeader title="Diagnóstico" showMenu={false} onBackPress={() => router.back()} />

      <ScrollView className="px-4 pt-2" contentContainerStyle={{ paddingBottom: bottom }}>
        {quedas.length === 0 ? (
          <View className="mt-10 items-center gap-3 px-6">
            <Feather name="check-circle" size={32} color={tokens.muted} />
            <AppText variant="body" className="text-center">
              Nenhuma falha registrada
            </AppText>
            <AppText variant="caption" className="text-center">
              Se o app fechar sozinho ou algo parar de responder, o motivo aparece aqui — inclusive a
              tela em que aconteceu.
            </AppText>
          </View>
        ) : (
          <>
            <AppText variant="caption" className="mb-3 px-1">
              {quedas.length} {quedas.length === 1 ? 'falha registrada' : 'falhas registradas'}. Toque
              para ver o detalhe. O botão abaixo manda tudo de uma vez para quem for consertar.
            </AppText>

            {quedas.map((queda, indice) => (
              <Pressable
                key={`${queda.em}-${indice}`}
                onPress={() => setAberta(aberta === indice ? null : indice)}
                className="mb-2 rounded-2xl bg-surface-light p-4 active:opacity-70 dark:bg-surface-dark"
              >
                <View className="flex-row items-center gap-2">
                  <Feather
                    name={queda.fatal ? 'x-octagon' : 'alert-triangle'}
                    size={14}
                    color={queda.fatal ? tokens.danger : tokens.muted}
                  />
                  <AppText variant="bodyEmphasis" className="flex-1" numberOfLines={1}>
                    {queda.nome}
                  </AppText>
                  <Feather
                    name={aberta === indice ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={tokens.muted}
                  />
                </View>

                <AppText variant="caption" className="mt-1.5" numberOfLines={aberta === indice ? 0 : 2}>
                  {queda.mensagem}
                </AppText>

                <AppText variant="small" className="mt-2">
                  {queda.fatal ? 'Fechou o app' : 'App continuou'} · tela {queda.rota} ·{' '}
                  {formatarData(queda.em)}
                </AppText>

                {aberta === indice ? (
                  <View className="mt-3 rounded-xl bg-subtle-light p-3 dark:bg-subtle-dark">
                    <AppText variant="small" selectable>
                      {queda.pilha || 'Sem detalhamento.'}
                    </AppText>
                    <AppText variant="small" className="mt-2">
                      Markee {queda.versao} · {queda.sistema}
                    </AppText>
                  </View>
                ) : null}
              </Pressable>
            ))}

            <View className="mt-4 gap-2">
              <Button label="Compartilhar as falhas" onPress={compartilhar} />
              <Button label="Limpar registro" variant="ghost" onPress={limpar} />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function formatarData(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;

  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
