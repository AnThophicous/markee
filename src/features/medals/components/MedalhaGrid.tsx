import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';

import { COR_DO_NIVEL, estadoDas, placar, proximaMedalha, type Numeros } from '../medalhas';

/**
 * As medalhas, todas visíveis desde o primeiro dia.
 *
 * As não conquistadas aparecem apagadas, com o que falta escrito embaixo. A
 * alternativa — esconder até ganhar — deixa a tela vazia justo para quem acabou
 * de instalar, e ninguém persegue um alvo que não sabe que existe.
 */
export function MedalhaGrid({ numeros }: { numeros: Numeros }) {
  const { tokens } = useTheme();
  const medalhas = estadoDas(numeros);
  const conta = placar(numeros);
  const proxima = proximaMedalha(numeros);

  return (
    <View>
      <View className="mb-2 flex-row items-center justify-between px-1">
        <AppText variant="caption">Medalhas</AppText>
        <AppText variant="small">
          {conta.ganhas} de {conta.total}
        </AppText>
      </View>

      <View className="rounded-3xl bg-surface-light p-4 dark:bg-surface-dark">
        <View className="flex-row flex-wrap justify-between gap-y-4">
          {medalhas.map((m) => {
            const cor = m.conquistada ? COR_DO_NIVEL[m.nivel] : tokens.muted;
            return (
              <View
                key={m.id}
                className="w-[22%] items-center"
                accessibilityLabel={
                  m.conquistada
                    ? `${m.nome}, conquistada`
                    : `${m.nome}, bloqueada. ${m.comoGanhar}. ${m.atual} de ${m.meta}`
                }
              >
                <View
                  className="h-12 w-12 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: cor + (m.conquistada ? '26' : '12'),
                    borderWidth: m.conquistada ? 1.5 : 0,
                    borderColor: cor,
                  }}
                >
                  <Feather
                    name={m.icone as keyof typeof Feather.glyphMap}
                    size={19}
                    color={cor}
                    style={m.conquistada ? undefined : { opacity: 0.45 }}
                  />
                </View>

                <AppText
                  variant="small"
                  numberOfLines={2}
                  className="mt-1.5 text-center"
                  style={{ opacity: m.conquistada ? 1 : 0.5 }}
                >
                  {m.nome}
                </AppText>

                {/* A barrinha só aparece em quem já começou e ainda não terminou:
                    zero por cento não informa nada e cem por cento já é o anel. */}
                {!m.conquistada && m.fracao > 0 ? (
                  <View className="mt-1 h-0.5 w-8 overflow-hidden rounded-full bg-hairline-light dark:bg-hairline-dark">
                    <View
                      className="h-full rounded-full"
                      style={{ width: `${m.fracao * 100}%`, backgroundColor: tokens.accent }}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        {proxima ? (
          <View className="mt-4 flex-row items-center gap-2 border-t border-hairline-light pt-3 dark:border-hairline-dark">
            <Feather name="target" size={14} color={tokens.muted} />
            <AppText variant="small" className="flex-1">
              Próxima: {proxima.comoGanhar} — {proxima.atual} de {proxima.meta}
            </AppText>
          </View>
        ) : (
          <View className="mt-4 flex-row items-center gap-2 border-t border-hairline-light pt-3 dark:border-hairline-dark">
            <Feather name="award" size={14} color={COR_DO_NIVEL.diamante} />
            <AppText variant="small" className="flex-1">
              Todas conquistadas. Sinceramente: parabéns.
            </AppText>
          </View>
        )}
      </View>
    </View>
  );
}
