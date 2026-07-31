import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { ThemePickerSheet } from '@/components/ThemePickerSheet';
import { useSession } from '@/features/auth/hooks/useSession';
import { signOut } from '@/features/auth/services/auth.service';
import { useIsPro, useMyUsage } from '@/features/billing/hooks/useMyUsage';
import { ScreenHeader } from '@/features/navigation/components/ScreenHeader';
import { ProfileHeader } from '@/features/profile/components/ProfileHeader';
import { StatusSheet } from '@/features/profile/components/StatusSheet';
import { formatoDaImagem, gifEhAnimado } from '@/features/profile/services/profile.service';
import { useProfile, useUpdateProfile, useUploadProfileImage } from '@/features/profile/hooks/useProfile';
import { useBottomInset } from '@/hooks/useBottomInset';
import { useTheme } from '@/theme/ThemeProvider';
import { describeProError, type VisualTheme } from '@/theme/visual';
import { prettyCode } from '@/utils/markee-link';

const BIO_LIMIT = 300;

/**
 * A imagem escolhida vai ficar parada?
 *
 * Só sabe dizer de GIF. Qualquer outro formato devolve `false` — "não sei" e
 * "não está parada" dão no mesmo aqui, porque o resultado só decide se um aviso
 * aparece. Errar para o lado de calar é melhor do que avisar errado.
 */
async function pareceParada(uri: string): Promise<boolean> {
  try {
    const bytes = new Uint8Array(await (await fetch(uri)).arrayBuffer());
    if (formatoDaImagem(bytes)?.mime !== 'image/gif') return false;
    return !gifEhAnimado(bytes);
  } catch {
    return false;
  }
}

export default function ProfileScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const bottom = useBottomInset(32);
  const { user, isLoading: sessionLoading } = useSession();

  const { data: profile, isLoading } = useProfile(user?.id);
  const updateProfile = useUpdateProfile(user?.id);
  const uploadImage = useUploadProfileImage(user?.id);
  const { isPro } = useIsPro();
  const { data: usage } = useMyUsage();

  const [displayName, setDisplayName] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [themeVisible, setThemeVisible] = useState(false);
  const [statusVisible, setStatusVisible] = useState(false);
  const [fotoAberta, setFotoAberta] = useState(false);
  const [alvoDaFoto, setAlvoDaFoto] = useState<'avatar' | 'banner'>('avatar');
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setPronouns(profile.pronouns ?? '');
      setHeadline(profile.headline ?? '');
      setBio(profile.bio ?? '');
    }
  }, [profile]);

  useEffect(() => {
    if (!sessionLoading && !user) router.replace('/login');
  }, [sessionLoading, user, router]);

  /**
   * Escolher e enviar a imagem.
   *
   * `animada` muda duas coisas que parecem detalhe e não são: desliga o recorte
   * e sobe a qualidade para 1. Recortar reescreve o arquivo, e reescrever um
   * GIF achata a animação num quadro só — era exatamente isso que acontecia
   * antes, silenciosamente, com quem assinava o Pro para ter foto animada.
   *
   * O preço de não recortar é a pessoa não escolher o enquadramento. Vale a
   * troca: quem escolhe "animada" está atrás do movimento, não do corte.
   */
  const pick = async (kind: 'avatar' | 'banner', animada = false) => {
    setError(null);
    setAviso(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Precisamos de acesso às suas fotos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: !animada,
      aspect: kind === 'avatar' ? [1, 1] : [3, 1],
      quality: animada ? 1 : 0.85,
    });
    if (result.canceled) return;

    if (animada) {
      const parada = await pareceParada(result.assets[0].uri);
      // Avisa e envia mesmo assim: pode ser que a pessoa queira mesmo aquela
      // imagem. Barrar aqui seria decidir por ela; não avisar seria deixá-la
      // achando que o recurso pago está quebrado.
      if (parada) setAviso('Essa imagem não tem animação — vai ficar parada, como uma foto normal.');
    }

    uploadImage.mutate(
      { kind, uri: result.assets[0].uri },
      {
        onError: (e) => {
          const message = e instanceof Error ? e.message : 'Falha ao enviar a imagem.';
          setError(describeProError(message) ?? message);
        },
      }
    );
  };

  const escolher = (kind: 'avatar' | 'banner') => {
    setAlvoDaFoto(kind);
    setFotoAberta(true);
  };

  const save = () => {
    setError(null);
    setSaved(false);
    updateProfile.mutate(
      { displayName: displayName.trim() || 'Estudante', pronouns, headline, bio },
      {
        onSuccess: () => setSaved(true),
        onError: (e) => {
          const message = e instanceof Error ? e.message : 'Falha ao salvar.';
          setError(describeProError(message) ?? message);
        },
      }
    );
  };

  const saveTheme = async (theme: VisualTheme) => {
    await updateProfile.mutateAsync({ theme });
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  if (sessionLoading || isLoading || !user || !profile) {
    return (
      <Screen className="items-center justify-center">
        <ActivityIndicator color={tokens.accent} />
      </Screen>
    );
  }

  // Prévia ao vivo: o cabeçalho reflete o que está sendo digitado.
  const preview = { ...profile, displayName: displayName || 'Estudante', pronouns, headline, bio };

  return (
    <View className="flex-1 bg-canvas-light dark:bg-canvas-dark">
      <ScreenHeader
        title="Seu perfil"
        showMenu={false}
        onBackPress={() => router.back()}
        rightIcon="droplet"
        onRightPress={() => setThemeVisible(true)}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: bottom }} keyboardShouldPersistTaps="handled">
        {uploadImage.isPending ? (
          <View className="absolute right-4 top-2 z-10">
            <ActivityIndicator color={tokens.accent} />
          </View>
        ) : null}

        <ProfileHeader
          profile={preview}
          isPro={isPro}
          onPressAvatar={() => escolher('avatar')}
          onPressBanner={() => escolher('banner')}
          onPressStatus={() => setStatusVisible(true)}
        />

        <View className="gap-3 px-5">
          <Field label="NOME DE EXIBIÇÃO">
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Como você aparece nos grupos"
              placeholderTextColor={tokens.muted}
              maxLength={40}
              className="rounded-xl bg-subtle-light px-4 py-3.5 text-[16px] text-ink-light dark:bg-subtle-dark dark:text-ink-dark"
            />
          </Field>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field label="PRONOMES">
                <TextInput
                  value={pronouns}
                  onChangeText={setPronouns}
                  placeholder="ele/dele"
                  placeholderTextColor={tokens.muted}
                  maxLength={24}
                  className="rounded-xl bg-subtle-light px-4 py-3.5 text-[16px] text-ink-light dark:bg-subtle-dark dark:text-ink-dark"
                />
              </Field>
            </View>
            {/* Chamava-se STATUS. Passou a "frase" quando o recado de verdade
                chegou: são coisas diferentes — a frase é fixa e fica abaixo do
                nome, o recado é do momento e vence sozinho. Dois campos com o
                mesmo nome na mesma tela ninguém entende. */}
            <View className="flex-[1.4]">
              <Field label="FRASE FIXA">
                <TextInput
                  value={headline}
                  onChangeText={setHeadline}
                  placeholder="Estudando para o ENEM"
                  placeholderTextColor={tokens.muted}
                  maxLength={60}
                  className="rounded-xl bg-subtle-light px-4 py-3.5 text-[16px] text-ink-light dark:bg-subtle-dark dark:text-ink-dark"
                />
              </Field>
            </View>
          </View>

          <Field label={`BIO · ${bio.length}/${BIO_LIMIT}`}>
            <TextInput
              value={bio}
              onChangeText={(text) => setBio(text.slice(0, BIO_LIMIT))}
              placeholder="Conte um pouco sobre você e o que está estudando."
              placeholderTextColor={tokens.muted}
              multiline
              className="min-h-[92px] rounded-xl bg-subtle-light px-4 py-3.5 text-[16px] text-ink-light dark:bg-subtle-dark dark:text-ink-dark"
              style={{ textAlignVertical: 'top' }}
            />
          </Field>

          <Pressable
            onPress={() => setThemeVisible(true)}
            className="flex-row items-center gap-3 rounded-2xl bg-surface-light px-4 py-3.5 active:opacity-70 dark:bg-surface-dark"
          >
            <Feather name="droplet" size={18} color={tokens.accent} />
            <View className="flex-1">
              <AppText variant="body">Aparência do perfil</AppText>
              <AppText variant="small">
                {profile.theme.kind === 'gradient' ? 'Gradiente' : 'Cor sólida'}
                {profile.theme.effect !== 'none' ? ' · com efeito' : ''}
              </AppText>
            </View>
            <Feather name="chevron-right" size={18} color={tokens.muted} />
          </Pressable>

          <Pressable
            onPress={() => router.push('/friends/add')}
            className="flex-row items-center gap-3 rounded-2xl bg-surface-light px-4 py-3.5 active:opacity-70 dark:bg-surface-dark"
          >
            <Feather name="grid" size={18} color={tokens.accent} />
            <View className="flex-1">
              <AppText variant="body">Meu QR code</AppText>
              <AppText variant="small">
                {profile.friendCode ? prettyCode(profile.friendCode) : 'Gerando…'}
              </AppText>
            </View>
            <Feather name="chevron-right" size={18} color={tokens.muted} />
          </Pressable>

          <Pressable
            onPress={() => router.push('/afiliados')}
            className="flex-row items-center gap-3 rounded-2xl bg-surface-light px-4 py-3.5 active:opacity-70 dark:bg-surface-dark"
          >
            <Feather name="users" size={18} color={tokens.accent} />
            <View className="flex-1">
              <AppText variant="body">Indique e ganhe</AppText>
              <AppText variant="small">Comissão de quem assinar pelo seu link.</AppText>
            </View>
            <Feather name="chevron-right" size={18} color={tokens.muted} />
          </Pressable>

          <Pressable
            onPress={() => router.push('/upgrade')}
            className="flex-row items-center gap-3 rounded-2xl bg-surface-light px-4 py-3.5 active:opacity-70 dark:bg-surface-dark"
          >
            <Feather name="zap" size={18} color={tokens.accent} />
            <View className="flex-1">
              <AppText variant="body">{isPro ? 'Markee Pro' : 'Assinar o Pro'}</AppText>
              <AppText variant="small">
                {usage ? `IA: ${usage.aiUsed}/${usage.aiLimit} · Transcrição: ${usage.minUsed}/${usage.minLimit} min` : '—'}
              </AppText>
            </View>
            <Feather name="chevron-right" size={18} color={tokens.muted} />
          </Pressable>

          {error ? (
            <AppText variant="caption" className="text-danger">
              {error}
            </AppText>
          ) : aviso ? (
            <AppText variant="caption">{aviso}</AppText>
          ) : saved ? (
            <AppText variant="caption" className="text-accent">
              Perfil salvo.
            </AppText>
          ) : null}

          <Button
            label={updateProfile.isPending ? 'Salvando…' : 'Salvar'}
            onPress={save}
            disabled={updateProfile.isPending}
            className="mt-1"
          />

          <AppText variant="small" className="mt-2 text-center">
            {user.email}
          </AppText>
          <Button label="Sair da conta" variant="danger" onPress={handleSignOut} />
        </View>
      </ScrollView>

      {/* Salva sozinho, sem passar pelo botão "Salvar" lá embaixo: o recado é
          de uso rápido, e obrigar a rolar a tela até o botão depois de escolher
          um emoji faria pouca gente usar. */}
      <StatusSheet
        visible={statusVisible}
        onClose={() => setStatusVisible(false)}
        profile={profile}
        salvando={updateProfile.isPending}
        onSalvar={(patch) => {
          setError(null);
          updateProfile.mutate(patch, {
            onError: (e) => {
              const message = e instanceof Error ? e.message : 'Falha ao salvar o recado.';
              setError(describeProError(message) ?? message);
            },
          });
        }}
      />

      {/* A opção animada aparece para todo mundo, com a etiqueta PRO, e não só
          para quem já assina. Recurso pago escondido de quem não paga não vende
          nada: ninguém procura o que não sabe que existe. */}
      <Sheet visible={fotoAberta} onClose={() => setFotoAberta(false)} edge="bottom">
        <AppText variant="heading" className="mb-1 px-1">
          {alvoDaFoto === 'avatar' ? 'Sua foto' : 'Sua capa'}
        </AppText>
        <AppText variant="small" className="mb-3 px-1">
          {alvoDaFoto === 'avatar'
            ? 'Como você aparece nos grupos e no chat.'
            : 'A faixa colorida no topo do perfil.'}
        </AppText>

        <Pressable
          onPress={() => {
            setFotoAberta(false);
            pick(alvoDaFoto);
          }}
          className="flex-row items-center gap-3 rounded-2xl bg-surface-light px-4 py-3.5 active:opacity-70 dark:bg-surface-dark"
        >
          <Feather name="crop" size={18} color={tokens.accent} />
          <View className="flex-1">
            <AppText variant="body">Foto normal</AppText>
            <AppText variant="small">Você escolhe o enquadramento.</AppText>
          </View>
        </Pressable>

        <Pressable
          onPress={() => {
            setFotoAberta(false);
            if (isPro) pick(alvoDaFoto, true);
            else router.push('/upgrade');
          }}
          className="mt-2 flex-row items-center gap-3 rounded-2xl bg-surface-light px-4 py-3.5 active:opacity-70 dark:bg-surface-dark"
        >
          <Feather name="film" size={18} color={isPro ? tokens.accent : tokens.muted} />
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <AppText variant="body" style={{ opacity: isPro ? 1 : 0.6 }}>
                Imagem animada
              </AppText>
              {!isPro ? (
                <View className="rounded-full bg-accent px-2 py-0.5">
                  <AppText style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>PRO</AppText>
                </View>
              ) : null}
            </View>
            <AppText variant="small">
              {isPro
                ? 'GIF, sem recorte para a animação não se perder.'
                : 'GIF que mexe de verdade, no plano Pro.'}
            </AppText>
          </View>
          <Feather name="chevron-right" size={18} color={tokens.muted} />
        </Pressable>
      </Sheet>

      <ThemePickerSheet
        visible={themeVisible}
        title="Aparência do perfil"
        onClose={() => setThemeVisible(false)}
        current={profile.theme}
        isPro={isPro}
        onSave={saveTheme}
        onUpgrade={() => {
          setThemeVisible(false);
          router.push('/upgrade');
        }}
      />
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <AppText variant="small" className="mb-1.5 px-1">
        {label}
      </AppText>
      {children}
    </View>
  );
}
