-- ==============================================================================
-- SCHEMA DO SUPABASE: GESTÃO DE FATURAS E DEVEDORES DE CARTÕES DE CRÉDITO
-- ==============================================================================

-- 1. TABELA DE CARTÕES
CREATE TABLE IF NOT EXISTS public.cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    due_day INTEGER,
    best_day INTEGER,
    credit_limit NUMERIC(12, 2) DEFAULT 0,
    bank TEXT,
    color TEXT DEFAULT '#4F46E5',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABELA DE PESSOAS / DEVEDORES
CREATE TABLE IF NOT EXISTS public.people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    color TEXT DEFAULT '#10B981',
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
    total_bank_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'fechada', 'paga')),
    pdf_url TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (card_id, month, year)
);

-- 4. TABELA DE COMPRAS
CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
    person_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    purchase_date DATE,
    total_installments INTEGER NOT NULL DEFAULT 1,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. TABELA DE PARCELAS
CREATE TABLE IF NOT EXISTS public.installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
    person_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
    installment_number INTEGER NOT NULL DEFAULT 1,
    total_installments INTEGER NOT NULL DEFAULT 1,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- HABILITAR ROW LEVEL SECURITY (RLS) E POLÍTICAS DE ACESSO
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;

-- Políticas para permitir leitura e escrita pela aplicação (anon / authenticated)
DROP POLICY IF EXISTS "Permitir acesso completo a cards" ON public.cards;
CREATE POLICY "Permitir acesso completo a cards" ON public.cards FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acesso completo a people" ON public.people;
CREATE POLICY "Permitir acesso completo a people" ON public.people FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acesso completo a invoices" ON public.invoices;
CREATE POLICY "Permitir acesso completo a invoices" ON public.invoices FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acesso completo a purchases" ON public.purchases;
CREATE POLICY "Permitir acesso completo a purchases" ON public.purchases FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acesso completo a installments" ON public.installments;
CREATE POLICY "Permitir acesso completo a installments" ON public.installments FOR ALL USING (true) WITH CHECK (true);

-- ÍNDICES PARA ALTA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_invoices_card_period ON public.invoices(card_id, year, month);
CREATE INDEX IF NOT EXISTS idx_installments_invoice ON public.installments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_installments_person ON public.installments(person_id);
CREATE INDEX IF NOT EXISTS idx_purchases_card ON public.purchases(card_id);

-- CARGA DOS 16 CARTÕES INICIAIS
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
ON CONFLICT (name) DO NOTHING;
