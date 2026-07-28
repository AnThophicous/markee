import { useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { useTheme } from '@/theme/ThemeProvider';
import type { Profile } from '../services/profile.service';

/**
 * O recado do momento.
 *
 * É a coisa mais barata de fazer e das que mais movimentam um app de grupo: dá
 * assunto sem precisar puxar conversa. "estudando pra prova de bio" no perfil de
 * alguém é convite para a pessoa do lado responder.
 *
 * Não é recurso pago de propósito. Cobrar por status renderia pouco e tiraria
 * justamente o que faz voltar ao app.
 */

/**
 * Grade fixa em vez do teclado de emoji.
 *
 * O servidor recusa mais de um emoji, e o teclado do sistema deixa digitar
 * quantos a pessoa quiser — ela escreveria três, tocaria em salvar e receberia
 * um erro do banco. Aqui é impossível escolher errado.
 *
 * São os emoji que aparecem na vida de quem estuda; a lista é curta de propósito
 * para caber sem rolagem.
 */
const EMOJIS = [
  '📚', '✍️', '🧠', '🎯',
  '🔥', '☕', '🎧', '💡',
  '😵‍💫', '💤', '🏃', '🎮',
  '✅', '🌙', '🤝', '🎉',
];

/** Quanto tempo o recado vale. `minutos` nulo = fica até a pessoa tirar. */
const DURACOES: { rotulo: string; minutos: number | null }[] = [
  { rotulo: 'Sem prazo', minutos: null },
  { rotulo: '30 min', minutos: 30 },
  { rotulo: '1 hora', minutos: 60 },
  { rotulo: '4 horas', minutos: 240 },
];

const LIMITE_TEXTO = 60;

type StatusSheetProps = {
  visible: boolean;
  onClose: () => void;
  profile: Profile;
  onSalvar: (patch: {
    statusText: string | null;
    statusEmoji: string | null;
    statusUntil: string | null;
  }) => void;
  salvando?: boolean;
};

export function StatusSheet({ visible, onClose, profile, onSalvar, salvando }: StatusSheetProps) {
  const { tokens } = useTheme();

  const [texto, setTexto] = useState('');
  const [emoji, setEmoji] = useState<string | null>(null);
  const [minutos, setMinutos] = useState<number | null>(null);

  // Reabrir mostra o que está valendo agora, não o rascunho da vez passada.
  useEffect(() => {
    if (!visible) return;
    setTexto(profile.statusText ?? '');
    setEmoji(profile.statusEmoji ?? null);
    setMinutos(null);
  }, [visible, profile.statusText, profile.statusEmoji]);

  const vazio = !texto.trim() && !emoji;

  const salvar = () => {
    onSalvar({
      statusText: texto.trim() || null,
      statusEmoji: emoji,
      statusUntil: minutos === null ? null : new Date(Date.now() + minutos * 60_000).toISOString(),
    });
    onClose();
  };

  const limpar = () => {
    onSalvar({ statusText: null, statusEmoji: null, statusUntil: null });
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} edge="bottom">
      <ScrollView showsVerticalScrollIndicator={false} className="max-h-[520px]">
        <AppText variant="heading" className="mb-1 px-1">
          Seu recado
        </AppText>
        <AppText variant="caption" className="mb-4 px-1">
          Aparece no seu perfil e ao lado do seu nome nos grupos.
        </AppText>

        <View className="mb-4 flex-row items-center gap-2.5 rounded-xl bg-subtle-light px-3 py-2.5 dark:bg-subtle-dark">
          <AppText style={{ fontSize: 22 }}>{emoji ?? '💬'}</AppText>
          <TextInput
            value={texto}
            onChangeText={(valor) => setTexto(valor.slice(0, LIMITE_TEXTO))}
            placeholder="No que você está?"
            placeholderTextColor={tokens.muted}
            maxLength={LIMITE_TEXTO}
            className="flex-1 text-[16px] text-ink-light dark:text-ink-dark"
          />
          {texto.length > LIMITE_TEXTO - 15 ? (
            <AppText variant="small" style={{ color: tokens.muted }}>
              {LIMITE_TEXTO - texto.length}
            </AppText>
          ) : null}
        </View>

        <AppText variant="caption" className="mb-2 px-1">
          EMOJI
        </AppText>
        <View className="mb-4 flex-row flex-wrap gap-2">
          {EMOJIS.map((opcao) => (
            <Pressable
              key={opcao}
              // Tocar no que já está escolhido tira o emoji. Sem isso não haveria
              // como voltar a "só texto" depois de escolher um.
              onPress={() => setEmoji((atual) => (atual === opcao ? null : opcao))}
              className={`h-11 w-11 items-center justify-center rounded-xl ${
                emoji === opcao ? 'bg-accent-soft' : 'bg-subtle-light dark:bg-subtle-dark'
              }`}
              style={emoji === opcao ? { borderWidth: 1.5, borderColor: tokens.accent } : undefined}
            >
              <AppText style={{ fontSize: 20 }}>{opcao}</AppText>
            </Pressable>
          ))}
        </View>

        <AppText variant="caption" className="mb-2 px-1">
          DURAÇÃO
        </AppText>
        <View className="mb-5 flex-row flex-wrap gap-2">
          {DURACOES.map((opcao) => (
            <Pressable
              key={opcao.rotulo}
              onPress={() => setMinutos(opcao.minutos)}
              className={`rounded-full px-3.5 py-2 ${
                minutos === opcao.minutos ? 'bg-accent' : 'bg-subtle-light dark:bg-subtle-dark'
              }`}
            >
              <AppText
                variant="small"
                style={{ color: minutos === opcao.minutos ? '#FFFFFF' : tokens.ink }}
              >
                {opcao.rotulo}
              </AppText>
            </Pressable>
          ))}
        </View>

        <View className="gap-2">
          <Button
            label={salvando ? 'Salvando…' : 'Salvar'}
            disabled={vazio || salvando}
            className={vazio || salvando ? 'opacity-50' : undefined}
            onPress={salvar}
          />
          {profile.statusText || profile.statusEmoji ? (
            <Button label="Tirar o recado" variant="ghost" onPress={limpar} />
          ) : null}
        </View>
      </ScrollView>
    </Sheet>
  );
}
