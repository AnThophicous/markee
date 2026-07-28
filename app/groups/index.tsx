import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Divider } from '@/components/Divider';
import { EmptyState } from '@/components/EmptyState';
import { Sheet } from '@/components/Sheet';
import { useSession } from '@/features/auth/hooks/useSession';
import { GroupCard } from '@/features/groups/components/GroupCard';
import { GroupDangerSheet } from '@/features/groups/components/GroupDangerSheet';
import {
  useCreateGroup,
  useDeleteGroup,
  useJoinGroup,
  useLeaveGroup,
  useMyGroups,
} from '@/features/groups/hooks/useGroups';
import type { Group } from '@/features/groups/services/groups.service';
import { ScreenHeader } from '@/features/navigation/components/ScreenHeader';
import { useBottomInset } from '@/hooks/useBottomInset';
import { useTheme } from '@/theme/ThemeProvider';

export default function GroupsScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const bottom = useBottomInset(16);
  const { user, isSignedIn, isLoading: sessionLoading } = useSession();

  const { data: groups, isLoading } = useMyGroups();
  const createGroup = useCreateGroup();
  const joinGroup = useJoinGroup();
  const deleteGroup = useDeleteGroup();
  const leaveGroup = useLeaveGroup();

  const [createVisible, setCreateVisible] = useState(false);
  const [joinVisible, setJoinVisible] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [acoesDe, setAcoesDe] = useState<Group | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionLoading && !isSignedIn) router.replace('/login');
  }, [sessionLoading, isSignedIn, router]);

  const handleCreate = () => {
    setError(null);
    if (!name.trim() || createGroup.isPending) return;
    createGroup.mutate(
      { name },
      {
        onSuccess: (group) => {
          setCreateVisible(false);
          setName('');
          router.push({ pathname: '/groups/[id]', params: { id: group.id } });
        },
        onError: (e) => setError(e.message),
      }
    );
  };

  const handleJoin = () => {
    setError(null);
    if (!code.trim() || joinGroup.isPending) return;
    joinGroup.mutate(code, {
      onSuccess: (group) => {
        setJoinVisible(false);
        setCode('');
        router.push({ pathname: '/groups/[id]', params: { id: group.id } });
      },
      onError: (e) => setError(e.message),
    });
  };

  /**
   * Sair e apagar terminam do mesmo jeito: fecha o painel e a lista se
   * atualiza sozinha, porque as duas mutações invalidam a lista de grupos.
   * O erro fica na tela em vez de sumir — era esse o defeito antigo, a ação
   * falhava e nada acontecia.
   */
  const fecharAcoes = () => {
    setAcoesDe(null);
    setErroAcao(null);
  };

  const handleLeave = () => {
    if (!acoesDe) return;
    setErroAcao(null);
    leaveGroup.mutate(acoesDe.id, {
      onSuccess: fecharAcoes,
      onError: (e) => setErroAcao(e.message),
    });
  };

  const handleDelete = () => {
    if (!acoesDe) return;
    setErroAcao(null);
    deleteGroup.mutate(acoesDe.id, {
      onSuccess: fecharAcoes,
      onError: (e) => setErroAcao(e.message),
    });
  };

  if (sessionLoading || !isSignedIn) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas-light dark:bg-canvas-dark">
        <ActivityIndicator color={tokens.accent} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-canvas-light dark:bg-canvas-dark">
      <ScreenHeader title="Grupos" rightIcon="plus" onRightPress={() => setCreateVisible(true)} />

      {!isLoading && (groups ?? []).length === 0 ? (
        <View className="flex-1">
          <EmptyState
            icon="users"
            title="Nenhum grupo ainda"
            subtitle="Crie um grupo de estudo ou entre em um com o código de convite."
          />
          <View className="gap-3 px-8" style={{ paddingBottom: bottom + 24 }}>
            <Button label="Criar grupo" onPress={() => setCreateVisible(true)} />
            <Button label="Entrar com código" variant="secondary" onPress={() => setJoinVisible(true)} />
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: bottom }}>
          {(groups ?? []).map((group) => (
            <View key={group.id}>
              <GroupCard
                group={group}
                onPress={() => router.push({ pathname: '/groups/[id]', params: { id: group.id } })}
                onLongPress={() => setAcoesDe(group)}
              />
              {/* O separador só faz sentido no estilo simples; os outros já
                  têm forma própria e ficariam com uma risca sobrando. */}
              {group.theme.card === 'plain' ? <Divider /> : null}
            </View>
          ))}

          <Pressable onPress={() => setJoinVisible(true)} className="flex-row items-center gap-3 px-4 py-4">
            <Feather name="log-in" size={18} color={tokens.accent} />
            <AppText variant="body" className="text-accent">
              Entrar com código
            </AppText>
          </Pressable>

          {/* Segurar não se descobre sozinho — por isso está escrito. */}
          <AppText variant="small" className="px-4 pb-2" style={{ color: tokens.muted }}>
            Segure um grupo para sair dele ou apagá-lo.
          </AppText>
        </ScrollView>
      )}

      <GroupDangerSheet
        // Remonta a cada abertura: a confirmação nunca começa armada.
        key={acoesDe?.id ?? 'fechado'}
        visible={Boolean(acoesDe)}
        onClose={fecharAcoes}
        groupName={acoesDe?.name ?? ''}
        isOwner={acoesDe?.ownerId === user?.id}
        onLeave={handleLeave}
        onDelete={handleDelete}
        pending={leaveGroup.isPending || deleteGroup.isPending}
        erro={erroAcao}
      />

      <Sheet visible={createVisible} onClose={() => setCreateVisible(false)} edge="bottom">
        <AppText variant="heading" className="mb-3 px-1">
          Novo grupo
        </AppText>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Nome do grupo"
          placeholderTextColor={tokens.muted}
          autoFocus
          onSubmitEditing={handleCreate}
          className="mb-3 rounded-xl bg-subtle-light px-4 py-3.5 text-[16px] text-ink-light dark:bg-subtle-dark dark:text-ink-dark"
        />
        {error ? <AppText variant="caption" className="mb-2 text-danger">{error}</AppText> : null}
        <Button
          label={createGroup.isPending ? 'Criando…' : 'Criar'}
          onPress={handleCreate}
          disabled={createGroup.isPending}
        />
      </Sheet>

      <Sheet visible={joinVisible} onClose={() => setJoinVisible(false)} edge="bottom">
        <AppText variant="heading" className="mb-1 px-1">
          Entrar em um grupo
        </AppText>
        <AppText variant="caption" className="mb-3 px-1">
          Peça o código de convite para alguém do grupo.
        </AppText>
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="Código de convite"
          placeholderTextColor={tokens.muted}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          onSubmitEditing={handleJoin}
          className="mb-3 rounded-xl bg-subtle-light px-4 py-3.5 text-[16px] text-ink-light dark:bg-subtle-dark dark:text-ink-dark"
        />
        {error ? <AppText variant="caption" className="mb-2 text-danger">{error}</AppText> : null}
        <Button
          label={joinGroup.isPending ? 'Entrando…' : 'Entrar'}
          onPress={handleJoin}
          disabled={joinGroup.isPending}
        />
        <Button
          label="Ler o QR code do convite"
          variant="ghost"
          className="mt-1"
          onPress={() => {
            setJoinVisible(false);
            router.push('/friends/add');
          }}
        />
      </Sheet>
    </View>
  );
}
