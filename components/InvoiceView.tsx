'use client';

import React, { useState } from 'react';
import { CreditCard, Person, Invoice, Installment, ExtractedInvoiceData } from '@/lib/types';
import {
  Menu,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  UploadCloud,
  Plus,
  Edit2,
  Trash2,
  Share2,
  Scissors,
  AlertTriangle,
  CheckCircle,
  Calendar,
  CreditCard as CardIcon,
  User,
  Users,
  UserMinus,
  RotateCcw,
  Clock,
  ExternalLink,
  MessageCircle,
  Search,
  X,
} from 'lucide-react';
import { formatCurrency } from '@/lib/storage';

interface InvoiceViewProps {
  card: CreditCard;
  people: Person[];
  invoice: Invoice;
  installments: Installment[];
  allInstallments: Installment[]; // Para projeções futuras
  onToggleMobileMenu: () => void;
  onOpenEditCard: (card: CreditCard) => void;
  onOpenUpload: () => void;
  onOpenNewInstallment: () => void;
  onOpenEditInstallment: (inst: Installment) => void;
  onDeleteInstallment: (id: string) => void;
  onAssignDebtor: (installmentId: string, personId: string) => void;
  onUpdateInvoiceTotal: (newTotal: number) => void;
  onChangeMonth: (delta: number) => void;
  onOpenManagePeople: () => void;
  onOpenNewPerson: () => void;
  onEditPerson: (person: Person) => void;
  onOpenSplitInstallment: (inst: Installment) => void;
  deletedInstallments?: Installment[];
  onRestoreInstallment?: (id: string) => void;
  onUnassignDebtor?: (installmentId: string) => void;
  duplicateCount?: number;
  onCleanDuplicates?: () => void;
  onClearInvoicePurchases?: () => void;
  onUpdateInvoiceStatus?: (newStatus: 'aberta' | 'fechada' | 'paga') => void;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function InvoiceView({
  card,
  people,
  invoice,
  installments,
  allInstallments,
  onToggleMobileMenu,
  onOpenEditCard,
  onOpenUpload,
  onOpenNewInstallment,
  onOpenEditInstallment,
  onDeleteInstallment,
  onAssignDebtor,
  onUpdateInvoiceTotal,
  onChangeMonth,
  onOpenManagePeople,
  onOpenNewPerson,
  onEditPerson,
  onOpenSplitInstallment,
  deletedInstallments = [],
  onRestoreInstallment,
  onUnassignDebtor,
  duplicateCount = 0,
  onCleanDuplicates,
  onClearInvoicePurchases,
  onUpdateInvoiceStatus,
}: InvoiceViewProps) {
  const [editingTotal, setEditingTotal] = useState(false);
  const [tempTotal, setTempTotal] = useState(String(invoice.total_bank_amount));
  const [selectedPersonFuture, setSelectedPersonFuture] = useState<Person | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  // Controla qual pessoa está expandida (preserva ao recarregar a tela no celular)
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('dgtech_expanded_person') || null;
    }
    return null;
  });
  // Estado de Busca rápida na fatura
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleExpandPerson = (personId: string) => {
    setExpandedPersonId((prev) => {
      const next = prev === personId ? null : personId;
      if (typeof window !== 'undefined') {
        if (next) {
          localStorage.setItem('dgtech_expanded_person', next);
        } else {
          localStorage.removeItem('dgtech_expanded_person');
        }
      }
      return next;
    });
  };

  // Filtro de busca na fatura (loja, valor, data, parcela ou nome de pessoa)
  const filterItem = (item: Installment, personName = '') => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    const qAmount = q.replace(',', '.');

    const descMatch = (item.description || '').toLowerCase().includes(q);
    const amountMatch =
      item.amount.toFixed(2).includes(qAmount) ||
      formatCurrency(item.amount).toLowerCase().includes(q);
    const dateMatch = (item.purchase_date || '').includes(q);
    const notesMatch = (item.notes || '').toLowerCase().includes(q);
    const personMatch = personName ? personName.toLowerCase().includes(q) : false;

    return descMatch || amountMatch || dateMatch || notesMatch || personMatch;
  };

  // 1. Agrupamento Unificado por Pessoa (mescla múltiplos cadastros com o mesmo nome)
  const personMapByName = new Map<string, { person: Person; allIds: Set<string> }>();

  people.forEach((p) => {
    const normalizedName = p.name.trim().toLowerCase();
    if (!personMapByName.has(normalizedName)) {
      personMapByName.set(normalizedName, {
        person: p,
        allIds: new Set([p.id]),
      });
    } else {
      personMapByName.get(normalizedName)!.allIds.add(p.id);
    }
  });

  const groupedByPerson: Array<{ person: Person; items: Installment[]; total: number }> = [];
  const allKnownPersonIds = new Set<string>();

  personMapByName.forEach(({ person, allIds }) => {
    allIds.forEach((id) => allKnownPersonIds.add(id));
    const rawItems = installments.filter((i) => i.person_id && allIds.has(i.person_id));
    const personItems = rawItems.filter((i) => filterItem(i, person.name));
    if (personItems.length > 0) {
      const total = personItems.reduce((sum, i) => sum + i.amount, 0);
      groupedByPerson.push({
        person,
        items: personItems,
        total,
      });
    }
  });

  // Qualquer compra que não tenha dono ou cujo person_id não pertença a ninguém vai para a Fila de Triagem!
  const unassignedItems = installments.filter(
    (i) => (!i.person_id || !allKnownPersonIds.has(i.person_id)) && filterItem(i)
  );
  const totalUnassigned = unassignedItems.reduce((sum, i) => sum + i.amount, 0);
  const totalAssigned = groupedByPerson.reduce((sum, g) => sum + g.total, 0);

  // Total de compras que bateram com a pesquisa
  const totalFoundMatches =
    groupedByPerson.reduce((sum, g) => sum + g.items.length, 0) + unassignedItems.length;

  // Compras excluídas desta fatura
  const currentInvoiceDeleted = deletedInstallments.filter((d) => d.invoice_id === invoice.id);

  const handleSaveTotal = () => {
    const num = parseFloat(tempTotal.replace(',', '.'));
    if (!isNaN(num)) {
      onUpdateInvoiceTotal(num);
    }
    setEditingTotal(false);
  };

  // Gerar mensagem de cobrança para WhatsApp
  const handleCopyWhatsApp = (group: { person: Person; items: Installment[]; total: number }) => {
    const monthName = MONTH_NAMES[invoice.month - 1];
    let msg = `Olá *${group.person.name}*, segue o resumo da sua parte no cartão *${card.name}* (Fatura de ${monthName}/${invoice.year}):\n\n`;

    group.items.forEach((item) => {
      const parc = item.total_installments > 1 ? ` (${item.installment_number}/${item.total_installments})` : '';
      msg += `• ${item.description || 'Compra'}${parc}: *${formatCurrency(item.amount)}*\n`;
    });

    msg += `\n💰 *Total a pagar:* ${formatCurrency(group.total)}`;
    if (card.due_day) {
      msg += `\n📅 *Vencimento:* Dia ${card.due_day.toString().padStart(2, '0')}/${invoice.month.toString().padStart(2, '0')}`;
    }

    navigator.clipboard.writeText(msg);
    alert(`Mensagem para ${group.person.name} copiada para a área de transferência!`);

    if (group.person.phone) {
      const url = `https://wa.me/${group.person.phone}?text=${encodeURIComponent(msg)}`;
      window.open(url, '_blank');
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-950 overflow-y-auto">
      {/* Barra Superior / Header */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMobileMenu}
            className="p-2 -ml-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 lg:hidden"
            aria-label="Abrir Menu Hambúrguer"
          >
            <Menu size={22} />
          </button>

          <div className="flex items-center gap-2.5">
            <span
              className="w-3.5 h-3.5 rounded-full ring-2 ring-slate-700"
              style={{ backgroundColor: card.color || '#4F46E5' }}
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  {card.name}
                </h1>
                <button
                  onClick={() => onOpenEditCard(card)}
                  className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                  title="Editar dados do cartão"
                >
                  <Edit2 size={14} />
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Vencimento: Dia {card.due_day ? card.due_day.toString().padStart(2, '0') : '—'}</span>
                <span>•</span>
                <span>Melhor Dia: {card.best_day ? `Dia ${card.best_day}` : '—'}</span>
                <span>•</span>
                <span>Limite: {card.credit_limit ? formatCurrency(card.credit_limit) : '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Ações principais */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenManagePeople}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-medium rounded-xl border border-slate-700 flex items-center gap-1.5 transition"
            title="Gerenciar lista de devedores"
          >
            <Users size={16} className="text-emerald-400" />
            <span className="hidden sm:inline">Devedores</span>
            <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 text-[10px] font-bold rounded-md">
              {people.length}
            </span>
          </button>
          <button
            onClick={onOpenNewInstallment}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-medium rounded-xl border border-slate-700 flex items-center gap-1.5 transition"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Lançamento</span> Manual
          </button>
          <button
            onClick={onOpenUpload}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-medium rounded-xl flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition"
          >
            <UploadCloud size={16} />
            <span className="hidden sm:inline">Upload</span> Fatura (PDF)
          </button>
          {/* Botão de Procura no Cartão */}
          <button
            onClick={() => setIsSearching(!isSearching)}
            className={`px-3 py-1.5 rounded-xl border text-xs sm:text-sm font-medium flex items-center gap-1.5 transition ${
              isSearching || searchQuery
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title="Procurar compras, valores ou pessoas neste cartão"
          >
            <Search size={15} className={isSearching || searchQuery ? 'text-white' : 'text-indigo-400'} />
            <span className="hidden sm:inline">Procurar</span>
            {searchQuery && (
              <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.2 rounded-md font-bold">
                {totalFoundMatches}
              </span>
            )}
          </button>
          {installments.length > 0 && onClearInvoicePurchases && (
            <button
              onClick={onClearInvoicePurchases}
              className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-white border border-rose-500/30 text-xs sm:text-sm font-medium rounded-xl flex items-center gap-1.5 transition"
              title="Apagar todas as compras identificadas desta fatura"
            >
              <Trash2 size={15} className="text-rose-400" />
              <span className="hidden md:inline">Limpar Compras</span> ({installments.length})
            </button>
          )}
        </div>
      </header>

      {/* Barra de Procura Retrátil */}
      {isSearching && (
        <div className="bg-slate-900 border-b border-indigo-500/30 px-4 sm:px-8 py-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-150 sticky top-[61px] z-25 backdrop-blur-md">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-3 text-indigo-400" />
            <input
              type="text"
              placeholder="Digite o nome da loja, valor (ex: 30,37 ou 30.37), parcela ou comprador..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-750 focus:border-indigo-500 rounded-xl pl-10 pr-9 py-2 text-sm text-white placeholder-slate-400 focus:outline-none transition shadow-inner"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-white transition p-0.5 rounded-md"
                title="Limpar texto"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <button
            onClick={() => {
              setIsSearching(false);
              setSearchQuery('');
            }}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-xl border border-slate-700 transition"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Conteúdo Principal */}
      <main className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* Seletor Mês a Mês */}
        <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:px-6 shadow-sm">
          <button
            onClick={() => onChangeMonth(-1)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 text-xs sm:text-sm font-medium"
          >
            <ChevronLeft size={18} />
            <span className="hidden sm:inline">Mês Anterior</span>
          </button>

          <div className="flex items-center gap-2 text-center">
            <Calendar size={18} className="text-indigo-400 hidden sm:block" />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white capitalize">
                {MONTH_NAMES[invoice.month - 1]} {invoice.year}
              </h2>
              <div className="flex flex-col items-center gap-0.5 mt-0.5">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      if (!onUpdateInvoiceStatus) return;
                      const next =
                        invoice.status === 'aberta'
                          ? 'fechada'
                          : invoice.status === 'fechada'
                          ? 'paga'
                          : 'aberta';
                      onUpdateInvoiceStatus(next);
                    }}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase transition flex items-center gap-1.5 cursor-pointer ${
                      invoice.status === 'fechada'
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25'
                        : invoice.status === 'paga'
                        ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30 hover:bg-blue-500/25'
                        : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
                    }`}
                    title="Status baseado no Melhor Dia de Compras. Clique para alternar manualmente (Aberta / Fechada / Paga)"
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        invoice.status === 'fechada'
                          ? 'bg-amber-400 animate-pulse'
                          : invoice.status === 'paga'
                          ? 'bg-blue-400'
                          : 'bg-emerald-400'
                      }`}
                    />
                    Fatura {invoice.status}
                  </button>
                </div>

                <p className="text-[10px] text-slate-400">
                  {card.best_day ? (
                    invoice.status === 'fechada' ? (
                      <span className="text-amber-300/80">Fechou no Melhor Dia ({card.best_day.toString().padStart(2, '0')}/{invoice.month.toString().padStart(2, '0')})</span>
                    ) : (
                      <span className="text-slate-400">Fecha no Melhor Dia ({card.best_day.toString().padStart(2, '0')}/{invoice.month.toString().padStart(2, '0')})</span>
                    )
                  ) : (
                    <span>Melhor dia de compras não definido</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => onChangeMonth(1)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 text-xs sm:text-sm font-medium"
          >
            <span className="hidden sm:inline">Próximo Mês</span>
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Banner de Resultado de Busca */}
        {searchQuery.trim() && (
          <div className="bg-indigo-950/40 border border-indigo-500/40 p-3.5 rounded-2xl flex items-center justify-between gap-3 text-indigo-200 text-xs sm:text-sm animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <Search size={17} className="text-indigo-400 shrink-0" />
              <span>
                Filtrando compras por <strong>&ldquo;{searchQuery}&rdquo;</strong> &bull; Encontradas: <strong>{totalFoundMatches} {totalFoundMatches === 1 ? 'compra' : 'compras'}</strong>
              </span>
            </div>
            <button
              onClick={() => setSearchQuery('')}
              className="px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
            >
              <X size={13} /> Limpar filtro
            </button>
          </div>
        )}

        {searchQuery.trim() && totalFoundMatches === 0 && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center space-y-2">
            <Search size={32} className="mx-auto text-slate-600" />
            <p className="text-white font-semibold text-sm">
              Nenhuma compra encontrada para &ldquo;{searchQuery}&rdquo;
            </p>
            <p className="text-slate-400 text-xs max-w-md mx-auto">
              Verifique se digitou o valor ou nome correto. Exemplos de busca: &quot;30,37&quot;, &quot;uber&quot;, &quot;farmacia&quot;, &quot;1/5&quot;.
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl inline-flex items-center gap-1"
            >
              <X size={14} /> Limpar busca
            </button>
          </div>
        )}

        {/* Banner de Duplicados Detectados */}
        {duplicateCount > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-200 animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-amber-400 shrink-0" size={24} />
              <div>
                <h4 className="font-bold text-amber-200 text-sm">
                  {duplicateCount} {duplicateCount === 1 ? 'compra duplicada detectada' : 'compras duplicadas detectadas'} nesta fatura!
                </h4>
                <p className="text-xs text-amber-300/80 mt-0.5">
                  Lançamentos repetidos elevaram a fatura e a dívida dos compradores. Clique ao lado para manter apenas 1 cópia de cada e restaurar os totais originais.
                </p>
              </div>
            </div>
            {onCleanDuplicates && (
              <button
                onClick={onCleanDuplicates}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition shrink-0 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Scissors size={15} />
                Remover Duplicados Agora
              </button>
            )}
          </div>
        )}

        {/* Resumo Financeiro (KPIs) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Valor da Fatura do Banco */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4.5 relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
              <span>Total da Fatura (Banco)</span>
              <button
                onClick={() => {
                  setTempTotal(String(invoice.total_bank_amount));
                  setEditingTotal(!editingTotal);
                }}
                className="text-indigo-400 hover:text-indigo-300 transition"
                title="Editar valor total da fatura"
              >
                <Edit2 size={13} />
              </button>
            </div>

            {editingTotal ? (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="number"
                  step="0.01"
                  value={tempTotal}
                  onChange={(e) => setTempTotal(e.target.value)}
                  className="w-full bg-slate-950 border border-indigo-500 rounded-lg px-2.5 py-1 text-sm text-white focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={handleSaveTotal}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white rounded-lg"
                >
                  OK
                </button>
              </div>
            ) : (
              <p className="text-2xl font-black text-white tracking-tight">
                {formatCurrency(invoice.total_bank_amount)}
              </p>
            )}
            <p className="text-[11px] text-slate-500 mt-1">Valor consolidado conforme o banco</p>
          </div>

          {/* Total Já Atribuído aos Devedores */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4.5">
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
              Total Identificado
            </div>
            <p className="text-2xl font-black text-emerald-400 tracking-tight">
              {formatCurrency(totalAssigned)}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Soma distribuída entre {groupedByPerson.length} compradores
            </p>
          </div>

          {/* Pendente de Triagem */}
          <div className={`border rounded-2xl p-4.5 ${
            totalUnassigned > 0
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-slate-900/80 border-slate-800'
          }`}>
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider mb-1">
              <span className={totalUnassigned > 0 ? 'text-amber-400' : 'text-slate-400'}>
                Pendente de Dono
              </span>
              {totalUnassigned > 0 && <AlertTriangle size={15} className="text-amber-400" />}
            </div>
            <p className={`text-2xl font-black tracking-tight ${
              totalUnassigned > 0 ? 'text-amber-300' : 'text-slate-400'
            }`}>
              {formatCurrency(totalUnassigned)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              {unassignedItems.length} compras aguardando identificação
            </p>
          </div>
        </div>

        {/* FILA DE TRIAGEM (Compras sem Dono) */}
        {unassignedItems.length > 0 && (
          <section className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                  <AlertTriangle size={18} className="text-amber-400" />
                  Fila de Triagem: Identificar Comprador ({unassignedItems.length})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Selecione quem comprou para vincular esta parcela e as futuras automaticamente.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              {unassignedItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-900/90 border border-amber-500/20 p-3.5 rounded-xl flex items-center justify-between gap-3 shadow-sm hover:border-amber-500/40 transition"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-white truncate">
                      {item.description}
                    </p>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[11px] font-medium text-slate-300">
                        {item.total_installments > 1
                          ? `Parc. ${item.installment_number}/${item.total_installments}`
                          : 'À vista'}
                      </span>
                      {item.purchase_date && <span>• {item.purchase_date}</span>}
                    </p>
                    <p className="text-sm font-bold text-amber-400 mt-1">
                      {formatCurrency(item.amount)}
                    </p>
                  </div>

                  <div className="shrink-0 flex items-center gap-1.5">
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value === 'ADD_NEW_PERSON') {
                          onOpenNewPerson();
                        } else if (e.target.value) {
                          onAssignDebtor(item.id, e.target.value);
                        }
                      }}
                      className="bg-slate-800 hover:bg-slate-750 text-white text-xs border border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="" disabled>Atribuir a...</option>
                      {people.map((p) => (
                        <option key={p.id} value={p.id}>
                          👤 {p.name}
                        </option>
                      ))}
                      <option value="ADD_NEW_PERSON">➕ Cadastrar Novo Comprador...</option>
                    </select>

                    <button
                      onClick={onOpenNewPerson}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 rounded-lg transition"
                      title="Adicionar Novo Comprador"
                    >
                      <Plus size={14} />
                    </button>

                    <button
                      onClick={() => onOpenSplitInstallment(item)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 border border-slate-700 rounded-lg transition"
                      title="Dividir / Rachar esta compra entre 2 ou mais pessoas"
                    >
                      <Scissors size={14} />
                    </button>

                    <button
                      onClick={() => onOpenEditInstallment(item)}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
                      title="Editar lançamento"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => onDeleteInstallment(item.id)}
                      className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* VISÃO POR DEVEDOR (Cards Individuais) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <User size={16} className="text-indigo-400" />
              Divisão por Devedor nesta Fatura
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 hidden sm:inline">
                {groupedByPerson.length} pessoas com gastos
              </span>
              <button
                onClick={onOpenNewPerson}
                className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
              >
                <Plus size={13} /> Novo Devedor
              </button>
            </div>
          </div>

          {groupedByPerson.length === 0 && unassignedItems.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-12 text-center">
              <CardIcon size={40} className="mx-auto text-slate-600 mb-3" />
              <p className="text-sm font-medium text-slate-300">Nenhum lançamento nesta fatura</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Faça o upload do PDF da fatura ou adicione compras manuais para visualizar a divisão entre as pessoas.
              </p>
              <div className="mt-4 flex justify-center gap-3">
                <button
                  onClick={onOpenUpload}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2"
                >
                  <UploadCloud size={15} /> Upload de Fatura
                </button>
                <button
                  onClick={onOpenNewInstallment}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2"
                >
                  <Plus size={15} /> Adicionar Manual
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {groupedByPerson.map((group) => {
                const isExpanded = searchQuery.trim() ? true : expandedPersonId === group.person.id;

                return (
                  <div
                    key={group.person.id}
                    className={`bg-slate-900 border rounded-2xl transition-all duration-200 overflow-hidden ${
                      isExpanded
                        ? 'border-indigo-500/50 shadow-lg shadow-indigo-950/20'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Header Clicável com a Seta de Expansão */}
                    <div
                      onClick={() => toggleExpandPerson(group.person.id)}
                      className="p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-850/40 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="w-3.5 h-3.5 rounded-full ring-2 ring-slate-700 shrink-0"
                          style={{ backgroundColor: group.person.color || '#10B981' }}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-white text-base leading-tight truncate">
                              {group.person.name}
                            </h4>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditPerson(group.person);
                              }}
                              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition shrink-0"
                              title="Editar dados deste devedor"
                            >
                              <Edit2 size={13} />
                            </button>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                            <span className="bg-slate-800 px-2 py-0.5 rounded-md text-[11px] font-medium text-slate-300">
                              {group.items.length} {group.items.length === 1 ? 'gasto' : 'gastos'}
                            </span>
                            {group.person.phone && (
                              <span className="hidden sm:inline text-slate-400">
                                • {group.person.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                        <div className="text-right">
                          <p className="text-[11px] text-slate-400">Total a pagar:</p>
                          <p className="text-lg sm:text-xl font-black text-emerald-400">
                            {formatCurrency(group.total)}
                          </p>
                        </div>

                        {/* Seta para expandir / recolher gastos */}
                        <div
                          className={`p-2 rounded-xl bg-slate-800/80 border border-slate-750 text-slate-300 hover:text-white transition-all duration-200 ${
                            isExpanded ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300' : ''
                          }`}
                          title={isExpanded ? 'Recolher gastos' : 'Expandir gastos'}
                        >
                          <ChevronDown
                            size={18}
                            className={`transition-transform duration-200 ${
                              isExpanded ? 'rotate-180 text-indigo-400' : 'text-slate-400'
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Conteúdo Expandido: Visível APENAS quando isExpanded === true */}
                    {isExpanded && (
                      <div className="px-4 sm:px-5 pb-5 pt-2 border-t border-slate-800/80 space-y-4 animate-in fade-in duration-200">
                        {/* Lista de Compras desta pessoa */}
                        <div className="divide-y divide-slate-800/60 pt-1 space-y-1">
                          {group.items.map((item) => (
                            <div
                              key={item.id}
                              className="py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-850/40 rounded-lg px-2 -mx-2 transition"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-white truncate">
                                  {item.description}
                                </p>
                                <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                  <span className="text-indigo-300 font-semibold">
                                    {item.total_installments > 1
                                      ? `Parc. ${item.installment_number}/${item.total_installments}`
                                      : 'À vista'}
                                  </span>
                                  {item.purchase_date && <span>• {item.purchase_date}</span>}
                                  {item.notes && <span>• <em>{item.notes}</em></span>}
                                </p>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <span className="font-bold text-white text-sm">
                                  {formatCurrency(item.amount)}
                                </span>
                                <div className="flex items-center gap-1">
                                  {onUnassignDebtor && (
                                    <button
                                      onClick={() => onUnassignDebtor(item.id)}
                                      className="p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition"
                                      title="Lançou errado? Desvincular e mover de volta para a Fila de Triagem"
                                    >
                                      <UserMinus size={13} />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => onOpenSplitInstallment(item)}
                                    className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded transition"
                                    title="Dividir / Rachar compra"
                                  >
                                    <Scissors size={13} />
                                  </button>
                                  <button
                                    onClick={() => onOpenEditInstallment(item)}
                                    className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded"
                                    title="Editar"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    onClick={() => onDeleteInstallment(item.id)}
                                    className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded"
                                    title="Excluir"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Rodapé do Card do Devedor: Botão WhatsApp e Projeção */}
                        <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                          <button
                            onClick={() => setSelectedPersonFuture(group.person)}
                            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition"
                          >
                            <Clock size={13} /> Ver parcelas futuras
                          </button>

                          <button
                            onClick={() => handleCopyWhatsApp(group)}
                            className="px-3.5 py-1.5 bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                          >
                            <MessageCircle size={14} />
                            Cobrança WhatsApp
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Lixeira / Lançamentos Excluídos com Opção de Restaurar */}
        {currentInvoiceDeleted.length > 0 && (
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 transition">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                <Trash2 size={15} className="text-rose-400" />
                Lixeira desta Fatura ({currentInvoiceDeleted.length} {currentInvoiceDeleted.length === 1 ? 'item excluído' : 'itens excluídos'})
              </span>
              <button
                onClick={() => setShowTrash(!showTrash)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition"
              >
                {showTrash ? 'Ocultar Lixeira' : 'Ver e Restaurar Lançamentos'}
              </button>
            </div>

            {showTrash && (
              <div className="mt-3 space-y-2 pt-3 border-t border-slate-800">
                <p className="text-[11px] text-slate-500">
                  Excluiu por engano ou lançou errado? Clique em restaurar para devolver o item à fatura:
                </p>
                {currentInvoiceDeleted.map((del) => (
                  <div
                    key={del.id}
                    className="flex items-center justify-between p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs"
                  >
                    <div>
                      <p className="font-semibold text-white">{del.description}</p>
                      <p className="text-[11px] text-slate-400">
                        {formatCurrency(del.amount)}
                        {del.total_installments > 1 ? ` • Parcela ${del.installment_number}/${del.total_installments}` : ' • À vista'}
                        {del.purchase_date ? ` • ${del.purchase_date}` : ''}
                      </p>
                    </div>

                    {onRestoreInstallment && (
                      <button
                        onClick={() => onRestoreInstallment(del.id)}
                        className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg font-semibold flex items-center gap-1.5 transition"
                      >
                        <RotateCcw size={13} /> Restaurar para a Fatura
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Modal de Parcelas Futuras do Comprador */}
      {selectedPersonFuture && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-750 text-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Clock size={18} className="text-indigo-400" />
                Compromissos Futuros: {selectedPersonFuture.name}
              </h3>
              <button
                onClick={() => setSelectedPersonFuture(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto space-y-3">
              <p className="text-xs text-slate-400">
                Compras com parcelas restantes registradas neste cartão:
              </p>

              {installments
                .filter((i) => i.person_id === selectedPersonFuture.id && i.total_installments > i.installment_number)
                .map((item) => {
                  const remaining = item.total_installments - item.installment_number;
                  const futureTotal = remaining * item.amount;
                  return (
                    <div
                      key={item.id}
                      className="p-3 bg-slate-800/50 border border-slate-750 rounded-xl flex items-center justify-between"
                    >
                      <div>
                        <p className="font-semibold text-sm text-white">{item.description}</p>
                        <p className="text-xs text-slate-400">
                          Parcela atual: {item.installment_number}/{item.total_installments} • Restam {remaining} parcelas
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">{remaining}x {formatCurrency(item.amount)}</p>
                        <p className="text-sm font-bold text-indigo-400">Saldo: {formatCurrency(futureTotal)}</p>
                      </div>
                    </div>
                  );
                })}

              {installments.filter((i) => i.person_id === selectedPersonFuture.id && i.total_installments > i.installment_number).length === 0 && (
                <p className="text-xs text-slate-500 text-center py-6">
                  Nenhuma parcela pendente para meses futuros nesta fatura.
                </p>
              )}
            </div>

            <div className="px-6 py-3 bg-slate-950/60 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedPersonFuture(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
