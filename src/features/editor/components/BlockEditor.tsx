import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';
import {
  criarBloco,
  ehDeTexto,
  paraBlocos,
  paraMarkdown,
  type Bloco,
  type DadosGrafico,
  type TipoBloco,
} from '../model/blocks';
import { pickAndUploadImage } from '../services/image-upload.service';
import { BlocoVisual } from './BlocoVisual';
import { BlockRow } from './BlockRow';
import { BlocoMenuSheet } from './BlocoMenuSheet';
import { GraficoEditorSheet } from './GraficoEditorSheet';
import { InserirBlocoSheet } from './InserirBlocoSheet';
import { BarraDeBlocos } from './BarraDeBlocos';

/**
 * Editor por blocos.
 *
 * Substitui a caixa única de markdown cru. Antes a pessoa via `# Título` e
 * `- [ ] tarefa` escritos na tela e precisava saber a sintaxe para formatar;
 * agora um título parece um título e uma tarefa tem caixa de marcar.
 *
 * Por baixo continua markdown — a conversão vive em model/blocks.ts e é o que
 * mantém funcionando a busca, a exportação e a leitura pela IA.
 *
 * `markdownInicial` é lido UMA vez, na montagem. O editor é a fonte da verdade
 * enquanto está aberto e avisa a tela a cada mudança; se ele também recebesse o
 * texto de volta, cada tecla apertada recriaria os blocos, com ids novos, e o
 * cursor pularia para fora do campo a cada letra.
 */

type BlockEditorProps = {
  markdownInicial: string;
  onChange: (markdown: string) => void;
  onRequestDone: () => void;
  autoFocus?: boolean;
  bottomInset?: number;
};

export function BlockEditor({
  markdownInicial,
  onChange,
  onRequestDone,
  autoFocus,
  bottomInset = 0,
}: BlockEditorProps) {
  const { tokens } = useTheme();
  const { width } = useWindowDimensions();

  const [blocos, setBlocos] = useState<Bloco[]>(() => paraBlocos(markdownInicial));
  const [ativo, setAtivo] = useState<string | null>(null);

  const [menuDoBloco, setMenuDoBloco] = useState<string | null>(null);
  const [inserirVisivel, setInserirVisivel] = useState(false);
  const [graficoEmEdicao, setGraficoEmEdicao] = useState<string | null>(null);

  const [enviando, setEnviando] = useState(false);
  const [erroDeEnvio, setErroDeEnvio] = useState<string | null>(null);

  const entradas = useRef(new Map<string, TextInput | null>());
  const primeiraVez = useRef(true);

  /**
   * A primeira execução é pulada de propósito. Sem isso, abrir uma nota já
   * gravaria a versão normalizada e mudaria a data de alteração — a lista de
   * notas se reordenaria só por alguém ter aberto uma delas para ler.
   */
  useEffect(() => {
    if (primeiraVez.current) {
      primeiraVez.current = false;
      return;
    }
    onChange(paraMarkdown(blocos));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocos]);

  /**
   * Espera o campo existir antes de focar: ele acabou de ser criado e ainda não
   * foi montado quando esta função é chamada.
   *
   * Nunca é chamada de dentro de um atualizador de estado. O React pode
   * executar o atualizador mais de uma vez para a mesma mudança, e aí o foco
   * seria agendado em duplicidade — por isso os handlers abaixo calculam a
   * lista nova a partir de `blocos` e só depois pedem o foco.
   */
  const focar = (id: string) => {
    setTimeout(() => entradas.current.get(id)?.focus(), 40);
  };

  const alterar = (id: string, mudanca: Partial<Bloco>) =>
    setBlocos((atuais) => atuais.map((bloco) => (bloco.id === id ? { ...bloco, ...mudanca } : bloco)));

  /* ----------------------------------------------------------- digitação */

  const aoTexto = (id: string, texto: string) => alterar(id, { texto });

  /**
   * Enter. Em lista, tarefa e numerada a linha nova continua do mesmo tipo —
   * escrever uma lista não deveria exigir escolher o tipo a cada item. Nos
   * demais a linha nova é texto comum: depois de um título vem parágrafo.
   *
   * Enter numa linha de lista vazia sai da lista em vez de criar mais um item
   * vazio, que é como todo editor se comporta e o que a pessoa espera.
   */
  const aoDividir = (id: string, antes: string, depois: string) => {
    const indice = blocos.findIndex((bloco) => bloco.id === id);
    if (indice < 0) return;

    const atual = blocos[indice];
    const eDeLista = atual.tipo === 'lista' || atual.tipo === 'numerada' || atual.tipo === 'tarefa';

    if (eDeLista && antes === '' && depois === '') {
      alterar(id, { tipo: 'texto', marcado: undefined });
      return;
    }

    const novo = criarBloco(eDeLista ? atual.tipo : 'texto', depois);
    const copia = [...blocos];
    copia[indice] = { ...atual, texto: antes };
    copia.splice(indice + 1, 0, novo);

    setBlocos(copia);
    focar(novo.id);
  };

  /**
   * Apagar com o cursor no começo, em três passos, do menos destrutivo ao mais:
   * primeiro tira a formatação, depois junta com a linha de cima, e só apaga a
   * linha quando ela está vazia. Assim ninguém perde texto sem querer.
   */
  const aoApagarNoInicio = (id: string) => {
    const indice = blocos.findIndex((bloco) => bloco.id === id);
    if (indice < 0) return;

    const atual = blocos[indice];

    if (atual.tipo !== 'texto') {
      alterar(id, { tipo: 'texto', marcado: undefined });
      return;
    }

    if (indice === 0) return;

    const anterior = blocos[indice - 1];

    // Não dá para juntar texto dentro de uma imagem ou de um gráfico. Nesse
    // caso a linha só some se estiver vazia; com texto, fica onde está.
    if (!ehDeTexto(anterior.tipo)) {
      if (atual.texto === '') {
        const restantes = blocos.filter((bloco) => bloco.id !== id);
        setBlocos(restantes.length > 0 ? restantes : [criarBloco('texto')]);
      }
      return;
    }

    const copia = [...blocos];
    copia[indice - 1] = { ...anterior, texto: anterior.texto + atual.texto };
    copia.splice(indice, 1);

    setBlocos(copia);
    focar(anterior.id);
  };

  const aoAlternarTarefa = (id: string) => {
    const bloco = blocos.find((item) => item.id === id);
    if (bloco) alterar(id, { marcado: !bloco.marcado });
  };

  /* -------------------------------------------------------------- blocos */

  const inserirDepoisDoAtivo = (tipo: TipoBloco) => {
    setInserirVisivel(false);

    const novo = criarBloco(tipo);
    setBlocos((atuais) => {
      const indice = ativo ? atuais.findIndex((bloco) => bloco.id === ativo) : atuais.length - 1;
      const copia = [...atuais];
      copia.splice(indice + 1, 0, novo);
      return copia;
    });

    if (ehDeTexto(tipo)) focar(novo.id);
    if (tipo === 'grafico') setGraficoEmEdicao(novo.id);
  };

  const mudarTipo = (id: string, tipo: TipoBloco) => {
    setMenuDoBloco(null);
    alterar(id, {
      tipo,
      marcado: tipo === 'tarefa' ? false : undefined,
      // Um bloco que vira tabela ou gráfico precisa nascer com a estrutura,
      // senão a tela desenharia uma tabela sem linhas.
      linhas: tipo === 'tabela' ? [['', ''], ['', '']] : undefined,
      grafico:
        tipo === 'grafico' ? { tipo: 'barra', titulo: '', dados: [{ rotulo: '', valor: 0 }] } : undefined,
    });
    if (ehDeTexto(tipo)) focar(id);
  };

  const mover = (id: string, passo: number) => {
    setMenuDoBloco(null);
    setBlocos((atuais) => {
      const indice = atuais.findIndex((bloco) => bloco.id === id);
      const destino = indice + passo;
      if (indice < 0 || destino < 0 || destino >= atuais.length) return atuais;

      const copia = [...atuais];
      [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
      return copia;
    });
  };

  const remover = (id: string) => {
    setMenuDoBloco(null);
    setBlocos((atuais) => {
      const restantes = atuais.filter((bloco) => bloco.id !== id);
      // A nota nunca fica sem nenhum bloco: sem um campo, não haveria onde
      // tocar para voltar a escrever.
      return restantes.length > 0 ? restantes : [criarBloco('texto')];
    });
  };

  /* ------------------------------------------------------------- tabela */

  const mudarCelula = (id: string, linha: number, coluna: number, valor: string) =>
    setBlocos((atuais) =>
      atuais.map((bloco) => {
        if (bloco.id !== id || !bloco.linhas) return bloco;
        const linhas = bloco.linhas.map((atual, indice) =>
          indice === linha ? atual.map((celula, j) => (j === coluna ? valor : celula)) : atual
        );
        return { ...bloco, linhas };
      })
    );

  const adicionarLinha = (id: string) =>
    setBlocos((atuais) =>
      atuais.map((bloco) => {
        if (bloco.id !== id || !bloco.linhas) return bloco;
        const colunas = bloco.linhas[0]?.length ?? 2;
        return { ...bloco, linhas: [...bloco.linhas, Array(colunas).fill('')] };
      })
    );

  const adicionarColuna = (id: string) =>
    setBlocos((atuais) =>
      atuais.map((bloco) => {
        if (bloco.id !== id || !bloco.linhas) return bloco;
        return { ...bloco, linhas: bloco.linhas.map((linha) => [...linha, '']) };
      })
    );

  /* ------------------------------------------------------------- imagem */

  const inserirImagem = async () => {
    setInserirVisivel(false);
    setErroDeEnvio(null);
    setEnviando(true);

    try {
      const imagem = await pickAndUploadImage();
      if (!imagem) return;

      const novo: Bloco = { ...criarBloco('imagem'), url: imagem.url, texto: imagem.alt };
      setBlocos((atuais) => {
        const indice = ativo ? atuais.findIndex((bloco) => bloco.id === ativo) : atuais.length - 1;
        const copia = [...atuais];
        copia.splice(indice + 1, 0, novo);
        return copia;
      });
    } catch (erro) {
      setErroDeEnvio(erro instanceof Error ? erro.message : 'Não consegui enviar a imagem.');
    } finally {
      setEnviando(false);
    }
  };

  /* ------------------------------------------------------------ desenho */

  const blocoDoMenu = blocos.find((bloco) => bloco.id === menuDoBloco) ?? null;
  const blocoDoGrafico = blocos.find((bloco) => bloco.id === graficoEmEdicao) ?? null;

  // A numeração é calculada aqui, e não dentro da linha, porque depende do que
  // veio antes — a linha sozinha não tem como saber a posição dela na sequência.
  let contador = 0;
  const numeros = blocos.map((bloco) => {
    if (bloco.tipo !== 'numerada') {
      contador = 0;
      return 0;
    }
    contador += 1;
    return contador;
  });

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {blocos.map((bloco, indice) =>
          ehDeTexto(bloco.tipo) ? (
            <BlockRow
              key={bloco.id}
              bloco={bloco}
              numero={numeros[indice]}
              autoFocus={autoFocus === true && indice === 0 && blocos.length === 1}
              onTexto={aoTexto}
              onDividir={aoDividir}
              onApagarNoInicio={aoApagarNoInicio}
              onAlternarTarefa={aoAlternarTarefa}
              onFocar={setAtivo}
              onAbrirMenu={setMenuDoBloco}
              registrarEntrada={(id, entrada) => entradas.current.set(id, entrada)}
            />
          ) : (
            <BlocoVisual
              key={bloco.id}
              bloco={bloco}
              larguraDisponivel={width}
              onAbrirMenu={setMenuDoBloco}
              onEditarGrafico={setGraficoEmEdicao}
              onMudarCelula={mudarCelula}
              onAdicionarLinha={adicionarLinha}
              onAdicionarColuna={adicionarColuna}
              onLegendaImagem={(id, legenda) => alterar(id, { texto: legenda })}
            />
          )
        )}

        {enviando ? (
          <View className="flex-row items-center gap-2 px-5 py-3">
            <ActivityIndicator size="small" color={tokens.accent} />
            <AppText variant="caption">Enviando imagem…</AppText>
          </View>
        ) : null}

        {erroDeEnvio ? (
          <AppText variant="caption" className="px-5 py-2 text-danger">
            {erroDeEnvio}
          </AppText>
        ) : null}
      </ScrollView>

      <BarraDeBlocos
        bottomInset={bottomInset}
        onInserir={() => setInserirVisivel(true)}
        onTipoRapido={(tipo) => (ativo ? mudarTipo(ativo, tipo) : inserirDepoisDoAtivo(tipo))}
        onImagem={() => void inserirImagem()}
        onPronto={onRequestDone}
      />

      <InserirBlocoSheet
        visible={inserirVisivel}
        onClose={() => setInserirVisivel(false)}
        onEscolher={inserirDepoisDoAtivo}
        onImagem={() => void inserirImagem()}
      />

      <BlocoMenuSheet
        visible={blocoDoMenu !== null}
        bloco={blocoDoMenu}
        onClose={() => setMenuDoBloco(null)}
        onMudarTipo={mudarTipo}
        onMover={mover}
        onRemover={remover}
      />

      <GraficoEditorSheet
        visible={blocoDoGrafico !== null}
        dados={blocoDoGrafico?.grafico ?? null}
        onClose={() => setGraficoEmEdicao(null)}
        onSalvar={(dados: DadosGrafico) => {
          if (graficoEmEdicao) alterar(graficoEmEdicao, { grafico: dados });
          setGraficoEmEdicao(null);
        }}
      />

    </View>
  );
}
