# 💳 Cartões & Faturas - Gestão Compartilhada DGTECH

Aplicativo Web & PWA de alta performance para gerenciar múltiplos cartões de crédito, upload de faturas em PDF via Gemini Pro, rastreamento automático de parcelas entre meses e conciliação por comprador com cobrança rápida via WhatsApp.

---

## 🚀 Funcionalidades Implementadas

1. **Menu Hambúrguer com Navegação Inteligente**:
   - Pré-carregado com os **16 cartões de crédito**: ATAKAREJO, ASSAÍ, SHOPEE, CASAS BAHIA, INTER PF, AMERICANAS, UNICLASS, CARREFOUR, INTER PJ, BRADESCO, LE BISCUIT, PAG SEGURO, NUBANK, ATACADÃO, BRASILCARD e MAIS.
   - Ordenação cronológica automática por dia de vencimento.
   - Exibição de Melhor Dia (fechamento), Limite e cores de identificação.

2. **Edição e Salvamento Completo (CRUD)**:
   - **Cartões**: alteração de nome, limite, vencimento, melhor dia, cor e exclusão.
   - **Compradores / Devedores**: cadastro, edição de WhatsApp e cores visuais.
   - **Faturas**: ajuste manual do valor total consolidado do banco e status (Aberta, Fechada, Paga).
   - **Lançamentos & Parcelas**: edição de descrição, valor, número da parcela (`X de Y`), comprador responsável ou exclusão.

3. **Fila de Triagem Rápida (Compras sem Dono)**:
   - Identifica todas as compras que ainda não possuem um comprador vinculado.
   - Atribuição com 1 clique.
   - **Memória de Parcelas**: ao atribuir o responsável em uma parcela, as parcelas dos meses seguintes herdará o mesmo dono automaticamente.

4. **Visão por Devedor & Cobrança WhatsApp**:
   - Cards dedicados para cada pessoa com gastos na fatura.
   - Botão **"Cobrança WhatsApp"**: gera mensagem formatada e abre o WhatsApp diretamente para envio.
   - Botão **"Ver Parcelas Futuras"**: projeta as parcelas restantes dos meses futuros daquele devedor.

5. **Upload de Fatura em PDF com Gemini Pro**:
   - Envio de fatura em PDF ou imagem.
   - Extração estruturada (data, loja, parcelamento e valor) com inteligência multimodal.

---

## 🛠️ Tecnologias

- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript
- **Estilização**: Tailwind CSS
- **Ícones**: Lucide Icons
- **Banco de Dados**: Supabase (PostgreSQL) com fallback para armazenamento local reativo
- **IA**: Google Gemini Pro (`@google/genai`) para extração multimodal de faturas
- **PWA**: Manifesto configurado para instalação no celular ou desktop

---

## ⚙️ Configuração do Ambiente

Crie o arquivo `.env.local` na raiz do projeto com base no arquivo `.env.example`:

```env
# Chaves do Supabase
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anonima-publica
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role-privada

# Chave da API Gemini Pro
GEMINI_API_KEY=sua-chave-gemini-pro
```

---

## 📦 Como Rodar Localmente

```bash
# Iniciar o servidor de desenvolvimento
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000) no seu navegador.
