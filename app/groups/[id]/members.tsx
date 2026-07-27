import { useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Divider } from '@/components/Divider';
import { Sheet } from '@/components/Sheet';
import {
  useAssignRole,
  useKickMember,
  useMembers,
  useMyPermissions,
  useRoles,
} from '@/features/groups/hooks/useGroups';
import { Permission, hasPermission } from '@/features/groups/permissions';
import { ScreenHeader } from '@/features/navigation/components/ScreenHeader';
import { useBottomInset } from '@/hooks/useBottomInset';
import { useTheme } from '@/theme/ThemeProvider';

export default function MembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { tokens } = useTheme();
  const bottom = useBottomInset(24);

  const { data: members } = useMembers(id);
  const { data: roles } = useRoles(id);
  const { data: perms } = useMyPermissions(id);
  const assignRole = useAssignRole(id ?? '');
  const kickMember = useKickMember(id ?? '');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = (members ?? []).find((member) => member.userId === selectedId);

  const permissions = perms?.permissions ?? 0;
  const isOwner = perms?.isOwner ?? false;
  const canManageRoles = hasPermission(permissions, Permission.MANAGE_ROLES, isOwner);
  const canKick = hasPermission(permissions, Permission.KICK_MEMBERS, isOwner);

  return (
    <View className="flex-1 bg-canvas-light dark:bg-canvas-dark">
      <ScreenHeader title="Membros" showMenu={false} onBackPress={() => router.back()} />

      <ScrollView className="px-4" contentContainerStyle={{ paddingBottom: bottom }}>
        <View className="overflow-hidden rounded-2xl bg-surface-light dark:bg-surface-dark">
          {(members ?? []).map((member, index) => (
            <View key={member.userId}>
              <Pressable
                onPress={() => (canManageRoles || canKick) && setSelectedId(member.userId)}
                className="flex-row items-center gap-3 px-4 py-3"
              >
                {member.avatarUrl ? (
                  <Image source={{ uri: member.avatarUrl }} className="h-10 w-10 rounded-full" />
                ) : (
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-subtle-light dark:bg-subtle-dark">
                    <AppText>{member.displayName.charAt(0).toUpperCase()}</AppText>
                  </View>
                )}
                <View className="flex-1">
                  <AppText variant="body" numberOfLines={1}>
                    {member.nickname ?? member.displayName}
                  </AppText>
                  {member.roleName ? (
                    <AppText variant="small" style={{ color: member.roleColor ?? tokens.muted }}>
                      {member.roleName}
                    </AppText>
                  ) : null}
                </View>
                {canManageRoles || canKick ? (
                  <Feather name="more-horizontal" size={18} color={tokens.muted} />
                ) : null}
              </Pressable>
              {index < (members ?? []).length - 1 ? <Divider className="ml-4" /> : null}
            </View>
          ))}
        </View>
      </ScrollView>

      <Sheet visible={Boolean(selected)} onClose={() => setSelectedId(null)} edge="bottom">
        {selected ? (
          <View>
            <AppText variant="heading" className="mb-3 px-1">
              {selected.nickname ?? selected.displayName}
            </AppText>

            {canManageRoles ? (
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

            {canKick ? (
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
    </View>
  );
}
