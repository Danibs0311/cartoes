import { CreditCard, Person, Invoice, Purchase, Installment } from './types';

export const INITIAL_CARDS: CreditCard[] = [
  { id: '1', name: 'ATAKAREJO', due_day: 9, best_day: 27, credit_limit: 710, color: '#E11D48', is_active: true },
  { id: '2', name: 'ASSAÍ', due_day: 9, best_day: 2, credit_limit: null, color: '#EA580C', is_active: true },
  { id: '3', name: 'SHOPEE', due_day: 10, best_day: null, credit_limit: 4075, color: '#F97316', is_active: true },
  { id: '4', name: 'CASAS BAHIA', due_day: 10, best_day: 28, credit_limit: 330, color: '#2563EB', is_active: true },
  { id: '5', name: 'INTER PF', due_day: 12, best_day: 6, credit_limit: 4920, color: '#FF7A00', is_active: true },
  { id: '6', name: 'AMERICANAS', due_day: 15, best_day: 7, credit_limit: 200, color: '#DC2626', is_active: true },
  { id: '7', name: 'UNICLASS', due_day: 15, best_day: 8, credit_limit: null, color: '#D97706', is_active: true },
  { id: '8', name: 'CARREFOUR', due_day: 18, best_day: 12, credit_limit: 700, color: '#0284C7', is_active: true },
  { id: '9', name: 'INTER PJ', due_day: 18, best_day: 12, credit_limit: 2000, color: '#EA580C', is_active: true },
  { id: '10', name: 'BRADESCO', due_day: 20, best_day: 7, credit_limit: 584, color: '#B91C1C', is_active: true },
  { id: '11', name: 'LE BISCUIT', due_day: 20, best_day: 8, credit_limit: 480, color: '#BE185D', is_active: true },
  { id: '12', name: 'PAG SEGURO', due_day: 20, best_day: 14, credit_limit: 5200, color: '#059669', is_active: true },
  { id: '13', name: 'NUBANK', due_day: 20, best_day: 14, credit_limit: null, color: '#820AD1', is_active: true },
  { id: '14', name: 'ATACADÃO', due_day: 23, best_day: 17, credit_limit: 650, color: '#D97706', is_active: true },
  { id: '15', name: 'BRASILCARD', due_day: 28, best_day: null, credit_limit: 200, color: '#4338CA', is_active: true },
  { id: '16', name: 'MAIS', due_day: null, best_day: null, credit_limit: 500, color: '#475569', is_active: true },
];

export const INITIAL_PEOPLE: Person[] = [
  { id: 'p1', name: 'Titular (Meu)', phone: '', color: '#3B82F6', is_active: true, notes: 'Minhas despesas pessoais' },
  { id: 'p2', name: 'João', phone: '5571999990001', color: '#10B981', is_active: true },
  { id: 'p3', name: 'Maria', phone: '5571999990002', color: '#EC4899', is_active: true },
  { id: 'p4', name: 'Carlos', phone: '5571999990003', color: '#8B5CF6', is_active: true },
];

// Helper para formatar moeda brasileira BRL
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Helper para formatar números
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '0,00';
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Calcula a data de corte / fechamento da fatura com base no Melhor Dia de Compras
 */
export function getInvoiceClosingDate(card: CreditCard, month: number, year: number): Date {
  const dueDay = card.due_day || 10;
  const bestDay = card.best_day !== null && card.best_day !== undefined
    ? card.best_day
    : (dueDay > 7 ? dueDay - 7 : 1);

  // Se o melhor dia é estritamente maior que o vencimento (ex: vencimento dia 09 e fechamento dia 27 do mês anterior):
  if (card.best_day && card.best_day > dueDay) {
    // Fechamento no mês anterior (mês - 2 no Date do JS)
    return new Date(year, month - 2, bestDay, 23, 59, 59, 999);
  }

  // Fechamento no mesmo mês de vencimento (mês - 1 no Date do JS)
  return new Date(year, month - 1, bestDay, 23, 59, 59, 999);
}

/**
 * Determina o status da fatura: 'aberta' ou 'fechada' baseado no Melhor Dia de Compras
 */
export function calculateInvoiceStatus(
  card: CreditCard,
  month: number,
  year: number,
  existingStatus?: 'aberta' | 'fechada' | 'paga'
): 'aberta' | 'fechada' | 'paga' {
  // Se o usuário marcou manualmente como paga, preserva 'paga'
  if (existingStatus === 'paga') {
    return 'paga';
  }

  const closingDate = getInvoiceClosingDate(card, month, year);
  const now = new Date();

  return now >= closingDate ? 'fechada' : 'aberta';
}
