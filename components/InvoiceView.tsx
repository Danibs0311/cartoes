'use client';

import React, { useState } from 'react';
import { CreditCard, Person, Invoice, Installment, ExtractedInvoiceData } from '@/lib/types';
import {
  Menu,
  ChevronLeft,
  ChevronRight,
  UploadCloud,
  Plus,
  Edit2,
  Trash2,
  Share2,
  AlertTriangle,
  CheckCircle,
  Calendar,
  CreditCard as CardIcon,
  User,
  Clock,
  ExternalLink,
  MessageCircle,
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
}: InvoiceViewProps) {
  const [editingTotal, setEditingTotal] = useState(false);
  const [tempTotal, setTempTotal] = useState(String(invoice.total_bank_amount));
  const [selectedPersonFuture, setSelectedPersonFuture] = useState<Person | null>(null);

  // Cálculos de totais
  const totalAssigned = installments
    .filter((i) => i.person_id)
    .reduce((sum, i) => sum + i.amount, 0);

  const unassignedItems = installments.filter((i) => !i.person_id);
  const totalUnassigned = unassignedItems.reduce((sum, i) => sum + i.amount, 0);

  // Agrupamento por devedor
  const groupedByPerson = people.map((person) => {
    const personItems = installments.filter((i) => i.person_id === person.id);
    const total = personItems.reduce((sum, i) => sum + i.amount, 0);
    return {
      person,
      items: personItems,
      total,
    };
  }).filter((g) => g.items.length > 0);

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
        </div>
      </header>

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
              <p className="text-[11px] text-slate-400">
                Status: <span className="uppercase text-indigo-400 font-semibold">{invoice.status}</span>
              </p>
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
                        if (e.target.value) {
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
                    </select>

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
            <span className="text-xs text-slate-500">
              {groupedByPerson.length} pessoas com gastos
            </span>
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {groupedByPerson.map((group) => (
                <div
                  key={group.person.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between"
                >
                  <div>
                    {/* Header do Devedor */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3.5 h-3.5 rounded-full ring-2 ring-slate-700"
                          style={{ backgroundColor: group.person.color || '#10B981' }}
                        />
                        <div>
                          <h4 className="font-bold text-white text-base leading-tight">
                            {group.person.name}
                          </h4>
                          {group.person.phone && (
                            <p className="text-[11px] text-slate-400">
                              Tel: {group.person.phone}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-slate-400">Total a pagar:</p>
                        <p className="text-xl font-black text-emerald-400">
                          {formatCurrency(group.total)}
                        </p>
                      </div>
                    </div>

                    {/* Lista de Compras desta pessoa */}
                    <div className="divide-y divide-slate-800/60 pt-2 space-y-1">
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
                      className="px-3 py-1.5 bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      <MessageCircle size={14} />
                      Cobrança WhatsApp
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
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
