-- ==============================================================================
-- SCHEMA DO SUPABASE: GESTÃO DE FATURAS E DEVEDORES DE CARTÕES DE CRÉDITO
-- ==============================================================================

-- 1. TABELA DE CARTÕES
CREATE TABLE IF NOT EXISTS public.cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    due_day INTEGER, -- Dia de Vencimento
    best_day INTEGER, -- Melhor Dia para compra (Fechamento)
    credit_limit NUMERIC(12, 2) DEFAULT 0, -- Limite do cartão
    bank TEXT,
    color TEXT DEFAULT '#4F46E5', -- Cor temática para o menu
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABELA DE PESSOAS / DEVEDORES
CREATE TABLE IF NOT EXISTS public.people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT, -- WhatsApp para envio da cobrança
    color TEXT DEFAULT '#10B981', -- Cor visual para identificação nos cards
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABELA DE FATURAS MENSAIS POR CARTÃO
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL CHECK (year >= 2020),
    due_date DATE,
    total_bank_amount NUMERIC(12, 2) NOT NULL DEFAULT 0, -- Valor total da fatura segundo o banco
    status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'fechada', 'paga')),
    pdf_url TEXT, -- Arquivo no Supabase Storage se houver
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (card_id, month, year)
);

-- 4. TABELA DE COMPRAS (COMPRA ORIGINAL E METADADOS)
CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
    person_id UUID REFERENCES public.people(id) ON DELETE SET NULL, -- Nulo = pendente de identificação
    description TEXT NOT NULL, -- Ex: "AMAZON BRASIL", "MERCADO LIVRE"
    purchase_date DATE,
    total_installments INTEGER NOT NULL DEFAULT 1, -- Quantidade total de parcelas (ex: 10)
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. TABELA DE PARCELAS INDIVIDUAIS POR FATURA
CREATE TABLE IF NOT EXISTS public.installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
    person_id UUID REFERENCES public.people(id) ON DELETE SET NULL, -- Dono da parcela no mês
    installment_number INTEGER NOT NULL DEFAULT 1, -- Parcela atual (ex: 3)
    total_installments INTEGER NOT NULL DEFAULT 1, -- Total de parcelas (ex: 10)
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0, -- Valor desta parcela
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ÍNDICES PARA BUSCA RÁPIDA E AUTOMATCH DE PRÓXIMAS PARCELAS
CREATE INDEX IF NOT EXISTS idx_invoices_card_period ON public.invoices(card_id, year, month);
CREATE INDEX IF NOT EXISTS idx_installments_invoice ON public.installments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_installments_person ON public.installments(person_id);
CREATE INDEX IF NOT EXISTS idx_purchases_card ON public.purchases(card_id);

-- ==============================================================================
-- CARGA INICIAL: OS 16 CARTÕES FORNECIDOS PELO USUÁRIO
-- ==============================================================================
INSERT INTO public.cards (name, due_day, best_day, credit_limit, color) VALUES
('ATAKAREJO', 9, 27, 710.00, '#E11D48'),
('ASSAÍ', 9, 2, NULL, '#EA580C'),
('SHOPEE', 10, NULL, 4075.00, '#F97316'),
('CASAS BAHIA', 10, 28, 330.00, '#2563EB'),
('INTER PF', 12, 6, 4920.00, '#FF7A00'),
('AMERICANAS', 15, 7, 200.00, '#DC2626'),
('UNICLASS', 15, 8, NULL, '#D97706'),
('CARREFOUR', 18, 12, 700.00, '#0284C7'),
('INTER PJ', 18, 12, 2000.00, '#EA580C'),
('BRADESCO', 20, 7, 584.00, '#B91C1C'),
('LE BISCUIT', 20, 8, 480.00, '#BE185D'),
('PAG SEGURO', 20, 14, 5200.00, '#059669'),
('NUBANK', 20, 14, NULL, '#820AD1'),
('ATACADÃO', 23, 17, 650.00, '#D97706'),
('BRASILCARD', 28, NULL, 200.00, '#4338CA'),
('MAIS', NULL, NULL, 500.00, '#475569')
ON CONFLICT DO NOTHING;
