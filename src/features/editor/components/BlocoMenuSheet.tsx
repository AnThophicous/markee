import { Pressable, ScrollView, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Divider } from '@/components/Divider';
import { Sheet } from '@/components/Sheet';
import { useTheme } from '@/theme/ThemeProvider';
import { TIPOS_DE_TEXTO, type Bloco, type TipoBloco } from '../model/blocks';

/**
 * Opções de um bloco: virar outro tipo, subir, descer ou sair.
 *
 * Trocar o tipo é o motivo principal deste painel. Sem ele, converter um
 * parágrafo em título exigiria apagar e escrever de novo — que é justamente o
 * que o editor por blocos deveria acabar.
 */

const NOMES: Record<TipoBloco, string> = {
  texto: 'Texto',
  titulo: 'Título',
  subtitulo: 'Subtítulo',
  lista: 'Lista',
  numerada: 'Lista numerada',
  tarefa: 'Tarefa',
  citacao: 'Citação',
  codigo: 'Código',
  divisor: 'Divisor',
  imagem: 'Foto',
  grafico: 'Gráfico',
  tabela: 'Tabela',
};

const ICONES: Record<TipoBloco, keyof typeof Feather.glyphMap> = {
  texto: 'align-left',
  titulo: 'type',
  subtitulo: 'minus',
  lista: 'list',
  numerada: 'hash',
  tarefa: 'check-square',
  citacao: 'message-square',
  codigo: 'code',
  divisor: 'more-horizontal',
  imagem: 'image',
  grafico: 'bar-chart-2',
  tabela: 'grid',
};

type BlocoMenuSheetProps = {
  visible: boolean;
  bloco: Bloco | null;
  onClose: () => void;
  onMudarTipo: (id: string, tipo: TipoBloco) => void;
  onMover: (id: string, passo: number) => void;
  onRemover: (id: string) => void;
};

export function BlocoMenuSheet({
  visible,
  bloco,
  onClose,
  onMudarTipo,
  onMover,
  onRemover,
}: BlocoMenuSheetProps) {
  const { tokens } = useTheme();

  // O painel só existe com um bloco em mãos; sem ele não há o que mostrar.
  if (!bloco) return null;

  return (
    <Sheet visible={visible} onClose={onClose} edge="bottom">
      <AppText variant="heading" className="mb-3 px-1">
        {NOMES[bloco.tipo]}
      </AppText>

      <View className="mb-3 flex-row gap-2">
        <Acao icone="arrow-up" rotulo="Subir" onPress={() => onMover(bloco.id, -1)} />
        <Acao icone="arrow-down" rotulo="Descer" onPress={() => onMover(bloco.id, 1)} />
        <Acao icone="trash-2" rotulo="Apagar" perigo onPress={() => onRemover(bloco.id)} />
      </View>

      <Divider />

      <AppText variant="caption" className="mb-1 mt-3 px-1">
        Transformar em
      </AppText>

      <ScrollView className="max-h-[300px]" showsVerticalScrollIndicator={false}>
        {TIPOS_DE_TEXTO.map((tipo) => (
          <Pressable
            key={tipo}
            onPress={() => onMudarTipo(bloco.id, tipo)}
            className="flex-row items-center gap-3 py-2.5 active:opacity-60"
          >
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-subtle-light dark:bg-subtle-dark">
              <Feather name={ICONES[tipo]} size={16} color={tokens.ink} />
            </View>
            <AppText variant="body" className="flex-1">
              {NOMES[tipo]}
            </AppText>
            {bloco.tipo === tipo ? <Feather name="check" size={16} color={tokens.accent} /> : null}
          </Pressable>
        ))}
      </ScrollView>
    </Sheet>
  );
}

function Acao({
  icone,
  rotulo,
  onPress,
  perigo,
}: {
  icone: keyof typeof Feather.glyphMap;
  rotulo: string;
  onPress: () => void;
  perigo?: boolean;
}) {
  const { tokens } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center gap-1.5 rounded-2xl bg-subtle-light py-3 active:opacity-70 dark:bg-subtle-dark"
    >
      <Feather name={icone} size={17} color={perigo ? tokens.danger : tokens.ink} />
      <AppText variant="small" className={perigo ? 'text-danger' : 'text-ink-light dark:text-ink-dark'}>
        {rotulo}
      </AppText>
    </Pressable>
  );
}
