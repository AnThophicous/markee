/**
 * Data e hora para a IA.
 *
 * Parece bobo, mas é a ferramenta que mais evita resposta errada: o modelo não
 * sabe que dia é hoje — ele responde com a data em que foi treinado. Num app de
 * estudo, cheio de "quantos dias faltam para a prova", isso erra sempre.
 */

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

function formatFull(date: Date): string {
  return `${DIAS[date.getDay()]}, ${date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })}`;
}

/** Aceita `dd/mm/aaaa` e `aaaa-mm-dd`. */
function parseDate(input: string): Date | null {
  const br = input.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));

  const iso = input.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  return null;
}

/**
 * Sem argumento devolve a data de hoje. Com uma data, devolve quantos dias
 * faltam (ou se passaram).
 */
export async function dateTool(argument: string): Promise<string> {
  const now = new Date();
  const today = `Hoje é ${formatFull(now)}, ${now.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}.`;

  const target = parseDate(argument);
  if (!target) return today;

  // Compara à meia-noite dos dois lados: senão "amanhã de manhã" vira 0 dias.
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((target.getTime() - startOfToday.getTime()) / 86_400_000);

  if (days === 0) return `${today} A data ${formatFull(target)} é HOJE.`;
  if (days === 1) return `${today} ${formatFull(target)} é amanhã (1 dia).`;
  if (days === -1) return `${today} ${formatFull(target)} foi ontem.`;
  if (days > 0) return `${today} Faltam ${days} dias para ${formatFull(target)}.`;
  return `${today} ${formatFull(target)} passou há ${Math.abs(days)} dias.`;
}
