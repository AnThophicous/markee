import type { Feather } from '@expo/vector-icons';

export type NoteTemplate = {
  id: string;
  label: string;
  hint: string;
  icon: keyof typeof Feather.glyphMap;
  title: (date: Date) => string;
  content: string;
};

function dayLabel(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
}

/**
 * Modelos de nota. Nenhum deles é obrigatório: o botão + continua abrindo uma
 * nota em branco na hora — a promessa de escrever e fechar em 10 segundos vale
 * mais do que qualquer estrutura pronta.
 */
export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: 'lecture',
    label: 'Anotação de aula',
    hint: 'Tópicos, dúvidas e o que revisar',
    icon: 'book-open',
    title: (date) => `Aula — ${dayLabel(date)}`,
    content: [
      '## Assunto',
      '',
      '',
      '## Pontos principais',
      '',
      '- ',
      '',
      '## Dúvidas',
      '',
      '- [ ] ',
      '',
      '## Revisar',
      '',
      '- [ ] ',
      '',
    ].join('\n'),
  },
  {
    id: 'summary',
    label: 'Resumo de matéria',
    hint: 'Conceito, exemplo e pegadinha',
    icon: 'align-left',
    title: () => 'Resumo',
    content: [
      '## Conceito',
      '',
      '',
      '## Como cai na prova',
      '',
      '',
      '## Exemplo',
      '',
      '```',
      '',
      '```',
      '',
      '## Pega-ratão',
      '',
      '> ',
      '',
    ].join('\n'),
  },
  {
    id: 'checklist',
    label: 'Lista de tarefas',
    hint: 'Só caixinhas para marcar',
    icon: 'check-square',
    title: (date) => `Tarefas — ${dayLabel(date)}`,
    content: ['- [ ] ', '- [ ] ', '- [ ] ', ''].join('\n'),
  },
  {
    id: 'exam',
    label: 'Plano de prova',
    hint: 'Data, conteúdo e cronograma',
    icon: 'calendar',
    title: () => 'Plano de prova',
    content: [
      '## Data',
      '',
      '',
      '## Conteúdo cobrado',
      '',
      '- [ ] ',
      '',
      '## Cronograma',
      '',
      '| Dia | O que estudar | Feito |',
      '| --- | --- | --- |',
      '|  |  |  |',
      '',
      '## Material',
      '',
      '- ',
      '',
    ].join('\n'),
  },
  {
    id: 'code',
    label: 'Trecho de código',
    hint: 'Problema, solução e explicação',
    icon: 'code',
    title: () => 'Snippet',
    content: ['## Problema', '', '', '## Solução', '', '```', '', '```', '', '## Por que funciona', '', ''].join('\n'),
  },
  {
    id: 'meeting',
    label: 'Reunião do grupo',
    hint: 'Presentes, decisões e próximos passos',
    icon: 'users',
    title: (date) => `Reunião — ${dayLabel(date)}`,
    content: [
      '## Presentes',
      '',
      '- ',
      '',
      '## Decisões',
      '',
      '- ',
      '',
      '## Próximos passos',
      '',
      '- [ ] ',
      '',
    ].join('\n'),
  },
];
