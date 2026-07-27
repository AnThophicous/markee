import { useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { useTheme } from '@/theme/ThemeProvider';
import type { DadosGrafico } from '../model/blocks';
import { Grafico } from './Grafico';

/**
 * Onde os números do gráfico são digitados.
 *
 * O valor fica guardado como TEXTO enquanto se digita, e só vira número na
 * hora de salvar. Convertendo a cada tecla, digitar "1,5" seria impossível: no
 * instante em que a vírgula é digitada o texto ainda não é um número válido, o
 * campo voltaria para "1" e a vírgula sumiria — o defeito clássico de campo
 * numérico que "não deixa digitar".
 *
 * A prévia fica na mesma tela, em cima. Sem ela seria preciso salvar, olhar,
 * reabrir e corrigir a cada ajuste.
 */

type Linha = { rotulo: string; valor: string };

const FORMAS: { tipo: DadosGrafico['tipo']; rotulo: string; icone: keyof typeof Feather.glyphMap; para: string }[] = [
  { tipo: 'barra', rotulo: 'Barra', icone: 'bar-chart-2', para: 'comparar quantidades' },
  { tipo: 'linha', rotulo: 'Linha', icone: 'trending-up', para: 'ver a evolução' },
  { tipo: 'pizza', rotulo: 'Pizza', icone: 'pie-chart', para: 'ver partes do todo' },
];

type GraficoEditorSheetProps = {
  visible: boolean;
  dados: DadosGrafico | null;
  onClose: () => void;
  onSalvar: (dados: DadosGrafico) => void;
};

export function GraficoEditorSheet({ visible, dados, onClose, onSalvar }: GraficoEditorSheetProps) {
  const { tokens } = useTheme();

  const [tipo, setTipo] = useState<DadosGrafico['tipo']>('barra');
  const [titulo, setTitulo] = useState('');
  const [linhas, setLinhas] = useState<Linha[]>([{ rotulo: '', valor: '' }]);

  /**
   * Recarrega ao abrir. O painel é montado uma vez e reaproveitado para
   * qualquer gráfico da nota; sem isto ele mostraria os dados do gráfico
   * anterior.
   */
  useEffect(() => {
    if (!visible) return;

    setTipo(dados?.tipo ?? 'barra');
    setTitulo(dados?.titulo ?? '');
    setLinhas(
      dados && dados.dados.length > 0
        ? dados.dados.map((ponto) => ({ rotulo: ponto.rotulo, valor: String(ponto.valor) }))
        : [{ rotulo: '', valor: '' }]
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  /** Vírgula é o separador decimal em português; o JavaScript só entende ponto. */
  const paraNumero = (texto: string): number => {
    const numero = Number(texto.replace(',', '.').trim());
    return Number.isFinite(numero) ? numero : 0;
  };

  const montar = (): DadosGrafico => ({
    tipo,
    titulo: titulo.trim(),
    // Linha totalmente em branco é descartada: ela apareceria como uma fatia
    // ou barra de tamanho zero, sem rótulo, e ninguém entenderia o que é.
    dados: linhas
      .filter((linha) => linha.rotulo.trim() !== '' || linha.valor.trim() !== '')
      .map((linha) => ({ rotulo: linha.rotulo.trim(), valor: paraNumero(linha.valor) })),
  });

  const alterarLinha = (indice: number, mudanca: Partial<Linha>) =>
    setLinhas((atuais) => atuais.map((linha, i) => (i === indice ? { ...linha, ...mudanca } : linha)));

  const removerLinha = (indice: number) =>
    setLinhas((atuais) => (atuais.length > 1 ? atuais.filter((_, i) => i !== indice) : atuais));

  return (
    <Sheet visible={visible} onClose={onClose} edge="bottom">
      <AppText variant="heading" className="mb-3 px-1">
        Gráfico
      </AppText>

      <ScrollView className="max-h-[460px]" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View className="mb-4">
          <Grafico dados={montar()} largura={260} />
        </View>

        <View className="mb-3 flex-row gap-2">
          {FORMAS.map((forma) => (
            <Pressable
              key={forma.tipo}
              onPress={() => setTipo(forma.tipo)}
              className={`flex-1 items-center gap-1 rounded-2xl py-3 ${
                tipo === forma.tipo ? 'bg-accent-soft' : 'bg-subtle-light dark:bg-subtle-dark'
              }`}
            >
              <Feather
                name={forma.icone}
                size={17}
                color={tipo === forma.tipo ? tokens.accent : tokens.ink}
              />
              <AppText variant="small" className={tipo === forma.tipo ? 'text-accent' : undefined}>
                {forma.rotulo}
              </AppText>
            </Pressable>
          ))}
        </View>

        <AppText variant="small" className="mb-3 px-1">
          {FORMAS.find((forma) => forma.tipo === tipo)?.para}
        </AppText>

        <TextInput
          value={titulo}
          onChangeText={setTitulo}
          placeholder="Título do gráfico (opcional)"
          placeholderTextColor={tokens.muted}
          className="mb-3 rounded-xl bg-subtle-light px-3.5 py-3 text-[15px] text-ink-light dark:bg-subtle-dark dark:text-ink-dark"
        />

        {linhas.map((linha, indice) => (
          <View key={indice} className="mb-2 flex-row items-center gap-2">
            <TextInput
              value={linha.rotulo}
              onChangeText={(texto) => alterarLinha(indice, { rotulo: texto })}
              placeholder="Nome"
              placeholderTextColor={tokens.muted}
              className="flex-1 rounded-xl bg-subtle-light px-3.5 py-2.5 text-[15px] text-ink-light dark:bg-subtle-dark dark:text-ink-dark"
            />
            <TextInput
              value={linha.valor}
              onChangeText={(texto) => alterarLinha(indice, { valor: texto })}
              placeholder="0"
              placeholderTextColor={tokens.muted}
              keyboardType="numeric"
              className="w-20 rounded-xl bg-subtle-light px-3.5 py-2.5 text-[15px] text-ink-light dark:bg-subtle-dark dark:text-ink-dark"
            />
            <Pressable onPress={() => removerLinha(indice)} hitSlop={8} className="p-1">
              <Feather name="x" size={16} color={tokens.muted} />
            </Pressable>
          </View>
        ))}

        <Pressable
          onPress={() => setLinhas((atuais) => [...atuais, { rotulo: '', valor: '' }])}
          className="mt-1 flex-row items-center gap-2 py-2 active:opacity-60"
        >
          <Feather name="plus" size={15} color={tokens.accent} />
          <AppText variant="caption" className="text-accent">
            Adicionar valor
          </AppText>
        </Pressable>
      </ScrollView>

      <View className="mt-3 gap-2">
        <Button label="Pronto" onPress={() => onSalvar(montar())} />
        <Button label="Cancelar" variant="ghost" onPress={onClose} />
      </View>
    </Sheet>
  );
}
