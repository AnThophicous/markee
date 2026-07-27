import { Pressable, ScrollView, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Sheet } from '@/components/Sheet';
import { useTheme } from '@/theme/ThemeProvider';
import type { TipoBloco } from '../model/blocks';

/**
 * O que dá para colocar numa nota.
 *
 * Cada item tem uma frase dizendo para que serve. Uma lista só de nomes
 * ("Divisor", "Gráfico") obriga a pessoa a experimentar um por um para
 * descobrir o que são — e ninguém experimenta, simplesmente não usa.
 */

type Opcao = {
  tipo: TipoBloco | 'imagem';
  rotulo: string;
  descricao: string;
  icone: keyof typeof Feather.glyphMap;
};

const OPCOES: Opcao[] = [
  { tipo: 'texto', rotulo: 'Texto', descricao: 'Um parágrafo comum', icone: 'align-left' },
  { tipo: 'titulo', rotulo: 'Título', descricao: 'Abre uma seção da nota', icone: 'type' },
  { tipo: 'subtitulo', rotulo: 'Subtítulo', descricao: 'Divide dentro de uma seção', icone: 'minus' },
  { tipo: 'tarefa', rotulo: 'Tarefa', descricao: 'Item com caixa para marcar', icone: 'check-square' },
  { tipo: 'lista', rotulo: 'Lista', descricao: 'Itens com marcador', icone: 'list' },
  { tipo: 'numerada', rotulo: 'Lista numerada', descricao: 'Passos em ordem', icone: 'hash' },
  { tipo: 'citacao', rotulo: 'Citação', descricao: 'Destaca a fala de alguém', icone: 'message-square' },
  { tipo: 'codigo', rotulo: 'Código', descricao: 'Trecho de programa, sem correção automática', icone: 'code' },
  { tipo: 'tabela', rotulo: 'Tabela', descricao: 'Linhas e colunas para comparar', icone: 'grid' },
  { tipo: 'grafico', rotulo: 'Gráfico', descricao: 'Barra, linha ou pizza a partir de números', icone: 'bar-chart-2' },
  { tipo: 'imagem', rotulo: 'Foto', descricao: 'Do seu celular, enviada em segurança', icone: 'image' },
  { tipo: 'divisor', rotulo: 'Divisor', descricao: 'Linha para separar assuntos', icone: 'more-horizontal' },
];

type InserirBlocoSheetProps = {
  visible: boolean;
  onClose: () => void;
  onEscolher: (tipo: TipoBloco) => void;
  onImagem: () => void;
};

export function InserirBlocoSheet({ visible, onClose, onEscolher, onImagem }: InserirBlocoSheetProps) {
  const { tokens } = useTheme();

  return (
    <Sheet visible={visible} onClose={onClose} edge="bottom">
      <AppText variant="heading" className="mb-1 px-1">
        Adicionar
      </AppText>
      <AppText variant="caption" className="mb-3 px-1">
        Entra logo abaixo de onde você estava escrevendo.
      </AppText>

      <ScrollView className="max-h-[440px]" showsVerticalScrollIndicator={false}>
        {OPCOES.map((opcao) => (
          <Pressable
            key={opcao.tipo}
            onPress={() => (opcao.tipo === 'imagem' ? onImagem() : onEscolher(opcao.tipo as TipoBloco))}
            className="flex-row items-center gap-3 rounded-xl py-2.5 active:opacity-60"
          >
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-subtle-light dark:bg-subtle-dark">
              <Feather name={opcao.icone} size={17} color={tokens.ink} />
            </View>
            <View className="flex-1">
              <AppText variant="body">{opcao.rotulo}</AppText>
              <AppText variant="small">{opcao.descricao}</AppText>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </Sheet>
  );
}
