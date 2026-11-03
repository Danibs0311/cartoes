'use client';

import React, { useState, useEffect } from 'react';
import { Installment, Person } from '@/lib/types';
import { X, Save, Trash2, Calendar, DollarSign, Store, Hash } from 'lucide-react';

interface EditInstallmentModalProps {
  installment: Installment | null;
  people: Person[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: Partial<Installment>) => void;
  onDelete?: (id: string) => void;
}

export function EditInstallmentModal({
  installment,
  people,
  isOpen,
  onClose,
  onSave,
  onDelete,
}: EditInstallmentModalProps) {
  const [description, setDescription] = useState('');
  const [personId, setPersonId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [currentInst, setCurrentInst] = useState<string>('1');
  const [totalInst, setTotalInst] = useState<string>('1');
  const [date, setDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (installment) {
      setDescription(installment.description || '');
      setPersonId(installment.person_id || '');
      setAmount(installment.amount ? String(installment.amount) : '');
      setCurrentInst(String(installment.installment_number || 1));
      setTotalInst(String(installment.total_installments || 1));
      setDate(installment.purchase_date || '');
      setNotes(installment.notes || '');
    } else {
      setDescription('');
      setPersonId('');
      setAmount('');
      setCurrentInst('1');
      setTotalInst('1');
      setDate(new Date().toISOString().slice(0, 10));
      setNotes('');
    }
  }, [installment, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount) return;

    onSave({
      id: installment ? installment.id : undefined,
      description: description.trim(),
      person_id: personId || null,
      amount: parseFloat(amount.replace(',', '.')),
      installment_number: parseInt(currentInst, 10) || 1,
      total_installments: parseInt(totalInst, 10) || 1,
      purchase_date: date,
      notes: notes.trim(),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-750 text-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Store size={20} className="text-indigo-400" />
            {installment ? 'Editar Lançamento' : 'Novo Lançamento Manual'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1 flex items-center gap-1.5">
              <Store size={14} /> Estabelecimento / Descrição
            </label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: MERCADO LIVRE, MAGAZINE LUIZA..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
              Comprador Responsável
            </label>
            <select
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">⚠️ Sem identificação (Pendente de Triagem)</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  👤 {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1 flex items-center gap-1.5">
                <DollarSign size={14} /> Valor da Parcela (R$)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ex: 149.90"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1 flex items-center gap-1.5">
                <Calendar size={14} /> Data da Compra
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1 flex items-center gap-1.5">
                <Hash size={14} /> Parcela Atual
              </label>
              <input
                type="number"
                min="1"
                value={currentInst}
                onChange={(e) => setCurrentInst(e.target.value)}
                placeholder="Ex: 3"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1 flex items-center gap-1.5">
                <Hash size={14} /> Total de Parcelas
              </label>
              <input
                type="number"
                min="1"
                value={totalInst}
                onChange={(e) => setTotalInst(e.target.value)}
                placeholder="Ex: 10"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Observação (Opcional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Presente de aniversário, peça do carro..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            {installment && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Deseja excluir este lançamento?')) {
                    onDelete(installment.id);
                    onClose();
                  }
                }}
                className="px-3 py-2 text-rose-400 hover:bg-rose-500/10 rounded-lg text-sm flex items-center gap-1.5 transition"
              >
                <Trash2 size={16} /> Excluir
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition"
              >
                <Save size={16} /> Salvar Lançamento
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
