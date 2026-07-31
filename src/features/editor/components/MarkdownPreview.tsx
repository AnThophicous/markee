import { createContext, useContext, useMemo } from 'react';
import { Image, Linking, Pressable, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Divider } from '@/components/Divider';
import { useTheme } from '@/theme/ThemeProvider';
import { cn } from '@/utils/cn';
import { displayHost, isSafeLink, isSelfHostedImage } from '@/utils/url-safety';
import { lerGrafico } from '../model/blocks';
import { parseMarkdown, tokenizeInline, type InlineToken } from '../utils/markdown-parser';
import { Grafico } from './Grafico';

/**
 * Como abrir uma nota citada com `[[colchetes]]`.
 *
 * Vai por contexto e não por propriedade porque `InlineText` é chamado de sete
 * lugares diferentes aqui dentro — parágrafo, item de lista, citação, célula de
 * tabela, item de checklist. Passar a função de mão em mão por todos eles
 * encheria cada assinatura de um argumento que só um token usa, e a primeira
 * chamada esquecida viraria uma ligação que não abre nada, em silêncio.
 *
 * Nulo quer dizer "sem navegação": o texto aparece marcado mas não é tocável.
 * É o caso da prévia dentro do editor, onde tocar já significa outra coisa.
 */
const AbrirNota = createContext<((titulo: string) => void) | null>(null);

function InlineText({ tokens, className }: { tokens: InlineToken[]; className?: string }) {
  const abrirNota = useContext(AbrirNota);

  return (
    <AppText variant="body" className={className}>
      {tokens.map((token, index) => {
        switch (token.type) {
          case 'nota':
            return (
              <AppText
                key={index}
                className="text-accent"
                style={{ textDecorationLine: 'underline' }}
                onPress={abrirNota ? () => abrirNota(token.text) : undefined}
              >
                {token.text}
              </AppText>
            );
          case 'mark':
            // Fundo amarelo em vez de cor de texto: marca-texto é sobre o fundo,
            // e trocar a cor da letra some no tema escuro.
            return (
              <AppText key={index} style={{ backgroundColor: '#F9AB0055' }}>
                {' '}
                {token.text}{' '}
              </AppText>
            );
          case 'bold':
            return (
              <AppText key={index} variant="bodyEmphasis">
                {token.text}
              </AppText>
            );
          case 'italic':
            return (
              <AppText key={index} style={{ fontStyle: 'italic' }}>
                {token.text}
              </AppText>
            );
          case 'code':
            return (
              <AppText key={index} className="bg-subtle-light dark:bg-subtle-dark" style={{ fontFamily: 'Menlo' }}>
                {' '}
                {token.text}{' '}
              </AppText>
            );
          case 'link': {
            // Link com esquema perigoso (javascript:, data:, intent:) vira texto.
            if (!isSafeLink(token.href)) {
              return <AppText key={index}>{token.text}</AppText>;
            }
            return (
              <AppText key={index} className="text-accent" onPress={() => Linking.openURL(token.href)}>
                {token.text}
              </AppText>
            );
          }
          default:
            return <AppText key={index}>{token.text}</AppText>;
        }
      })}
    </AppText>
  );
}

export function MarkdownPreview({
  content,
  onAbrirNota,
}: {
  content: string;
  onAbrirNota?: (titulo: string) => void;
}) {
  const { tokens } = useTheme();
  const { width } = useWindowDimensions();
  const blocks = useMemo(() => parseMarkdown(content), [content]);

  return (
    <AbrirNota.Provider value={onAbrirNota ?? null}>
      <MarkdownCorpo blocks={blocks} tokens={tokens} width={width} />
    </AbrirNota.Provider>
  );
}

function MarkdownCorpo({
  blocks,
  tokens,
  width,
}: {
  blocks: ReturnType<typeof parseMarkdown>;
  tokens: ReturnType<typeof useTheme>['tokens'];
  width: number;
}) {
  return (
    <View className="gap-0.5 px-5 pb-10">
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'heading':
            return (
              <AppText key={index} variant={block.level === 1 ? 'title' : 'heading'} className="mt-3">
                {block.text}
              </AppText>
            );
          case 'quote':
            return (
              <View key={index} className="my-1 border-l-2 border-hairline-light pl-3 dark:border-hairline-dark">
                <InlineText tokens={tokenizeInline(block.text)} className="text-muted-light dark:text-muted-dark" />
              </View>
            );
          case 'checklist':
            return (
              <View key={index} className="flex-row items-start gap-2 py-0.5">
                <Feather
                  name={block.checked ? 'check-square' : 'square'}
                  size={16}
                  color={block.checked ? tokens.accent : tokens.muted}
                  style={{ marginTop: 4 }}
                />
                <View className="flex-1">
                  <InlineText tokens={tokenizeInline(block.text)} />
                </View>
              </View>
            );
          case 'bullet':
            return (
              <View key={index} className="flex-row items-start gap-2 py-0.5">
                <AppText variant="body">{'•'}</AppText>
                <View className="flex-1">
                  <InlineText tokens={tokenizeInline(block.text)} />
                </View>
              </View>
            );
          case 'numbered':
            return (
              <View key={index} className="flex-row items-start gap-2 py-0.5">
                <AppText variant="body">{block.index}.</AppText>
                <View className="flex-1">
                  <InlineText tokens={tokenizeInline(block.text)} />
                </View>
              </View>
            );
          case 'code': {
            // Um bloco ```grafico carrega JSON, não código. Sem este desvio a
            // nota mostraria as chaves e os números crus na leitura.
            if (block.lang === 'grafico') {
              const dados = lerGrafico(block.lines.join('\n'));
              if (dados) {
                return (
                  <View key={index} className="my-2">
                    <Grafico dados={dados} largura={width - 40} />
                  </View>
                );
              }
            }

            return (
              <View key={index} className="my-1 rounded-lg bg-subtle-light dark:bg-subtle-dark p-3">
                {block.lines.map((line, lineIndex) => (
                  <AppText key={lineIndex} style={{ fontFamily: 'monospace', fontSize: 14, lineHeight: 20 }}>
                    {line || ' '}
                  </AppText>
                ))}
              </View>
            );
          }
          case 'table':
            return (
              <View
                key={index}
                className="my-1 overflow-hidden rounded-lg border border-hairline-light dark:border-hairline-dark"
              >
                {block.rows.map((row, rowIndex) => (
                  <View
                    key={rowIndex}
                    className={cn(
                      'flex-row',
                      rowIndex !== block.rows.length - 1 && 'border-b border-hairline-light dark:border-hairline-dark',
                      rowIndex === 0 && 'bg-subtle-light dark:bg-subtle-dark'
                    )}
                  >
                    {row.map((cell, cellIndex) => (
                      <View key={cellIndex} className="flex-1 px-2.5 py-2">
                        <AppText variant={rowIndex === 0 ? 'bodyEmphasis' : 'body'} style={{ fontSize: 14 }}>
                          {cell}
                        </AppText>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            );
          case 'image': {
            if (isSelfHostedImage(block.url)) {
              return (
                <Image
                  key={index}
                  source={{ uri: block.url }}
                  className="my-2 h-56 w-full rounded-xl"
                  resizeMode="cover"
                  accessibilityLabel={block.alt || 'Imagem'}
                />
              );
            }

            // Imagem de fora não carrega: abrir a conexão entregaria IP e
            // horário a quem hospeda. Vira um cartão que o usuário abre no
            // navegador se quiser, já sabendo para onde vai.
            return (
              <Pressable
                key={index}
                onPress={() => isSafeLink(block.url) && Linking.openURL(block.url)}
                className="my-2 flex-row items-center gap-3 rounded-xl border border-hairline-light p-3 dark:border-hairline-dark"
              >
                <Feather name="image" size={18} color={tokens.muted} />
                <View className="flex-1">
                  <AppText variant="caption">{block.alt || 'Imagem externa'}</AppText>
                  <AppText variant="small" numberOfLines={1}>
                    {displayHost(block.url)} · toque para abrir no navegador
                  </AppText>
                </View>
              </Pressable>
            );
          }
          case 'hr':
            return <Divider key={index} className="my-3" />;
          case 'blank':
            return <View key={index} className="h-2" />;
          default:
            return block.text ? (
              <InlineText key={index} tokens={tokenizeInline(block.text)} />
            ) : (
              <View key={index} className="h-2" />
            );
        }
      })}
    </View>
  );
}
