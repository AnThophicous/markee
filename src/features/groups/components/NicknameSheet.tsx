import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Apelido dentro de um grupo.
 *
 * A mesma pessoa é "Ana" no grupo da família e "monitora_bio" no da turma. É a
 * ideia do Discord: o nome da conta é um só, mas quem você é muda com o lugar.
 *
 * O limite de 32 caracteres também é cobrado no servidor, pela `set_nickname`.
 * O daqui existe para a pessoa ver o contador enquanto digita, não para
 * proteger nada — um app modificado ignora este campo, e o servidor recusa
 * mesmo assim.
 */

const LIMITE = 32;

type NicknameSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Apelido atual, se houver. */
  atual: string | null;
  /** Nome da conta — é para ele que se volta ao limpar o campo. */
  nomeReal: string;
  onSalvar: (apelido: string) => void;
  salvando?: boolean;
  erro?: string | null;
};

export function NicknameSheet({
  visible,
  onClose,
  atual,
  nomeReal,
  onSalvar,
  salvando,
  erro,
}: NicknameSheetProps) {
  const { tokens } = useTheme();
  const [apelido, setApelido] = useState('');

  useEffect(() => {
    if (visible) setApelido(atual ?? '');
  }, [visible, atual]);

  const limpo = apelido.trim();

  return (
    <Sheet visible={visible} onClose={onClose} edge="bottom">
      <View>
        <AppText variant="heading" className="mb-1 px-1">
          Seu apelido aqui
        </AppText>
        <AppText variant="caption" className="mb-4 px-1">
          Vale só neste grupo. Em branco, você aparece como {nomeReal}.
        </AppText>

        <TextInput
          value={apelido}
          onChangeText={(valor) => setApelido(valor.slice(0, LIMITE))}
          placeholder={nomeReal}
          placeholderTextColor={tokens.muted}
          maxLength={LIMITE}
          autoFocus
          className="rounded-xl bg-subtle-light px-4 py-3.5 text-[16px] text-ink-light dark:bg-subtle-dark dark:text-ink-dark"
        />

        <AppText variant="small" className="mb-4 mt-1.5 px-1" style={{ color: tokens.muted }}>
          {limpo.length}/{LIMITE}
        </AppText>

        {erro ? (
          <AppText variant="caption" className="mb-3 px-1 text-danger">
            {erro}
          </AppText>
        ) : null}

        <View className="gap-2">
          <Button
            label={salvando ? 'Salvando…' : 'Salvar'}
            disabled={salvando}
            className={salvando ? 'opacity-50' : undefined}
            onPress={() => onSalvar(limpo)}
          />
          {atual ? (
            // Mandar vazio é o que a função no servidor entende como "voltar ao
            // nome real" — ela transforma texto em branco em nulo.
            <Button label="Usar meu nome real" variant="ghost" onPress={() => onSalvar('')} />
          ) : null}
        </View>
      </View>
    </Sheet>
  );
}
