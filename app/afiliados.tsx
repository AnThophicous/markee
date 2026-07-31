import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useSession } from '@/features/auth/hooks/useSession';
import {
  creditosDoResgate,
  descreverErroDeAfiliado,
  emPorcento,
  emReais,
  faltaParaResgatar,
  linkDeAfiliado,
  textoDoConvite,
} from '@/features/billing/afiliado';
import { useAfiliado, useResgatar } from '@/features/billing/hooks/useAfiliado';
import { ScreenHeader } from '@/features/navigation/components/ScreenHeader';
import { useBottomInset } from '@/hooks/useBottomInset';
import { useTheme } from '@/theme/ThemeProvider';
import { prettyCode } from '@/utils/markee-link';

/**
 * O programa de indicação.
 *
 * A tela é honesta sobre duas coisas que dariam para esconder e não dão certo
 * escondidas:
 *
 *   1. A comissão só existe quando alguém ASSINA. Indicar dez pessoas que usam
 *      de graça rende zero, e isso está dito em cima, não em letra miúda —
 *      quem descobre isso depois de divulgar um mês fica com razão de reclamar.
 *   2. O resgate hoje sai em crédito de IA, não em dinheiro na conta. Pagamento
 *      em dinheiro depende de um caminho de saque que ainda não existe, e
 *      prometer isso agora seria vender o que não temos.
 */
export default function AfiliadosScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const bottom = useBottomInset(32);
  const { isSignedIn, isLoading: sessaoCarregando } = useSession();

  const { data: afiliado, isLoading } = useAfiliado();
  const resgatar = useResgatar();

  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);

  if (sessaoCarregando || isLoading) {
    return (
      <Screen className="items-center justify-center">
        <ActivityIndicator color={tokens.accent} />
      </Screen>
    );
  }

  if (!isSignedIn) {
    return (
      <Screen>
        <ScreenHeader title="Indique e ganhe" showMenu={false} onBackPress={() => router.back()} />
        <View className="flex-1 items-center justify-center gap-4 px-10">
          <Feather name="users" size={30} color={tokens.muted} />
          <AppText variant="caption" className="text-center">
            Entre na sua conta para ter um link de indicação.
          </AppText>
          <Button label="Entrar" onPress={() => router.push('/login')} />
        </View>
      </Screen>
    );
  }

  // Logado e sem dados quer dizer que o servidor ainda não tem o programa —
  // a versão do aplicativo chegou antes da migração. Melhor dizer isso do que
  // mostrar um link de indicação que não renderia comissão nenhuma.
  if (!afiliado) {
    return (
      <Screen>
        <ScreenHeader title="Indique e ganhe" showMenu={false} onBackPress={() => router.back()} />
        <View className="flex-1 items-center justify-center gap-4 px-10">
          <Feather name="clock" size={30} color={tokens.muted} />
          <AppText variant="heading" className="text-center">
            Ainda não liberado
          </AppText>
          <AppText variant="caption" className="text-center">
            O programa de indicação está sendo preparado no servidor. Volte aqui
            em breve.
          </AppText>
          <Button label="Voltar" variant="secondary" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const link = linkDeAfiliado(afiliado.codigo);
  const falta = faltaParaResgatar(afiliado.abertoCents, afiliado.minimoCents);
  const creditos = creditosDoResgate(afiliado.abertoCents, afiliado.porCredito);

  const compartilhar = async () => {
    try {
      await Share.share({ message: textoDoConvite(afiliado.codigo) });
    } catch {
      // Fechar a folha de compartilhamento cancela e cai aqui. Não é erro.
    }
  };

  const pedirResgate = () => {
    setErro(null);
    setRecado(null);
    resgatar.mutate(undefined, {
      onSuccess: (r) =>
        setRecado(`${emReais(r.centavos)} viraram ${r.creditos} créditos. Já estão na sua conta.`),
      onError: (e) => {
        const m = e instanceof Error ? e.message : 'Não deu para resgatar.';
        setErro(descreverErroDeAfiliado(m) ?? m);
      },
    });
  };

  return (
    <Screen padBottom={false}>
      <ScreenHeader title="Indique e ganhe" showMenu={false} onBackPress={() => router.back()} />

      <ScrollView className="px-4" contentContainerStyle={{ paddingBottom: bottom }}>
        {/* --- o que se ganha --------------------------------------------- */}
        <View className="mt-2 rounded-3xl bg-surface-light p-5 dark:bg-surface-dark">
          <AppText variant="heading">
            {emPorcento(afiliado.primeiraPct)} da primeira mensalidade
          </AppText>
          <AppText variant="caption" className="mt-1">
            E {emPorcento(afiliado.recorrentePct)} de cada renovação, enquanto a
            pessoa continuar assinando.
          </AppText>

          <View className="mt-4 flex-row items-start gap-2.5 rounded-2xl bg-canvas-light p-3 dark:bg-canvas-dark">
            <Feather name="info" size={14} color={tokens.muted} style={{ marginTop: 2 }} />
            <AppText variant="small" className="flex-1">
              A comissão só existe quando a pessoa ASSINA o Pro. Quem vem pelo
              seu link e usa de graça não gera nada — e ela precisa colar o
              código nos primeiros {afiliado.janelaDias} dias da conta.
            </AppText>
          </View>
        </View>

        {/* --- o link ----------------------------------------------------- */}
        <View className="mt-3 rounded-3xl bg-surface-light p-5 dark:bg-surface-dark">
          <AppText variant="small" className="mb-1.5">
            SEU LINK
          </AppText>
          <Pressable
            onPress={compartilhar}
            className="rounded-2xl bg-canvas-light px-4 py-3.5 active:opacity-70 dark:bg-canvas-dark"
          >
            <AppText variant="body" numberOfLines={1}>
              {link}
            </AppText>
            <AppText variant="small" className="mt-0.5">
              código {prettyCode(afiliado.codigo)}
            </AppText>
          </Pressable>

          <Button label="Compartilhar" onPress={compartilhar} className="mt-3" />

          {/* O código não é regenerável de propósito, e vale dizer: quem
              divulgou o link num vídeo precisa saber que ele não vai mudar. */}
          <AppText variant="small" className="mt-2">
            Este código é seu para sempre — ele não muda nem se você trocar de
            nome ou de foto.
          </AppText>
        </View>

        {/* --- os números -------------------------------------------------- */}
        <View className="mt-3 flex-row gap-3">
          <Numero rotulo="Indicados" valor={String(afiliado.indicados)} />
          <Numero rotulo="Assinaram" valor={String(afiliado.assinantes)} destaque />
        </View>

        <View className="mt-3 rounded-3xl bg-surface-light p-5 dark:bg-surface-dark">
          <View className="flex-row items-baseline justify-between">
            <AppText variant="caption">Disponível</AppText>
            <AppText style={{ fontSize: 28, fontWeight: '700' }}>
              {emReais(afiliado.abertoCents)}
            </AppText>
          </View>

          {afiliado.totalCents > afiliado.abertoCents ? (
            <AppText variant="small" className="mt-1 text-right">
              {emReais(afiliado.totalCents)} no total desde o começo
            </AppText>
          ) : null}

          {falta > 0 ? (
            <AppText variant="small" className="mt-3">
              Faltam {emReais(falta)} para poder resgatar.
            </AppText>
          ) : (
            <>
              <Button
                label={resgatar.isPending ? 'Resgatando…' : `Resgatar ${creditos} créditos`}
                onPress={pedirResgate}
                disabled={resgatar.isPending}
                className="mt-3"
              />
              <AppText variant="small" className="mt-2">
                O resgate sai em crédito de IA, que vale o mesmo que comprar o
                melhor pacote da loja. Saque em dinheiro ainda não existe.
              </AppText>
            </>
          )}

          {erro ? (
            <AppText variant="caption" className="mt-2 text-danger">
              {erro}
            </AppText>
          ) : recado ? (
            <AppText variant="caption" className="mt-2 text-accent">
              {recado}
            </AppText>
          ) : null}
        </View>

        {afiliado.fuiIndicado ? (
          <View className="mt-3 flex-row items-center gap-2.5 rounded-2xl bg-surface-light p-4 dark:bg-surface-dark">
            <Feather name="check-circle" size={15} color={tokens.accent} />
            <AppText variant="small" className="flex-1">
              Você entrou por indicação de alguém. Se assinar o Pro, essa pessoa
              recebe a comissão.
            </AppText>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Numero({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  const { tokens } = useTheme();
  return (
    <View className="flex-1 items-center rounded-3xl bg-surface-light py-5 dark:bg-surface-dark">
      <AppText
        style={{ fontSize: 30, fontWeight: '700', color: destaque ? tokens.accent : undefined }}
      >
        {valor}
      </AppText>
      <AppText variant="small" className="mt-0.5">
        {rotulo}
      </AppText>
    </View>
  );
}
