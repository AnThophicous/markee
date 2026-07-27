import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Share, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Divider } from '@/components/Divider';
import { QrCode } from '@/components/QrCode';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { ThemeBanner } from '@/components/ThemeBanner';
import { ThemePickerSheet } from '@/components/ThemePickerSheet';
import { useIsPro } from '@/features/billing/hooks/useMyUsage';
import { EventSheet } from '@/features/groups/components/EventSheet';
import { GroupBanner } from '@/features/groups/components/GroupBanner';
import { useCreateEvent, useDeleteEvent, useGroupEvents } from '@/features/groups/hooks/useGroupEvents';
import {
  useCreateRoom,
  useDeleteGroup,
  useGroup,
  useLeaveGroup,
  useMembers,
  useMyPermissions,
  useRooms,
  useUpdateGroup,
} from '@/features/groups/hooks/useGroups';
import { Permission, hasPermission } from '@/features/groups/permissions';
import { uploadGroupAsset } from '@/features/groups/services/assets.service';
import { describeProError, type GroupTheme } from '@/features/groups/theme';
import { ScreenHeader } from '@/features/navigation/components/ScreenHeader';
import { useBottomInset } from '@/hooks/useBottomInset';
import { useTheme } from '@/theme/ThemeProvider';
import { readableTextOn } from '@/utils/color';
import { groupLink, prettyCode } from '@/utils/markee-link';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { tokens } = useTheme();
  const bottom = useBottomInset(32);

  const { data: group, isLoading } = useGroup(id);
  const { data: rooms } = useRooms(id);
  const { data: members } = useMembers(id);
  const { data: perms } = useMyPermissions(id);
  const { data: events } = useGroupEvents(id);
  const createRoom = useCreateRoom(id ?? '');
  const updateGroup = useUpdateGroup(id ?? '');
  const createEvent = useCreateEvent(id ?? '');
  const deleteEvent = useDeleteEvent(id ?? '');
  const leaveGroup = useLeaveGroup();
  const deleteGroup = useDeleteGroup();

  const { isPro } = useIsPro();
  const [roomVisible, setRoomVisible] = useState(false);
  const [mascotVisible, setMascotVisible] = useState(false);
  const [themeVisible, setThemeVisible] = useState(false);
  const [eventVisible, setEventVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [inviteVisible, setInviteVisible] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [mascotName, setMascotName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const permissions = perms?.permissions ?? 0;
  const isOwner = perms?.isOwner ?? false;
  const can = (bit: number) => hasPermission(permissions, bit, isOwner);

  if (isLoading || !group || !id) {
    return (
      <Screen className="items-center justify-center">
        <ActivityIndicator color={tokens.accent} />
      </Screen>
    );
  }

  const pickAsset = async (kind: 'icon' | 'mascot') => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Precisamos de acesso às suas fotos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;

    setBusy(true);
    try {
      const url = await uploadGroupAsset(id, kind, result.assets[0].uri);
      updateGroup.mutate(kind === 'icon' ? { iconUrl: url } : { mascotUrl: url }, {
        onError: (e) => setError(describeProError(e.message) ?? e.message),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Falha ao enviar a imagem.';
      setError(describeProError(message) ?? message);
    } finally {
      setBusy(false);
    }
  };

  const pickBanner = async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 1],
      quality: 0.85,
    });
    if (result.canceled) return;

    setBusy(true);
    try {
      const url = await uploadGroupAsset(id, 'banner', result.assets[0].uri);
      updateGroup.mutate(
        { bannerUrl: url },
        { onError: (e) => setError(describeProError(e.message) ?? e.message) }
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Falha ao enviar a imagem.';
      setError(describeProError(message) ?? message);
    } finally {
      setBusy(false);
    }
  };

  const saveTheme = async (theme: GroupTheme) => {
    await updateGroup.mutateAsync({ theme });
  };

  const handleCreateRoom = () => {
    if (!roomName.trim() || createRoom.isPending) return;
    createRoom.mutate(roomName, {
      onSuccess: () => {
        setRoomVisible(false);
        setRoomName('');
      },
      onError: (e) => setError(e.message),
    });
  };

  const shareCode = () =>
    Share.share({
      message:
        `Entre no meu grupo "${group.name}" no Markee: ${groupLink(group.joinCode)}\n\n` +
        `Ou use o código ${prettyCode(group.joinCode)}`,
    });

  const memberCount = (members ?? []).length;

  return (
    <View className="flex-1 bg-canvas-light dark:bg-canvas-dark">
      <ScreenHeader
        title={group.name}
        showMenu={false}
        onBackPress={() => router.back()}
        rightIcon={can(Permission.MANAGE_GROUP) ? 'settings' : undefined}
        onRightPress={() => setSettingsVisible(true)}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: bottom }}>
        <Pressable onPress={() => can(Permission.MANAGE_GROUP) && pickAsset('icon')} disabled={busy}>
          <GroupBanner name={group.name} theme={group.theme} iconUrl={group.iconUrl} bannerUrl={group.bannerUrl}>
            {busy ? <ActivityIndicator color="#fff" /> : null}
            {can(Permission.MANAGE_GROUP) ? (
              <Pressable
                onPress={() => setThemeVisible(true)}
                className="h-10 w-10 items-center justify-center rounded-full bg-black/30"
              >
                <Feather name="droplet" size={16} color="#fff" />
              </Pressable>
            ) : null}
          </GroupBanner>
        </Pressable>

        <View className="px-4 pt-3">
          {group.description ? (
            <AppText variant="caption" className="mb-2">
              {group.description}
            </AppText>
          ) : null}

          <View className="flex-row items-center gap-3">
            <Stat icon="users" label={`${memberCount} ${memberCount === 1 ? 'membro' : 'membros'}`} />
            <Stat icon="hash" label={`${(rooms ?? []).length} salas`} />
            {group.mascotUrl ? (
              <View className="flex-row items-center gap-1.5">
                <Image source={{ uri: group.mascotUrl }} className="h-5 w-5 rounded-full" />
                <AppText variant="small">{group.mascotName ?? 'Mascote'}</AppText>
              </View>
            ) : null}
          </View>

          {error ? (
            <AppText variant="caption" className="mt-2 text-danger">
              {error}
            </AppText>
          ) : null}
        </View>

        <View className="mt-3 gap-2 px-4">
          <NavRow
            icon="message-square"
            label="Feed do grupo"
            hint="Avisos, fotos e enquetes"
            onPress={() => router.push({ pathname: '/groups/[id]/feed', params: { id } })}
          />
          <NavRow
            icon="users"
            label="Membros e cargos"
            hint={`${memberCount} pessoa${memberCount === 1 ? '' : 's'}`}
            onPress={() => router.push({ pathname: '/groups/[id]/members', params: { id } })}
          />
        </View>

        {/* ---------------------------------------------------------- agenda */}
        <View className="mt-5 px-4">
          <View className="mb-2 flex-row items-center px-1">
            <AppText variant="small" className="flex-1">
              AGENDA
            </AppText>
            <Pressable onPress={() => setEventVisible(true)} hitSlop={8} className="flex-row items-center gap-1">
              <Feather name="plus" size={14} color={tokens.accent} />
              <AppText variant="small" className="text-accent">
                Marcar
              </AppText>
            </Pressable>
          </View>

          {(events ?? []).length === 0 ? (
            <Pressable
              onPress={() => setEventVisible(true)}
              className="rounded-2xl border border-dashed border-hairline-light px-4 py-4 dark:border-hairline-dark"
            >
              <AppText variant="caption" className="text-center">
                Nenhuma prova ou sessão marcada. Toque para criar a primeira.
              </AppText>
            </Pressable>
          ) : (
            <View className="overflow-hidden rounded-2xl bg-surface-light dark:bg-surface-dark">
              {(events ?? []).map((event, index) => {
                const date = new Date(event.startsAt);
                const canRemove = can(Permission.MANAGE_POSTS) || isOwner;
                return (
                  <View key={event.id}>
                    <View className="flex-row items-center gap-3 px-4 py-3">
                      <View className="w-11 items-center rounded-xl bg-subtle-light py-1.5 dark:bg-subtle-dark">
                        <AppText style={{ fontSize: 17, fontWeight: '700' }}>{date.getDate()}</AppText>
                        <AppText variant="small">
                          {date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                        </AppText>
                      </View>
                      <View className="flex-1">
                        <AppText variant="body" numberOfLines={1}>
                          {event.title}
                        </AppText>
                        <AppText variant="small">
                          {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          {event.description ? ` · ${event.description}` : ''}
                        </AppText>
                      </View>
                      {canRemove ? (
                        <Pressable onPress={() => deleteEvent.mutate(event.id)} hitSlop={8}>
                          <Feather name="x" size={15} color={tokens.muted} />
                        </Pressable>
                      ) : null}
                    </View>
                    {index < (events ?? []).length - 1 ? <Divider className="ml-4" /> : null}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ----------------------------------------------------------- salas */}
        <View className="mt-5 px-4">
          <AppText variant="small" className="mb-2 px-1">
            SALAS
          </AppText>
          <View className="overflow-hidden rounded-2xl bg-surface-light dark:bg-surface-dark">
            {(rooms ?? []).map((room, index) => (
              <View key={room.id}>
                <Pressable
                  onPress={() =>
                    router.push({ pathname: '/groups/[id]/room/[roomId]', params: { id, roomId: room.id } })
                  }
                  className="flex-row items-center gap-3 px-4 py-3.5 active:bg-subtle-light dark:active:bg-subtle-dark"
                >
                  <Feather name="hash" size={16} color={tokens.muted} />
                  <AppText variant="body" className="flex-1">
                    {room.name}
                  </AppText>
                  <Feather name="chevron-right" size={16} color={tokens.muted} />
                </Pressable>
                {index < (rooms ?? []).length - 1 ? <Divider className="ml-4" /> : null}
              </View>
            ))}
          </View>

          {can(Permission.MANAGE_ROOMS) ? (
            <Pressable onPress={() => setRoomVisible(true)} className="flex-row items-center gap-2 px-1 py-3">
              <Feather name="plus" size={16} color={tokens.accent} />
              <AppText variant="caption" className="text-accent">
                Nova sala
              </AppText>
            </Pressable>
          ) : null}
        </View>

        {/* --------------------------------------------------------- membros */}
        <View className="mt-4 px-4">
          <AppText variant="small" className="mb-2 px-1">
            MEMBROS · {memberCount}
          </AppText>
          <View className="overflow-hidden rounded-2xl bg-surface-light dark:bg-surface-dark">
            {(members ?? []).slice(0, 6).map((member, index, visible) => (
              <View key={member.userId}>
                <Pressable
                  onPress={() => router.push({ pathname: '/u/[id]', params: { id: member.userId } })}
                  className="flex-row items-center gap-3 px-4 py-3 active:bg-subtle-light dark:active:bg-subtle-dark"
                >
                  {member.avatarUrl ? (
                    <Image source={{ uri: member.avatarUrl }} className="h-9 w-9 rounded-full" />
                  ) : (
                    <View className="h-9 w-9 items-center justify-center rounded-full bg-subtle-light dark:bg-subtle-dark">
                      <AppText variant="small">{member.displayName.charAt(0).toUpperCase()}</AppText>
                    </View>
                  )}
                  <AppText variant="body" className="flex-1" numberOfLines={1}>
                    {member.nickname ?? member.displayName}
                  </AppText>
                  {member.roleName ? (
                    <View className="rounded-full bg-subtle-light px-2 py-1 dark:bg-subtle-dark">
                      <AppText variant="small" style={{ color: member.roleColor ?? tokens.muted }}>
                        {member.roleName}
                      </AppText>
                    </View>
                  ) : null}
                </Pressable>
                {index < visible.length - 1 ? <Divider className="ml-4" /> : null}
              </View>
            ))}
          </View>

          {memberCount > 6 ? (
            <Pressable
              onPress={() => router.push({ pathname: '/groups/[id]/members', params: { id } })}
              className="py-3"
            >
              <AppText variant="caption" className="px-1 text-accent">
                Ver todos os {memberCount} membros
              </AppText>
            </Pressable>
          ) : null}
        </View>

        <View className="mt-6 gap-3 px-6">
          <Button label="Convidar com QR code" onPress={() => setInviteVisible(true)} />
          <Button label="Compartilhar link do convite" variant="secondary" onPress={shareCode} />
          {!isOwner ? (
            <Button
              label="Sair do grupo"
              variant="danger"
              onPress={() => leaveGroup.mutate(id, { onSuccess: () => router.replace('/groups') })}
            />
          ) : null}
        </View>
      </ScrollView>

      {/* ------------------------------------------------------------ folhas */}

      <Sheet visible={inviteVisible} onClose={() => setInviteVisible(false)} edge="bottom">
        <AppText variant="heading" className="mb-1 px-1">
          Convidar para {group.name}
        </AppText>
        <AppText variant="caption" className="mb-4 px-1">
          Quem ler este código entra direto no grupo.
        </AppText>

        {/* O convite herda a aparência do grupo — é o cartão de visita dele. */}
        <View className="overflow-hidden rounded-2xl">
          <ThemeBanner theme={group.theme} height={320}>
            <View className="absolute inset-0 items-center justify-center">
              <QrCode value={groupLink(group.joinCode)} size={210} />
              <AppText
                variant="heading"
                className="mt-3"
                style={{
                  letterSpacing: 2,
                  color: readableTextOn(group.theme.colors[0]),
                  textShadowColor: 'rgba(0,0,0,0.3)',
                  textShadowRadius: 5,
                }}
              >
                {prettyCode(group.joinCode)}
              </AppText>
            </View>
          </ThemeBanner>
        </View>

        <Button label="Compartilhar link" variant="secondary" className="mt-5" onPress={shareCode} />
      </Sheet>

      <Sheet visible={roomVisible} onClose={() => setRoomVisible(false)} edge="bottom">
        <AppText variant="heading" className="mb-3 px-1">
          Nova sala
        </AppText>
        <TextInput
          value={roomName}
          onChangeText={setRoomName}
          placeholder="nome-da-sala"
          placeholderTextColor={tokens.muted}
          autoCapitalize="none"
          autoFocus
          onSubmitEditing={handleCreateRoom}
          className="mb-3 rounded-xl bg-subtle-light px-4 py-3.5 text-[16px] text-ink-light dark:bg-subtle-dark dark:text-ink-dark"
        />
        <Button
          label={createRoom.isPending ? 'Criando…' : 'Criar sala'}
          onPress={handleCreateRoom}
          disabled={createRoom.isPending}
        />
      </Sheet>

      <ThemePickerSheet
        visible={themeVisible}
        title="Aparência do grupo"
        showCard
        onClose={() => setThemeVisible(false)}
        current={group.theme}
        isPro={isPro}
        onSave={saveTheme}
        onUpgrade={() => {
          setThemeVisible(false);
          router.push('/upgrade');
        }}
      />

      <EventSheet
        visible={eventVisible}
        onClose={() => setEventVisible(false)}
        isPending={createEvent.isPending}
        onCreate={(input) =>
          createEvent.mutate(input, {
            onSuccess: () => setEventVisible(false),
            onError: (e) => setError(e.message),
          })
        }
      />

      <GroupSettingsSheet
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        name={group.name}
        description={group.description ?? ''}
        isPublic={group.isPublic}
        isOwner={isOwner}
        onSave={(patch) => {
          updateGroup.mutate(patch, {
            onSuccess: () => setSettingsVisible(false),
            onError: (e) => setError(describeProError(e.message) ?? e.message),
          });
        }}
        onPickBanner={() => {
          setSettingsVisible(false);
          void pickBanner();
        }}
        onPickMascot={() => {
          setSettingsVisible(false);
          setMascotVisible(true);
        }}
        onTheme={() => {
          setSettingsVisible(false);
          setThemeVisible(true);
        }}
        onRoles={() => {
          setSettingsVisible(false);
          router.push({ pathname: '/groups/[id]/roles', params: { id } });
        }}
        onDelete={() => {
          setSettingsVisible(false);
          deleteGroup.mutate(id, { onSuccess: () => router.replace('/groups') });
        }}
      />

      <Sheet visible={mascotVisible} onClose={() => setMascotVisible(false)} edge="bottom">
        <AppText variant="heading" className="mb-1 px-1">
          Mascote do grupo
        </AppText>
        <AppText variant="caption" className="mb-3 px-1">
          Dê um nome e uma cara para o mascote da turma.
        </AppText>
        <TextInput
          value={mascotName}
          onChangeText={setMascotName}
          placeholder="Nome do mascote"
          placeholderTextColor={tokens.muted}
          className="mb-3 rounded-xl bg-subtle-light px-4 py-3.5 text-[16px] text-ink-light dark:bg-subtle-dark dark:text-ink-dark"
        />
        <View className="gap-2">
          <Button
            label="Salvar nome"
            onPress={() => {
              updateGroup.mutate({ mascotName });
              setMascotVisible(false);
            }}
          />
          <Button
            label="Escolher imagem"
            variant="secondary"
            onPress={() => {
              setMascotVisible(false);
              void pickAsset('mascot');
            }}
          />
        </View>
      </Sheet>
    </View>
  );
}

function Stat({ icon, label }: { icon: keyof typeof Feather.glyphMap; label: string }) {
  const { tokens } = useTheme();
  return (
    <View className="flex-row items-center gap-1.5">
      <Feather name={icon} size={13} color={tokens.muted} />
      <AppText variant="small">{label}</AppText>
    </View>
  );
}

function NavRow({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  hint: string;
  onPress: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-2xl bg-surface-light px-4 py-3.5 active:opacity-70 dark:bg-surface-dark"
    >
      <Feather name={icon} size={18} color={tokens.accent} />
      <View className="flex-1">
        <AppText variant="body">{label}</AppText>
        <AppText variant="small">{hint}</AppText>
      </View>
      <Feather name="chevron-right" size={18} color={tokens.muted} />
    </Pressable>
  );
}

function GroupSettingsSheet({
  visible,
  onClose,
  name,
  description,
  isPublic,
  isOwner,
  onSave,
  onPickBanner,
  onPickMascot,
  onTheme,
  onRoles,
  onDelete,
}: {
  visible: boolean;
  onClose: () => void;
  name: string;
  description: string;
  isPublic: boolean;
  isOwner: boolean;
  onSave: (patch: { name?: string; description?: string; isPublic?: boolean }) => void;
  onPickBanner: () => void;
  onPickMascot: () => void;
  onTheme: () => void;
  onRoles: () => void;
  onDelete: () => void;
}) {
  const { tokens } = useTheme();
  const [draftName, setDraftName] = useState(name);
  const [draftDescription, setDraftDescription] = useState(description);
  const [draftPublic, setDraftPublic] = useState(isPublic);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <Sheet visible={visible} onClose={onClose} edge="bottom">
      <AppText variant="heading" className="mb-3 px-1">
        Ajustes do grupo
      </AppText>

      <ScrollView className="max-h-[440px]" keyboardShouldPersistTaps="handled">
        <TextInput
          value={draftName}
          onChangeText={setDraftName}
          placeholder="Nome do grupo"
          placeholderTextColor={tokens.muted}
          maxLength={50}
          className="mb-2 rounded-xl bg-subtle-light px-4 py-3.5 text-[16px] text-ink-light dark:bg-subtle-dark dark:text-ink-dark"
        />
        <TextInput
          value={draftDescription}
          onChangeText={setDraftDescription}
          placeholder="Do que é este grupo?"
          placeholderTextColor={tokens.muted}
          multiline
          maxLength={200}
          className="mb-3 min-h-[70px] rounded-xl bg-subtle-light px-4 py-3 text-[16px] text-ink-light dark:bg-subtle-dark dark:text-ink-dark"
          style={{ textAlignVertical: 'top' }}
        />

        <Pressable
          onPress={() => setDraftPublic((current) => !current)}
          className="mb-3 flex-row items-center gap-3 rounded-xl bg-subtle-light px-4 py-3 dark:bg-subtle-dark"
        >
          <Feather
            name={draftPublic ? 'unlock' : 'lock'}
            size={17}
            color={draftPublic ? tokens.accent : tokens.muted}
          />
          <View className="flex-1">
            <AppText variant="body">{draftPublic ? 'Grupo público' : 'Grupo privado'}</AppText>
            <AppText variant="small">
              {draftPublic ? 'Aparece na busca e qualquer um entra' : 'Só entra quem tiver o código'}
            </AppText>
          </View>
        </Pressable>

        <SettingsRow icon="droplet" label="Aparência e cores" onPress={onTheme} />
        <SettingsRow icon="image" label="Banner do grupo (Pro)" onPress={onPickBanner} />
        <SettingsRow icon="smile" label="Mascote" onPress={onPickMascot} />
        <SettingsRow icon="shield" label="Cargos e permissões" onPress={onRoles} />

        {isOwner ? (
          <Pressable
            onPress={() => (confirmingDelete ? onDelete() : setConfirmingDelete(true))}
            className="mt-2 flex-row items-center gap-3 py-3.5"
          >
            <Feather name="trash-2" size={18} color={tokens.danger} />
            <AppText variant="body" className="text-danger">
              {confirmingDelete ? 'Toque de novo para apagar de vez' : 'Apagar grupo'}
            </AppText>
          </Pressable>
        ) : null}
      </ScrollView>

      <Button
        label="Salvar"
        className="mt-3"
        onPress={() => onSave({ name: draftName, description: draftDescription, isPublic: draftPublic })}
      />
    </Sheet>
  );
}

function SettingsRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <>
      <Divider />
      <Pressable onPress={onPress} className="flex-row items-center gap-3 py-3.5">
        <Feather name={icon} size={18} color={tokens.ink} />
        <AppText variant="body" className="flex-1">
          {label}
        </AppText>
        <Feather name="chevron-right" size={16} color={tokens.muted} />
      </Pressable>
    </>
  );
}
