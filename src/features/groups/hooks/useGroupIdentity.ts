import { useCallback, useMemo } from 'react';

import { statusAtivo } from '@/features/profile/services/profile.service';
import { useTheme } from '@/theme/ThemeProvider';
import { corDeCargo } from '../role-color';
import { useMembers } from './useGroups';

export type IdentidadeNoGrupo = {
  /** Apelido no grupo, ou o nome da conta se não houver apelido. */
  nome: string;
  /** Cor do cargo já ajustada ao tema; cai na cor normal do texto se não houver. */
  cor: string;
  /** Nome do cargo, para mostrar embaixo do nome. */
  cargo: string | null;
  /** Cor crua do cargo, para bolinhas e etiquetas — ali o contraste não pesa. */
  corCrua: string | null;
  /** Recado do momento, já descartado se estiver vencido. */
  recado: { texto: string | null; emoji: string | null } | null;
};

/**
 * Como uma pessoa aparece DENTRO de um grupo.
 *
 * É a identidade do Discord: no grupo você é o seu apelido, na cor do seu cargo.
 * A mesma pessoa é "Ana" num grupo e "monitora_bio" em outro, e as duas coisas
 * estão certas.
 *
 * Sai daqui em vez de ficar em cada tela porque o nome aparece em quatro lugares
 * — lista de membros, prévia na capa do grupo, mensagens do chat e autoria dos
 * posts. Espalhado, cada tela resolveria o apelido de um jeito, e bastaria
 * esquecer um para a pessoa aparecer com dois nomes diferentes no mesmo grupo.
 *
 * A consulta é a mesma do `useMembers`, então não custa requisição nenhuma: o
 * React Query entrega o que já está em cache.
 */
export function useGroupIdentity(groupId: string | undefined) {
  const { mode, tokens } = useTheme();
  const { data: members } = useMembers(groupId);

  /**
   * O fundo mais difícil entre aqueles em que o nome pode cair.
   *
   * O nome aparece sobre `canvas`, `surface` e `subtle` — e a etiqueta de cargo
   * na capa do grupo usa `subtle`. Ajustar contra o fundo errado deixa a cor
   * legível numa tela e apagada na outra.
   *
   * O critério é sempre o fundo MAIS CLARO dos três, porque é dele que a cor
   * precisa se afastar: no tema claro isso é o branco, no escuro é o `subtle`,
   * que é um cinza um pouco acima do preto do fundo. Acertar o mais claro
   * garante os outros de brinde.
   */
  const fundo = mode === 'dark' ? tokens.subtle : tokens.canvas;

  const porUsuario = useMemo(() => {
    const mapa = new Map<string, IdentidadeNoGrupo>();
    for (const membro of members ?? []) {
      mapa.set(membro.userId, {
        nome: membro.nickname ?? membro.displayName,
        cor: corDeCargo(membro.roleColor, fundo, tokens.ink),
        cargo: membro.roleName,
        corCrua: membro.roleColor,
        recado: statusAtivo(membro),
      });
    }
    return mapa;
  }, [members, fundo, tokens.ink]);

  /**
   * `nomeDeReserva` é o que a própria mensagem ou post trouxe no join. Sem ele,
   * quem saiu do grupo apareceria sem nome nas mensagens antigas — o autor não
   * está mais na lista de membros, mas a mensagem continua lá.
   */
  return useCallback(
    (userId: string, nomeDeReserva?: string): IdentidadeNoGrupo =>
      porUsuario.get(userId) ?? {
        nome: nomeDeReserva ?? 'Estudante',
        cor: tokens.ink,
        cargo: null,
        corCrua: null,
        recado: null,
      },
    [porUsuario, tokens.ink]
  );
}
