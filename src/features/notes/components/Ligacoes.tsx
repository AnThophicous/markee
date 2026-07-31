import { Pressable, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';

import { oQueEstaNotaCita, quemCita, type NotaCitada } from '../services/ligacoes.service';

type LigacoesProps = {
  noteId: string;
  titulo: string;
  conteudo: string;
  onAbrir: (noteId: string) => void;
  onCriar: (titulo: string) => void;
};

/**
 * O rodapé de ligações, no fim da leitura.
 *
 * Duas listas e elas respondem perguntas diferentes:
 *
 *   CITA        para onde esta nota aponta. É navegação — o índice do assunto.
 *   MENCIONADA  quem aponta para cá. É descoberta: a nota de "Fotossíntese"
 *               mostra que a de "Prova de Bio 12/08" fala dela, e essa ligação
 *               ninguém teria lembrado de procurar.
 *
 * A segunda é a que faz o recurso valer. A primeira a pessoa já sabe, porque
 * acabou de ler o texto.
 *
 * Some inteiro quando não há nada dos dois lados: um rodapé "Nenhuma ligação"
 * em toda nota do app seria ruído permanente em troca de zero informação.
 */
export function Ligacoes({ noteId, titulo, conteudo, onAbrir, onCriar }: LigacoesProps) {
  const { tokens } = useTheme();

  const citadas = useQuery({
    queryKey: ['ligacoes', 'cita', noteId, conteudo],
    queryFn: () => oQueEstaNotaCita(conteudo),
  });

  const mencoes = useQuery({
    queryKey: ['ligacoes', 'mencoes', noteId, titulo],
    queryFn: () => quemCita(noteId, titulo),
    // Sem título não há como alguém citar esta nota: `[[]]` não existe.
    enabled: titulo.trim().length > 0,
  });

  const cita = citadas.data;
  const temCita = (cita?.existentes.length ?? 0) + (cita?.faltando.length ?? 0) > 0;
  const temMencao = (mencoes.data?.length ?? 0) > 0;
  if (!temCita && !temMencao) return null;

  return (
    <View className="mt-6 gap-4 border-t border-hairline-light px-5 pt-5 dark:border-hairline-dark">
      {temCita ? (
        <View className="gap-2">
          <AppText variant="small">ESTA NOTA CITA</AppText>
          {cita!.existentes.map((n) => (
            <Item key={n.id} nota={n} onPress={() => onAbrir(n.id)} />
          ))}
          {/* Citação para nota que não existe não é erro — é anotação de algo a
              escrever depois. Por isso ela aparece com "criar" em vez de sumir
              ou de virar aviso vermelho. */}
          {cita!.faltando.map((nome) => (
            <Pressable
              key={nome}
              onPress={() => onCriar(nome)}
              className="flex-row items-center gap-2.5 rounded-2xl bg-surface-light px-3.5 py-3 active:opacity-70 dark:bg-surface-dark"
            >
              <Feather name="plus-circle" size={15} color={tokens.muted} />
              <AppText variant="body" numberOfLines={1} className="flex-1" style={{ opacity: 0.7 }}>
                {nome}
              </AppText>
              <AppText variant="small">criar</AppText>
            </Pressable>
          ))}
        </View>
      ) : null}

      {temMencao ? (
        <View className="gap-2">
          <AppText variant="small">
            MENCIONADA EM {mencoes.data!.length}{' '}
            {mencoes.data!.length === 1 ? 'NOTA' : 'NOTAS'}
          </AppText>
          {mencoes.data!.map((n) => (
            <Item key={n.id} nota={n} onPress={() => onAbrir(n.id)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Item({ nota, onPress }: { nota: NotaCitada; onPress: () => void }) {
  const { tokens } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-2.5 rounded-2xl bg-surface-light px-3.5 py-3 active:opacity-70 dark:bg-surface-dark"
    >
      {nota.emoji ? (
        <AppText style={{ fontSize: 16 }}>{nota.emoji}</AppText>
      ) : (
        <Feather name="file-text" size={15} color={tokens.muted} />
      )}
      <AppText variant="body" numberOfLines={1} className="flex-1">
        {nota.titulo || 'Sem título'}
      </AppText>
      <Feather name="chevron-right" size={15} color={tokens.muted} />
    </Pressable>
  );
}
