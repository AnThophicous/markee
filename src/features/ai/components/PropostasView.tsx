import { useState } from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Toque } from '@/components/Toque';
import { useSetReminder } from '@/features/reminders/hooks/useReminder';
import { useCriarCartas } from '@/features/review/hooks/useCards';
import { avisar } from '@/services/avisos';
import { useTheme } from '@/theme/ThemeProvider';

import { aplicarNoConteudo, descrever, type MudancaNaNota } from '../tools/notas-escrita';
import type { Proposta } from '../tools/types';

type Props = {
  propostas: Proposta[];
  noteId: string;
  conteudoAtual: string;
  /**
   * SUBSTITUI o corpo da nota, e não acrescenta.
   *
   * É deliberadamente separado do `onInsert` do assistente, que concatena. As
   * três mudanças de corpo — tag, seção e reorganizar — já devolvem o texto
   * inteiro pronto pela `aplicarNoConteudo`; passá-las pelo caminho que
   * concatena duplicaria a nota a cada tag aplicada.
   */
  onSetContent: (conteudoNovo: string) => void;
  onSetTitle?: (titulo: string) => void;
};

const ICONES: Record<MudancaNaNota['tipo'], keyof typeof Feather.glyphMap> = {
  titulo: 'type',
  tags: 'hash',
  secao: 'plus-square',
  lembrete: 'bell',
  cartas: 'layers',
  reorganizar: 'align-left',
};

/**
 * As mudanças que a IA propôs, uma por linha, cada uma com o seu botão.
 *
 * Um botão só, "aplicar tudo", seria mais simples e errado: o modelo acerta o
 * título e erra a data do lembrete na mesma resposta, e nesse caso a escolha
 * "aceito os dois ou nenhum" faz a pessoa aceitar os dois. Uma por vez é o que
 * permite ficar com o que presta.
 *
 * Depois de aplicada a linha não some — vira um visto. Sumir daria a impressão
 * de que a mudança se perdeu, e ainda deixaria as outras linhas pulando de
 * posição debaixo do dedo de quem está aprovando.
 */
export function PropostasView({
  propostas,
  noteId,
  conteudoAtual,
  onSetContent,
  onSetTitle,
}: Props) {
  const { tokens } = useTheme();
  const [aplicadas, setAplicadas] = useState<Set<number>>(new Set());
  const criarCartas = useCriarCartas(noteId);
  const salvarLembrete = useSetReminder(noteId);

  async function aplicar(proposta: Proposta, indice: number) {
    const { mudanca } = proposta;

    try {
      switch (mudanca.tipo) {
        case 'titulo':
          if (!onSetTitle) return;
          onSetTitle(mudanca.titulo);
          break;

        case 'lembrete':
          await salvarLembrete.mutateAsync({
            triggerType: 'datetime',
            date: new Date(mudanca.quando),
            title: mudanca.texto,
          });
          break;

        case 'cartas':
          await criarCartas.mutateAsync(mudanca.pares);
          break;

        default:
          // As três que mexem no corpo — tag, seção e reorganizar — passam pela
          // mesma função pura, e é ela que decide o que fazer com cada uma.
          onSetContent(aplicarNoConteudo(mudanca, conteudoAtual));
      }

      setAplicadas((antes) => new Set(antes).add(indice));
      avisar(descrever(mudanca), 'ok');
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui aplicar.', 'erro');
    }
  }

  if (propostas.length === 0) return null;

  return (
    <View className="mb-3 gap-2 rounded-2xl bg-subtle-light p-3 dark:bg-subtle-dark">
      <AppText variant="small" className="uppercase">
        {propostas.length === 1 ? 'Mudança sugerida' : 'Mudanças sugeridas'}
      </AppText>

      {propostas.map((proposta, i) => {
        const feita = aplicadas.has(i);
        const bloqueada = proposta.mudanca.tipo === 'titulo' && !onSetTitle;

        return (
          <View key={`${proposta.ferramenta}-${i}`} className="flex-row items-center gap-2.5">
            <Feather
              name={ICONES[proposta.mudanca.tipo]}
              size={15}
              color={feita ? tokens.accent : tokens.muted}
            />
            <AppText
              variant="caption"
              numberOfLines={2}
              className="flex-1 text-ink-light dark:text-ink-dark"
              style={feita ? { opacity: 0.5 } : undefined}
            >
              {descrever(proposta.mudanca)}
            </AppText>

            {feita ? (
              <Feather name="check" size={16} color={tokens.accent} />
            ) : bloqueada ? null : (
              <Toque
                onPress={() => aplicar(proposta, i)}
                className="rounded-full px-3 py-1"
                style={{ backgroundColor: tokens.accent }}
                accessibilityRole="button"
                accessibilityLabel={`Aplicar: ${descrever(proposta.mudanca)}`}
              >
                <AppText variant="small" className="text-white">
                  Aplicar
                </AppText>
              </Toque>
            )}
          </View>
        );
      })}
    </View>
  );
}
