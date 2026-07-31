import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Divider } from '@/components/Divider';
import { Foto } from '@/components/Foto';
import { Sheet } from '@/components/Sheet';
import { useSession } from '@/features/auth/hooks/useSession';
import { NicknameSheet } from '@/features/groups/components/NicknameSheet';
import { useGroupIdentity } from '@/features/groups/hooks/useGroupIdentity';
import {
  useAssignRole,
  useKickMember,
  useMembers,
  useMyPermissions,
  useRoles,
  useSetNickname,
} from '@/features/groups/hooks/useGroups';
import { Permission, hasPermission } from '@/features/groups/permissions';
import { EmblemaDetalhe, EmblemaLinha } from '@/features/medals/components/EmblemaLinha';
import { emblemasDe } from '@/features/medals/emblemas';
import { useEmblemasDoGrupo } from '@/features/medals/hooks/useEmblemas';
import { ScreenHeader } from '@/features/navigation/components/ScreenHeader';
import { useBottomInset } from '@/hooks/useBottomInset';
import { useTheme } from '@/theme/ThemeProvider';

export default function MembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { tokens } = useTheme();
  const bottom = useBottomInset(24);
  const { user } = useSession();

  const { data: members } = useMembers(id);
  const { data: roles } = useRoles(id);
  const { data: perms } = useMyPermissions(id);
  const { data: emblemas } = useEmblemasDoGrupo(id);
  const identidade = useGroupIdentity(id);
  const assignRole = useAssignRole(id ?? '');
  const kickMember = useKickMember(id ?? '');
  const setNickname = useSetNickname(id ?? '');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [apelidoAberto, setApelidoAberto] = useState(false);
  const [erroApelido, setErroApelido] = useState<string | null>(null);

  const selected = (members ?? []).find((member) => member.userId === selectedId);
  const eu = (members ?? []).find((member) => member.userId === user?.id);

  const permissions = perms?.permissions ?? 0;
  const isOwner = perms?.isOwner ?? false;
  const canManageRoles = hasPermission(permissions, Permission.MANAGE_ROLES, isOwner);
  const canKick = hasPermission(permissions, Permission.KICK_MEMBERS, isOwner);

  const salvarApelido = (apelido: string) => {
    setErroApelido(null);
    setNickname.mutate(apelido, {
      onSuccess: () => setApelidoAberto(false),
      onError: (e) => setErroApelido(e instanceof Error ? e.message : 'Não deu para salvar.'),
    });
  };

  return (
    <View className="flex-1 bg-canvas-light dark:bg-canvas-dark">
      <ScreenHeader title="Membros" showMenu={false} onBackPress={() => router.back()} />

      <ScrollView className="px-4" contentContainerStyle={{ paddingBottom: bottom }}>
        {/* Atalho para o próprio apelido. Fica em cima porque é o que a pessoa
            vem fazer aqui — mexer nos outros depende de permissão. */}
        {eu ? (
          <Pressable
            onPress={() => setApelidoAberto(true)}
            className="mb-3 flex-row items-center gap-3 rounded-2xl bg-surface-light px-4 py-3.5 active:opacity-70 dark:bg-surface-dark"
          >
            <Feather name="edit-3" size={18} color={tokens.accent} />
            <View className="flex-1">
              <AppText variant="body">Seu apelido neste grupo</AppText>
              <AppText variant="small">{eu.nickname ?? eu.displayName}</AppText>
            </View>
            <Feather name="chevron-right" size={18} color={tokens.muted} />
          </Pressable>
        ) : null}

        <View className="overflow-hidden rounded-2xl bg-surface-light dark:bg-surface-dark">
          {(members ?? []).map((member, index) => {
            const quem = identidade(member.userId, member.displayName);
            return (
              <View key={member.userId}>
                {/* Agora TODA pessoa abre a folha, e não só quem se pode
                    moderar. Antes, tocar em alguém sem ter permissão não fazia
                    nada — e com os emblemas passou a haver o que ver ali: o
                    ícone sozinho ao lado do nome não diz o que significa. */}
                <Pressable
                  onPress={() => setSelectedId(member.userId)}
                  className="flex-row items-center gap-3 px-4 py-3"
                >
                  {member.avatarUrl ? (
                    <Foto uri={member.avatarUrl} style={{ width: 40, height: 40 }} raio={20} />
                  ) : (
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-subtle-light dark:bg-subtle-dark">
                      <AppText>{quem.nome.charAt(0).toUpperCase()}</AppText>
                    </View>
                  )}

                  <View className="flex-1">
                    {/* O nome na cor do cargo — é assim que se reconhece quem é
                        moderador correndo o olho pela lista, sem ler etiqueta
                        nenhuma. A cor vem ajustada ao tema pelo useGroupIdentity;
                        crua, uma cor clara sumiria no fundo branco. */}
                    <View className="flex-row items-center gap-1.5">
                      <AppText
                        variant="body"
                        numberOfLines={1}
                        className="shrink"
                        style={{ color: quem.cor }}
                      >
                        {quem.nome}
                      </AppText>
                      {/* Os emblemas vêm prontos do servidor — o aplicativo não
                          calcula nenhum, porque isto aqui é o que os outros
                          veem. Ver medalhas.ts para a regra inteira. */}
                      <EmblemaLinha codigos={emblemas?.get(member.userId) ?? []} />
                      {member.userId === user?.id ? (
                        <AppText variant="small" style={{ color: tokens.muted }}>
                          (você)
                        </AppText>
                      ) : null}
                    </View>

                    {/* O recado ganha da etiqueta de cargo: o cargo já está dito
                        pela cor, e o recado é o que muda e dá assunto. */}
                    {quem.recado ? (
                      <AppText variant="small" numberOfLines={1} style={{ color: tokens.muted }}>
                        {quem.recado.emoji ? `${quem.recado.emoji} ` : ''}
                        {quem.recado.texto ?? ''}
                      </AppText>
                    ) : quem.cargo ? (
                      <AppText variant="small" style={{ color: tokens.muted }}>
                        {quem.cargo}
                      </AppText>
                    ) : null}
                  </View>

                  <Feather name="more-horizontal" size={18} color={tokens.muted} />
                </Pressable>
                {index < (members ?? []).length - 1 ? <Divider className="ml-4" /> : null}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <Sheet visible={Boolean(selected)} onClose={() => setSelectedId(null)} edge="bottom">
        {selected ? (
          <View>
            <AppText variant="heading" className="mb-3 px-1">
              {selected.nickname ?? selected.displayName}
            </AppText>

            {(emblemas?.get(selected.userId) ?? []).length > 0 ? (
              <View className="mb-3">
                <EmblemaDetalhe emblemas={emblemasDe(emblemas?.get(selected.userId) ?? [])} />
              </View>
            ) : (
              <AppText variant="small" className="mb-3 px-1">
                Sem emblemas neste grupo ainda.
              </AppText>
            )}

            {selected.userId === user?.id ? (
              <>
                <Divider className="mb-1" />
                <Pressable
                  onPress={() => {
                    setSelectedId(null);
                    setApelidoAberto(true);
                  }}
                  className="flex-row items-center gap-3 py-3.5"
                >
                  <Feather name="edit-3" size={18} color={tokens.accent} />
                  <AppText variant="body">Mudar meu apelido aqui</AppText>
                </Pressable>
              </>
            ) : null}

            {canManageRoles && selected.userId !== user?.id ? (
              <>
                <AppText variant="small" className="mb-1 px-1">
                  CARGO
                </AppText>
                {(roles ?? []).map((role) => (
                  <Pressable
                    key={role.id}
                    onPress={() => assignRole.mutate({ userId: selected.userId, roleId: role.id })}
                    className="flex-row items-center justify-between py-3"
                  >
                    <View className="flex-row items-center gap-2.5">
                      <View className="h-3 w-3 rounded-full" style={{ backgroundColor: role.color }} />
                      <AppText variant="body">{role.name}</AppText>
                    </View>
                    {selected.roleId === role.id ? (
                      <Feather name="check" size={18} color={tokens.accent} />
                    ) : null}
                  </Pressable>
                ))}
              </>
            ) : null}

            {/* `selected.userId !== user?.id` é novo e não é detalhe: a folha
                passou a abrir também em você mesmo, e sem esta condição o dono
                do grupo veria "Remover do grupo" apontando para ele — um toque
                errado e a pessoa se expulsa do próprio grupo. */}
            {canKick && selected.userId !== user?.id ? (
              <>
                <Divider className="my-2" />
                <Pressable
                  onPress={() => {
                    kickMember.mutate(selected.userId);
                    setSelectedId(null);
                  }}
                  className="flex-row items-center gap-3 py-3.5"
                >
                  <Feather name="user-x" size={18} color={tokens.danger} />
                  <AppText variant="body" className="text-danger">
                    Remover do grupo
                  </AppText>
                </Pressable>
              </>
            ) : null}
          </View>
        ) : null}
      </Sheet>

      <NicknameSheet
        visible={apelidoAberto}
        onClose={() => {
          setApelidoAberto(false);
          setErroApelido(null);
        }}
        atual={eu?.nickname ?? null}
        nomeReal={eu?.displayName ?? 'você'}
        onSalvar={salvarApelido}
        salvando={setNickname.isPending}
        erro={erroApelido}
      />
    </View>
  );
}
