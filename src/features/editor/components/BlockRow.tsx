import { memo, useRef } from 'react';
import { Pressable, TextInput, View, type NativeSyntheticEvent, type TextInputKeyPressEventData } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';
import type { Bloco, TipoBloco } from '../model/blocks';

/**
 * Uma linha do editor.
 *
 * Envolvida em `memo` de propósito. O editor mantém os blocos numa lista
 * imutável: digitar troca só o objeto do bloco em que se está digitando, e os
 * demais mantêm a identidade. Com isso, uma tecla apertada re-renderiza uma
 * linha, não a nota inteira — que é a diferença entre escrever com fluidez e
 * escrever com o texto travando numa nota longa.
 */

type BlockRowProps = {
  bloco: Bloco;
  /** Número já calculado pelo editor; a linha não sabe a posição dela na lista. */
  numero: number;
  autoFocus: boolean;
  onTexto: (id: string, texto: string) => void;
  /** Enter no meio do texto: o que fica e o que vai para a linha nova. */
  onDividir: (id: string, antes: string, depois: string) => void;
  /** Apagar com o cursor no começo da linha. */
  onApagarNoInicio: (id: string) => void;
  onAlternarTarefa: (id: string) => void;
  onFocar: (id: string) => void;
  onAbrirMenu: (id: string) => void;
  registrarEntrada: (id: string, entrada: TextInput | null) => void;
};

function BlockRowBase({
  bloco,
  numero,
  autoFocus,
  onTexto,
  onDividir,
  onApagarNoInicio,
  onAlternarTarefa,
  onFocar,
  onAbrirMenu,
  registrarEntrada,
}: BlockRowProps) {
  const { tokens } = useTheme();

  /**
   * A posição do cursor fica em ref, não em estado: ela muda a cada toque e
   * guardá-la em estado re-renderizaria a linha o tempo todo, desfazendo o
   * ganho do memo. Aqui ela só é consultada quando a tecla apagar é apertada.
   */
  const cursorNoInicio = useRef(true);

  const estilo = ESTILOS[bloco.tipo];

  const aoMudarTexto = (texto: string) => {
    /**
     * O Enter é capturado aqui, e não em onKeyPress, porque no Android o
     * onKeyPress não dispara de forma confiável para a tecla de nova linha em
     * campo de várias linhas. Procurar a quebra no texto recebido funciona nos
     * dois sistemas e não depende de teclado.
     *
     * Bloco de código é a exceção: ali a quebra de linha é conteúdo.
     */
    if (bloco.tipo !== 'codigo') {
      const quebra = texto.indexOf('\n');
      if (quebra >= 0) {
        onDividir(bloco.id, texto.slice(0, quebra), texto.slice(quebra + 1));
        return;
      }
    }

    onTexto(bloco.id, texto);
  };

  const aoApertarTecla = (evento: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (evento.nativeEvent.key === 'Backspace' && cursorNoInicio.current) {
      onApagarNoInicio(bloco.id);
    }
  };

  return (
    <View className="flex-row items-start px-5 py-0.5">
      <Marcador
        tipo={bloco.tipo}
        numero={numero}
        marcado={bloco.marcado}
        onAlternar={() => onAlternarTarefa(bloco.id)}
      />

      <View className={bloco.tipo === 'citacao' ? 'flex-1 border-l-2 border-hairline-light pl-3 dark:border-hairline-dark' : 'flex-1'}>
        <TextInput
          ref={(entrada) => registrarEntrada(bloco.id, entrada)}
          value={bloco.texto}
          onChangeText={aoMudarTexto}
          onKeyPress={aoApertarTecla}
          onFocus={() => onFocar(bloco.id)}
          onSelectionChange={(evento) => {
            const { start, end } = evento.nativeEvent.selection;
            cursorNoInicio.current = start === 0 && end === 0;
          }}
          multiline
          autoFocus={autoFocus}
          placeholder={PLACEHOLDERS[bloco.tipo]}
          placeholderTextColor={tokens.muted}
          className={estilo.classe}
          style={[
            { textAlignVertical: 'top', padding: 0 },
            estilo.estilo,
            // Tarefa concluída fica riscada e apagada: é o retorno visual que
            // faz marcar valer a pena.
            bloco.tipo === 'tarefa' && bloco.marcado
              ? { textDecorationLine: 'line-through', color: tokens.muted }
              : null,
          ]}
        />
      </View>

      {/* Alça de opções do bloco: mudar tipo, mover, apagar. Fica sempre
          visível porque um alvo que só aparece ao focar é impossível de achar. */}
      <Pressable onPress={() => onAbrirMenu(bloco.id)} hitSlop={10} className="ml-1 pt-1">
        <Feather name="more-vertical" size={14} color={tokens.hairline} />
      </Pressable>
    </View>
  );
}

function Marcador({
  tipo,
  numero,
  marcado,
  onAlternar,
}: {
  tipo: TipoBloco;
  numero: number;
  marcado?: boolean;
  onAlternar: () => void;
}) {
  const { tokens } = useTheme();

  if (tipo === 'tarefa') {
    return (
      <Pressable onPress={onAlternar} hitSlop={10} className="mr-2 pt-1">
        <Feather
          name={marcado ? 'check-square' : 'square'}
          size={17}
          color={marcado ? tokens.accent : tokens.muted}
        />
      </Pressable>
    );
  }

  if (tipo === 'lista') {
    return (
      <View className="mr-2 pt-1">
        <AppText variant="body" className="leading-[22px]">
          {'•'}
        </AppText>
      </View>
    );
  }

  if (tipo === 'numerada') {
    return (
      <View className="mr-2 min-w-[18px] pt-1">
        <AppText variant="body" className="leading-[22px]">
          {numero}.
        </AppText>
      </View>
    );
  }

  return null;
}

const ESTILOS: Record<TipoBloco, { classe: string; estilo: object }> = {
  titulo: {
    classe: 'text-ink-light dark:text-ink-dark',
    estilo: { fontSize: 22, lineHeight: 29, fontWeight: '700', marginTop: 10, marginBottom: 2 },
  },
  subtitulo: {
    classe: 'text-ink-light dark:text-ink-dark',
    estilo: { fontSize: 18, lineHeight: 25, fontWeight: '600', marginTop: 8 },
  },
  texto: {
    classe: 'text-ink-light dark:text-ink-dark',
    estilo: { fontSize: 16, lineHeight: 23 },
  },
  lista: {
    classe: 'text-ink-light dark:text-ink-dark',
    estilo: { fontSize: 16, lineHeight: 23 },
  },
  numerada: {
    classe: 'text-ink-light dark:text-ink-dark',
    estilo: { fontSize: 16, lineHeight: 23 },
  },
  tarefa: {
    classe: 'text-ink-light dark:text-ink-dark',
    estilo: { fontSize: 16, lineHeight: 23 },
  },
  citacao: {
    classe: 'text-muted-light dark:text-muted-dark',
    estilo: { fontSize: 16, lineHeight: 23, fontStyle: 'italic' },
  },
  codigo: {
    classe: 'rounded-lg bg-subtle-light text-ink-light dark:bg-subtle-dark dark:text-ink-dark',
    estilo: { fontSize: 14, lineHeight: 20, fontFamily: 'monospace', padding: 10 },
  },
  // Os tipos abaixo não são digitados; existem aqui só para o mapa ser total.
  divisor: { classe: '', estilo: {} },
  imagem: { classe: '', estilo: {} },
  grafico: { classe: '', estilo: {} },
  tabela: { classe: '', estilo: {} },
};

const PLACEHOLDERS: Record<TipoBloco, string> = {
  titulo: 'Título',
  subtitulo: 'Subtítulo',
  texto: 'Escreva algo…',
  lista: 'Item',
  numerada: 'Item',
  tarefa: 'A fazer',
  citacao: 'Citação',
  codigo: 'código',
  divisor: '',
  imagem: '',
  grafico: '',
  tabela: '',
};

/**
 * A comparação decide o que faz a linha redesenhar. Só o que muda a aparência
 * dela entra: se `bloco` for o mesmo objeto, nada mudou naquela linha.
 */
export const BlockRow = memo(
  BlockRowBase,
  (anterior, proximo) =>
    anterior.bloco === proximo.bloco &&
    anterior.numero === proximo.numero &&
    anterior.autoFocus === proximo.autoFocus
);
