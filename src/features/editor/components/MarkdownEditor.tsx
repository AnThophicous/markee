import { useRef, useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';
import { FloatingToolbar, type ToolbarAction } from './FloatingToolbar';
import { pickAndUploadImage } from '../services/image-upload.service';
import { insertAtSelection, insertLinePrefix, TABLE_TEMPLATE, type Selection } from '../utils/syntax-inserter';

type MarkdownEditorProps = {
  value: string;
  onChange: (text: string) => void;
  onRequestDone: () => void;
  autoFocus?: boolean;
  /** Altura da barra de navegação do sistema, para a toolbar não ficar por baixo. */
  bottomInset?: number;
};

export function MarkdownEditor({
  value,
  onChange,
  onRequestDone,
  autoFocus,
  bottomInset = 0,
}: MarkdownEditorProps) {
  const { tokens } = useTheme();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  /**
   * A seleção fica NÃO controlada durante a digitação — passar `selection` a
   * cada render faz o cursor brigar com o usuário e pular de lugar. Só assumimos
   * o controle no instante seguinte a uma ação da toolbar, e soltamos logo após.
   */
  const selectionRef = useRef<Selection>({ start: 0, end: 0 });
  const [forcedSelection, setForcedSelection] = useState<Selection | null>(null);

  const apply = (result: { text: string; selection: Selection }) => {
    onChange(result.text);
    selectionRef.current = result.selection;
    setForcedSelection(result.selection);
  };

  const insertImage = async () => {
    setUploadError(null);
    setUploading(true);
    try {
      const image = await pickAndUploadImage();
      if (!image) return;
      apply(
        insertAtSelection(value, selectionRef.current, {
          prefix: `\n![${image.alt}](${image.url})\n`,
          placeholder: '',
        })
      );
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Falha ao enviar a imagem.');
    } finally {
      setUploading(false);
    }
  };

  const applyAction = (action: ToolbarAction) => {
    const selection = selectionRef.current;
    const cursor = selection.start;

    switch (action) {
      case 'image':
        void insertImage();
        return;
      case 'h1':
        return apply(insertLinePrefix(value, cursor, '# '));
      case 'h2':
        return apply(insertLinePrefix(value, cursor, '## '));
      case 'h3':
        return apply(insertLinePrefix(value, cursor, '### '));
      case 'bullet':
        return apply(insertLinePrefix(value, cursor, '- '));
      case 'numbered':
        return apply(insertLinePrefix(value, cursor, '1. '));
      case 'checklist':
        return apply(insertLinePrefix(value, cursor, '- [ ] '));
      case 'quote':
        return apply(insertLinePrefix(value, cursor, '> '));
      case 'code':
        return apply(insertAtSelection(value, selection, { prefix: '```\n', suffix: '\n```', placeholder: 'código' }));
      case 'bold':
        return apply(insertAtSelection(value, selection, { prefix: '**', suffix: '**', placeholder: 'negrito' }));
      case 'italic':
        return apply(insertAtSelection(value, selection, { prefix: '*', suffix: '*', placeholder: 'itálico' }));
      case 'link':
        return apply(insertAtSelection(value, selection, { prefix: '[', suffix: '](url)', placeholder: 'texto' }));
      case 'table':
        return apply(insertAtSelection(value, selection, { prefix: TABLE_TEMPLATE, placeholder: '' }));
    }
  };

  return (
    <View className="flex-1">
      <TextInput
        value={value}
        onChangeText={onChange}
        selection={forcedSelection ?? undefined}
        onSelectionChange={(event) => {
          selectionRef.current = event.nativeEvent.selection;
          // Devolve o controle ao TextInput assim que ele aplica nossa posição.
          if (forcedSelection) setForcedSelection(null);
        }}
        multiline
        autoFocus={autoFocus}
        placeholder="Escreva algo..."
        placeholderTextColor={tokens.muted}
        className="flex-1 px-5 py-2 text-[17px] leading-[24px] text-ink-light dark:text-ink-dark"
        style={{ textAlignVertical: 'top' }}
      />
      {uploading ? (
        <View className="flex-row items-center gap-2 px-5 py-2">
          <ActivityIndicator size="small" color={tokens.accent} />
          <AppText variant="caption">Enviando imagem…</AppText>
        </View>
      ) : null}

      {uploadError ? (
        <AppText variant="caption" className="px-5 py-2 text-danger">
          {uploadError}
        </AppText>
      ) : null}

      <FloatingToolbar onAction={applyAction} onDone={onRequestDone} bottomInset={bottomInset} />
    </View>
  );
}
