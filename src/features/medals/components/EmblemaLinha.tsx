import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';

import { emblemasNaLinha, type Emblema } from '../emblemas';

/**
 * Os emblemas ao lado do nome, na lista de membros e no chat.
 *
 * Ícone puro, sem etiqueta com texto: o nome já ocupa a linha, e três etiquetas
 * escritas empurrariam o nome para fora da tela em qualquer apelido de tamanho
 * normal. Quem quiser saber o que cada um significa toca na pessoa.
 */
export function EmblemaLinha({ codigos, tamanho = 12 }: { codigos: string[]; tamanho?: number }) {
  const { mostrar, resto } = emblemasNaLinha(codigos);
  if (mostrar.length === 0) return null;

  return (
    <View className="flex-row items-center gap-1">
      {mostrar.map((e) => (
        <Feather
          key={e.codigo}
          name={e.icone as keyof typeof Feather.glyphMap}
          size={tamanho}
          color={e.cor}
        />
      ))}
      {resto > 0 ? (
        <AppText style={{ fontSize: tamanho - 2, opacity: 0.6 }}>+{resto}</AppText>
      ) : null}
    </View>
  );
}

/** A lista com nome e explicação, para a folha de detalhe da pessoa. */
export function EmblemaDetalhe({ emblemas }: { emblemas: Emblema[] }) {
  if (emblemas.length === 0) return null;

  return (
    <View className="gap-2">
      {emblemas.map((e) => (
        <View key={e.codigo} className="flex-row items-center gap-3">
          <View
            className="h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: e.cor + '22' }}
          >
            <Feather name={e.icone as keyof typeof Feather.glyphMap} size={15} color={e.cor} />
          </View>
          <View className="flex-1">
            <AppText variant="body">{e.nome}</AppText>
            <AppText variant="small">{e.como}</AppText>
          </View>
        </View>
      ))}
    </View>
  );
}
