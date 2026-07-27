import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Divider } from '@/components/Divider';
import { Sheet } from '@/components/Sheet';
import { Toggle } from '@/components/Toggle';
import { useCreateRole, useDeleteRole, useRoles, useUpdateRole } from '@/features/groups/hooks/useGroups';
import { PERMISSION_ORDER, PERMISSION_LABELS, Permission, togglePermission } from '@/features/groups/permissions';
import type { GroupRole } from '@/features/groups/services/groups.service';
import { ScreenHeader } from '@/features/navigation/components/ScreenHeader';
import { useBottomInset } from '@/hooks/useBottomInset';
import { useTheme } from '@/theme/ThemeProvider';

export default function RolesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { tokens } = useTheme();

  const bottom = useBottomInset(24);
  const { data: roles } = useRoles(id);
  const createRole = useCreateRole(id ?? '');
  const updateRole = useUpdateRole(id ?? '');
  const deleteRole = useDeleteRole(id ?? '');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [newName, setNewName] = useState('');

  const editing = (roles ?? []).find((role) => role.id === editingId);

  return (
    <View className="flex-1 bg-canvas-light dark:bg-canvas-dark">
      <ScreenHeader
        title="Cargos"
        showMenu={false}
        onBackPress={() => router.back()}
        rightIcon="plus"
        onRightPress={() => setCreateVisible(true)}
      />

      <ScrollView className="px-4" contentContainerStyle={{ paddingBottom: bottom }}>
        <AppText variant="caption" className="mb-3 px-1">
          As permissões valem no servidor: mesmo que alguém altere o app, o banco recusa o que o cargo não permite.
        </AppText>

        <View className="overflow-hidden rounded-2xl bg-surface-light dark:bg-surface-dark">
          {(roles ?? []).map((role, index) => (
            <View key={role.id}>
              <Pressable
                onPress={() => setEditingId(role.id)}
                className="flex-row items-center gap-3 px-4 py-3.5 active:bg-subtle-light dark:active:bg-subtle-dark"
              >
                <View className="h-3 w-3 rounded-full" style={{ backgroundColor: role.color }} />
                <View className="flex-1">
                  <AppText variant="body">{role.name}</AppText>
                  <AppText variant="small">
                    {(role.permissions & Permission.ADMINISTRATOR) !== 0
                      ? 'Todas as permissões'
                      : `${PERMISSION_ORDER.filter((key) => (role.permissions & Permission[key]) !== 0).length} permissões`}
                  </AppText>
                </View>
                {role.isDefault ? (
                  <View className="rounded-full bg-subtle-light px-2 py-1 dark:bg-subtle-dark">
                    <AppText variant="small">padrão</AppText>
                  </View>
                ) : null}
                <Feather name="chevron-right" size={16} color={tokens.muted} />
              </Pressable>
              {index < (roles ?? []).length - 1 ? <Divider className="ml-4" /> : null}
            </View>
          ))}
        </View>
      </ScrollView>

      <Sheet visible={Boolean(editing)} onClose={() => setEditingId(null)} edge="bottom">
        {editing ? (
          <RolePermissions
            role={editing}
            onChange={(permissions) => updateRole.mutate({ roleId: editing.id, permissions })}
            onDelete={() => {
              deleteRole.mutate(editing.id);
              setEditingId(null);
            }}
          />
        ) : null}
      </Sheet>

      <Sheet visible={createVisible} onClose={() => setCreateVisible(false)} edge="bottom">
        <AppText variant="heading" className="mb-3 px-1">
          Novo cargo
        </AppText>
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder="Nome do cargo"
          placeholderTextColor={tokens.muted}
          autoFocus
          className="mb-3 rounded-xl bg-subtle-light px-4 py-3.5 text-[16px] text-ink-light dark:bg-subtle-dark dark:text-ink-dark"
        />
        <Button
          label={createRole.isPending ? 'Criando…' : 'Criar'}
          disabled={createRole.isPending}
          onPress={() => {
            if (!newName.trim() || createRole.isPending) return;
            // Nasce podendo ver e escrever; o resto se ajusta na tela de edição.
            createRole.mutate(
              { name: newName, permissions: Permission.VIEW_ROOM | Permission.SEND_MESSAGES },
              {
                onSuccess: () => {
                  setCreateVisible(false);
                  setNewName('');
                },
              }
            );
          }}
        />
      </Sheet>
    </View>
  );
}

/** Espera antes de mandar ao servidor; toques seguidos viram uma gravação só. */
const SAVE_DELAY = 500;

function RolePermissions({
  role,
  onChange,
  onDelete,
}: {
  role: GroupRole;
  onChange: (permissions: number) => void;
  onDelete: () => void;
}) {
  /**
   * As permissões ficam num estado local durante a edição.
   *
   * Antes, cada toque lia `role.permissions` vindo do cache da consulta — que
   * só muda depois que o servidor responde. Dois toques rápidos partiam do
   * mesmo valor e o segundo desfazia o primeiro, e o interruptor piscava de
   * volta. Aqui a verdade durante a edição é local (num ref, para nem depender
   * do agendamento do React), a chave responde na hora, e a gravação sai uma
   * vez só quando a pessoa para de mexer.
   */
  const [permissions, setPermissions] = useState(role.permissions);
  const latest = useRef(role.permissions);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPermissions(role.permissions);
    latest.current = role.permissions;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role.id]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const toggle = (bit: number) => {
    const next = togglePermission(latest.current, bit);
    latest.current = next;
    setPermissions(next);

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(next), SAVE_DELAY);
  };

  const isAdmin = (permissions & Permission.ADMINISTRATOR) !== 0;

  return (
    <View>
      <View className="mb-3 flex-row items-center gap-2 px-1">
        <View className="h-3 w-3 rounded-full" style={{ backgroundColor: role.color }} />
        <AppText variant="heading" className="flex-1">
          {role.name}
        </AppText>
      </View>

      {isAdmin ? (
        <AppText variant="caption" className="mb-2 px-1">
          Administrador já inclui tudo — as chaves abaixo ficam sem efeito.
        </AppText>
      ) : null}

      <ScrollView className="max-h-96">
        {PERMISSION_ORDER.map((key, index) => {
          const bit = Permission[key];
          const enabled = (permissions & bit) !== 0;
          const overridden = isAdmin && key !== 'ADMINISTRATOR';

          return (
            <View key={key}>
              <View className="flex-row items-center justify-between py-3">
                <AppText variant="body" className="flex-1 pr-4" style={overridden ? { opacity: 0.5 } : undefined}>
                  {PERMISSION_LABELS[key]}
                </AppText>
                <Toggle value={enabled} onChange={() => toggle(bit)} disabled={overridden} />
              </View>
              {index < PERMISSION_ORDER.length - 1 ? <Divider /> : null}
            </View>
          );
        })}
      </ScrollView>

      {!role.isDefault ? (
        <Button label="Excluir cargo" variant="danger" className="mt-3" onPress={onDelete} />
      ) : null}
    </View>
  );
}
