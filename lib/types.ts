export interface CreditCard {
  id: string;
  name: string;
  due_day: number | null;
  best_day: number | null;
  credit_limit: number | null;
  bank?: string;
  color: string;
  is_active: boolean;
}

export interface Person {
  id: string;
  name: string;
  phone?: string;
  color: string;
  notes?: string;
  is_active: boolean;
}

export interface Invoice {
  id: string;
  card_id: string;
  month: number;
  year: number;
  due_date?: string;
  total_bank_amount: number;
  status: 'aberta' | 'fechada' | 'paga';
  pdf_url?: string;
  notes?: string;
}

export interface Purchase {
  id: string;
  card_id: string;
  person_id?: string | null;
  description: string;
  purchase_date?: string;
  total_installments: number;
  total_amount: number;
}

export interface Installment {
  id: string;
  invoice_id: string;
  purchase_id: string;
  person_id?: string | null;
  installment_number: number;
  total_installments: number;
  amount: number;
  status: 'pendente' | 'pago';
  notes?: string;
  // Joined fields for display
  description?: string;
  purchase_date?: string;
}

export interface ExtractedInvoiceData {
  card_name?: string;
  due_date?: string;
  total_amount?: number;
  month?: number;
  year?: number;
  items: Array<{
    date?: string;
    description: string;
    current_installment: number;
    total_installments: number;
    amount: number;
  }>;
}
