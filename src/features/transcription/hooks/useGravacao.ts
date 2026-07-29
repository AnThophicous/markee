import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Paths } from 'expo-file-system';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';

import { registrarGravacao } from '@/features/stats/services/study-days.service';
import { avisar } from '@/services/avisos';

import {
  AUDIO_DE_FALA,
  SEGUNDOS_POR_PEDACO,
  montarTexto,
  pistaPara,
  progressoDe,
  proximoParaEnviar,
  segundosQueCabem,
  type Pedaco,
} from '../gravacao';
import { transcreverSegmento } from '../services/transcription.service';

export type EstadoDaGravacao = 'parado' | 'gravando' | 'pausado' | 'terminando' | 'pronto';

/**
 * A máquina da gravação de aula.
 *
 * Grava, corta em pedaços de dois minutos e vai transcrevendo enquanto a aula
 * acontece. Quando o professor termina, quase tudo já está pronto.
 *
 * TRÊS COISAS QUE ELA GARANTE, e que são o motivo de não ser um `useState` na
 * tela:
 *
 *   1. O ÁUDIO NÃO SE PERDE. O arquivo de cada pedaço fica no disco até a
 *      transcrição dele voltar. Falha de rede no meio da aula não custa o
 *      trecho — ele volta para a fila e tenta de novo.
 *   2. A FILA É UMA SÓ, EM ORDEM. Um pedaço por vez, porque a pista do próximo
 *      são as últimas palavras do anterior. Em paralelo seria mais rápido e a
 *      transcrição sairia com o mesmo nome próprio escrito de três jeitos.
 *   3. O CRONÔMETRO NÃO DERIVA. Ele soma relógio de parede, não tiques. Um
 *      contador de tiques atrasa alguns milissegundos por segundo, e ao longo
 *      de cinquenta minutos isso vira meio minuto de diferença entre o que a
 *      tela mostra e o que foi gravado — além de cortar os pedaços fora do
 *      lugar.
 */
export function useGravacao() {
  const gravador = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, ...AUDIO_DE_FALA });

  const [estado, setEstado] = useState<EstadoDaGravacao>('parado');
  const [segundos, setSegundos] = useState(0);
  const [pedacos, setPedacos] = useState<Pedaco[]>([]);
  const [teto, setTeto] = useState(Infinity);

  // Refs porque o cronômetro roda fora do ciclo de render: ler estado de dentro
  // do intervalo pegaria o valor congelado no fechamento.
  const proximoIndice = useRef(0);
  const enviando = useRef(false);
  const gravandoRef = useRef(false);
  const segundosRef = useRef(0);
  /** Segundos já acumulados antes do trecho atual (o que passou antes da pausa). */
  const acumulado = useRef(0);
  /** Quando o trecho atual começou, em relógio de parede. */
  const inicio = useRef(0);
  const tetoRef = useRef(Infinity);

  /* ------------------------------------------------------------ a fila */

  /**
   * Manda UM pedaço, o próximo da ordem.
   *
   * Recebe a lista por parâmetro em vez de ler o estado. Ler de dentro de um
   * atualizador do `setPedacos` funcionaria e é armadilha: o React pode rodar o
   * atualizador duas vezes, e um efeito colateral ali dentro mandaria o mesmo
   * pedaço duas vezes — dois créditos gastos pelo mesmo áudio.
   */
  const bombear = useCallback(async (atuais: Pedaco[]) => {
    if (enviando.current) return;
    const alvo = proximoParaEnviar(atuais);
    if (!alvo) return;

    enviando.current = true;
    const pista = pistaPara(atuais, alvo.indice);
    setPedacos((ps) => ps.map((p) => (p.indice === alvo.indice ? { ...p, estado: 'enviando' } : p)));

    try {
      const { texto } = await transcreverSegmento(alvo.uri, pista);
      setPedacos((ps) =>
        ps.map((p) => (p.indice === alvo.indice ? { ...p, estado: 'pronto', texto: texto.trim() } : p))
      );
    } catch (erro) {
      setPedacos((ps) =>
        ps.map((p) => {
          if (p.indice !== alvo.indice) return p;
          const tentativas = p.tentativas + 1;
          // Três tentativas e desiste. O trecho vira uma marca visível no texto
          // final — costurar como se nada tivesse faltado faria a pessoa
          // estudar por uma nota com buraco sem saber que ele existe.
          return { ...p, tentativas, estado: tentativas >= 3 ? 'falhou' : 'esperando' };
        })
      );
      if (erro instanceof Error && /cr[ée]dito/i.test(erro.message)) avisar(erro.message, 'erro');
    } finally {
      enviando.current = false;
    }
  }, []);

  // Cada mudança na lista acorda a fila. Um intervalo daria no mesmo e
  // continuaria acordando de minuto em minuto depois que a aula acabou.
  useEffect(() => {
    if (pedacos.some((p) => p.estado === 'esperando')) void bombear(pedacos);
  }, [pedacos, bombear]);

  /* --------------------------------------------------------- o cortador */

  const fecharPedaco = useCallback(
    async (duracao: number) => {
      await gravador.stop();
      const uri = gravador.uri;
      const meu = proximoIndice.current;
      proximoIndice.current += 1;

      if (uri) {
        setPedacos((atuais) => [
          ...atuais,
          { indice: meu, uri, segundos: duracao, estado: 'esperando', texto: '', tentativas: 0 },
        ]);
      }
    },
    [gravador]
  );

  /* ------------------------------------------------------------ comandos */

  const terminar = useCallback(async () => {
    if (!gravandoRef.current && estado !== 'pausado') return;
    gravandoRef.current = false;
    setEstado('terminando');

    const sobra = segundosRef.current - proximoIndice.current * SEGUNDOS_POR_PEDACO;
    // Menos de três segundos de sobra não vale um pedaço: a transcrição de um
    // resto assim volta vazia ou com meia palavra, e ainda custa um crédito.
    if (sobra >= 3) await fecharPedaco(sobra);
    else await gravador.stop().catch(() => undefined);

    await setAudioModeAsync({ allowsRecording: false });
    if (segundosRef.current > 0) await registrarGravacao(segundosRef.current / 60);
    setEstado('pronto');
  }, [estado, fecharPedaco, gravador]);

  const comecar = useCallback(async () => {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      avisar('Sem permissão do microfone não dá para gravar a aula.', 'erro');
      return false;
    }

    const livres = Paths.availableDiskSpace;
    const cabe = livres > 0 ? segundosQueCabem(livres) : Infinity;
    if (cabe < 60) {
      avisar('Não há espaço no aparelho para gravar. Libere um pouco e tente de novo.', 'erro');
      return false;
    }

    // `playsInSilentMode` para a gravação não morrer com o telefone no
    // silencioso, que é como ele fica dentro da sala de aula.
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

    setTeto(cabe);
    tetoRef.current = cabe;
    proximoIndice.current = 0;
    acumulado.current = 0;
    segundosRef.current = 0;
    inicio.current = Date.now();
    setPedacos([]);
    setSegundos(0);
    gravador.record();
    gravandoRef.current = true;
    setEstado('gravando');
    return true;
  }, [gravador]);

  const pausar = useCallback(() => {
    gravador.pause();
    acumulado.current += (Date.now() - inicio.current) / 1000;
    gravandoRef.current = false;
    setEstado('pausado');
  }, [gravador]);

  const retomar = useCallback(() => {
    inicio.current = Date.now();
    gravador.record();
    gravandoRef.current = true;
    setEstado('gravando');
  }, [gravador]);

  /* --------------------------------------------------------- cronômetro */

  useEffect(() => {
    if (estado !== 'gravando') return;

    const tique = setInterval(() => {
      const decorridos = acumulado.current + (Date.now() - inicio.current) / 1000;
      segundosRef.current = decorridos;
      setSegundos(Math.floor(decorridos));

      if (decorridos >= tetoRef.current) {
        avisar('O espaço no aparelho acabou. Parei a gravação e vou terminar de transcrever.', 'erro');
        void terminar();
        return;
      }

      // Quantos pedaços JÁ deveriam ter sido fechados a esta altura. Comparar
      // com o índice em vez de testar `decorridos % 120 === 0` é o que
      // sobrevive a um tique perdido — e tique se perde quando o sistema
      // aperta, que é justo quando não se pode perder o corte.
      const devidos = Math.floor(decorridos / SEGUNDOS_POR_PEDACO);
      if (devidos > proximoIndice.current && gravandoRef.current) {
        void (async () => {
          await fecharPedaco(SEGUNDOS_POR_PEDACO);
          if (gravandoRef.current) gravador.record();
        })();
      }
    }, 1000);

    return () => clearInterval(tique);
  }, [estado, fecharPedaco, gravador, terminar]);

  /* ------------------------------------ o app indo para o segundo plano */

  useEffect(() => {
    const inscricao = AppState.addEventListener('change', (proximo) => {
      // Nada de parar a gravação aqui: o telefone na mochila com a tela apagada
      // é o caso NORMAL de uma aula, e parar seria perder a aula inteira. O
      // efeito existe só para o pedaço em andamento fechar quando o sistema
      // ameaça encerrar o app — assim ele vai para a fila em vez de sumir com
      // o processo.
      if (proximo !== 'background' || !gravandoRef.current) return;

      const sobra = segundosRef.current - proximoIndice.current * SEGUNDOS_POR_PEDACO;
      if (sobra < 10) return;

      void (async () => {
        await fecharPedaco(sobra);
        if (gravandoRef.current) gravador.record();
      })();
    });
    return () => inscricao.remove();
  }, [fecharPedaco, gravador]);

  const tentarDeNovo = useCallback(() => {
    setPedacos((atuais) =>
      atuais.map((p) => (p.estado === 'falhou' ? { ...p, estado: 'esperando', tentativas: 0 } : p))
    );
  }, []);

  return {
    estado,
    segundos,
    pedacos,
    teto,
    progresso: progressoDe(pedacos),
    texto: montarTexto(pedacos),
    comecar,
    pausar,
    retomar,
    terminar,
    tentarDeNovo,
  };
}
