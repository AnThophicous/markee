import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Sair do grupo ou apagá-lo.
 *
 * Antes isto morava dentro dos ajustes do grupo: era preciso ser dono, achar a
 * engrenagem, rolar um painel de 440px até o fim e tocar duas vezes num texto
 * vermelho — e a lista de grupos não tinha caminho nenhum. Na prática, não dava
 * para sair de um grupo.
 *
 * Quem usa passa uma `key` que muda a cada abertura, porque a confirmação
 * PRECISA começar do zero: um painel fechado no meio dela reabriria já armado, e
 * o primeiro toque apagaria o grupo. Remontar garante isso sem efeito nenhum
 * sincronizando estado.
 *
 * A confirmação fica aqui dentro, em duas etapas, com o nome do grupo escrito
 * por extenso. Não é o truque de "toque de novo" no mesmo texto: aquele muda
 * uma linha pequena que ninguém repara, e quem tocou uma vez sem querer
 * apagaria no segundo toque achando que o primeiro não pegou.
 */

type GroupDangerSheetProps = {
  visible: boolean;
  onClose: () => void;
  groupName: string;
  isOwner: boolean;
  onLeave: () => void;
  onDelete: () => void;
  pending?: boolean;
  /** Mensagem do servidor quando a ação falha. Sem isto, falhar é silêncio. */
  erro?: string | null;
};

export function GroupDangerSheet({
  visible,
  onClose,
  groupName,
  isOwner,
  onLeave,
  onDelete,
  pending,
  erro,
}: GroupDangerSheetProps) {
  const { tokens } = useTheme();
  const [confirmando, setConfirmando] = useState(false);

  const acao = isOwner
    ? {
        titulo: 'Apagar grupo',
        aviso: `Apaga ${groupName} para todo mundo, com as mensagens, os posts e os materiais. Não dá para desfazer.`,
        botao: 'Apagar para todo mundo',
        executar: onDelete,
      }
    : {
        titulo: 'Sair do grupo',
        aviso: `Você deixa de ver ${groupName}. Para voltar, vai precisar do código de convite outra vez.`,
        botao: 'Sair do grupo',
        executar: onLeave,
      };

  return (
    <Sheet visible={visible} onClose={onClose} edge="bottom">
      <View>
        <AppText variant="heading" className="mb-1 px-1">
          {groupName}
        </AppText>

        {confirmando ? (
          <>
            <View className="my-3 flex-row items-start gap-2.5 rounded-xl bg-subtle-light p-3.5 dark:bg-subtle-dark">
              <Feather name="alert-triangle" size={17} color={tokens.danger} />
              <AppText variant="caption" className="flex-1">
                {acao.aviso}
              </AppText>
            </View>

            {erro ? (
              <AppText variant="caption" className="mb-2 px-1 text-danger">
                {erro}
              </AppText>
            ) : null}

            <View className="gap-2">
              <Button
                label={pending ? 'Aguarde…' : acao.botao}
                variant="danger"
                disabled={pending}
                className={pending ? 'opacity-50' : undefined}
                onPress={acao.executar}
              />
              <Button label="Cancelar" variant="ghost" onPress={() => setConfirmando(false)} />
            </View>
          </>
        ) : (
          <View className="mt-2">
            {/* O dono não tem "sair": ele é o único que pode apagar, e sair
                deixaria o grupo sem ninguém que possa. Mostrar as duas opções e
                recusar uma delas depois seria pior do que não oferecer. */}
            <Pressable
              onPress={() => setConfirmando(true)}
              className="flex-row items-center gap-3 py-3.5 active:opacity-60"
            >
              <Feather name={isOwner ? 'trash-2' : 'log-out'} size={18} color={tokens.danger} />
              <AppText variant="body" className="text-danger">
                {acao.titulo}
              </AppText>
              {pending ? <ActivityIndicator size="small" color={tokens.danger} /> : null}
            </Pressable>

            {isOwner ? (
              <AppText variant="small" className="px-1" style={{ color: tokens.muted }}>
                Você é o dono. Passar o grupo para outra pessoa ainda não existe — por
                enquanto, apagar é a única saída.
              </AppText>
            ) : null}

            {erro ? (
              <AppText variant="caption" className="mt-2 px-1 text-danger">
                {erro}
              </AppText>
            ) : null}
          </View>
        )}
      </View>
    </Sheet>
  );
}
