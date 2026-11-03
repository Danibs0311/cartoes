'use client';

import React, { useState, useEffect } from 'react';
import { CreditCard } from '@/lib/types';
import { X, Save, Trash2 } from 'lucide-react';

interface EditCardModalProps {
  card: CreditCard | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedCard: CreditCard) => void;
  onDelete?: (cardId: string) => void;
}

export function EditCardModal({ card, isOpen, onClose, onSave, onDelete }: EditCardModalProps) {
  const [name, setName] = useState('');
  const [dueDay, setDueDay] = useState<string>('');
  const [bestDay, setBestDay] = useState<string>('');
  const [limit, setLimit] = useState<string>('');
  const [color, setColor] = useState('#4F46E5');

  useEffect(() => {
    if (card) {
      setName(card.name);
      setDueDay(card.due_day ? String(card.due_day) : '');
      setBestDay(card.best_day ? String(card.best_day) : '');
      setLimit(card.credit_limit !== null ? String(card.credit_limit) : '');
      setColor(card.color || '#4F46E5');
    } else {
      setName('');
      setDueDay('');
      setBestDay('');
      setLimit('');
      setColor('#4F46E5');
    }
  }, [card, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const updated: CreditCard = {
      id: card ? card.id : 'card_' + Date.now(),
      name: name.trim().toUpperCase(),
      due_day: dueDay ? parseInt(dueDay, 10) : null,
      best_day: bestDay ? parseInt(bestDay, 10) : null,
      credit_limit: limit ? parseFloat(limit.replace(',', '.')) : null,
      color,
      is_active: true,
    };

    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-750 text-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            {card ? `Editar Cartão: ${card.name}` : 'Novo Cartão de Crédito'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Nome do Cartão</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: NUBANK, INTER, BRADESCO..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Dia do Vencimento</label>
              <input
                type="number"
                min="1"
                max="31"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                placeholder="Ex: 10, 20..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Melhor Dia (Fechamento)</label>
              <input
                type="number"
                min="1"
                max="31"
                value={bestDay}
                onChange={(e) => setBestDay(e.target.value)}
                placeholder="Ex: 3, 14..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Limite Total (R$)</label>
            <input
              type="number"
              step="0.01"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder="Ex: 5000.00"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Cor de Destaque</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-10 rounded border border-slate-700 cursor-pointer bg-transparent"
              />
              <span className="text-xs text-slate-400">Usada no menu para identificação rápida</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            {card && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Deseja realmente excluir o cartão ${card.name}?`)) {
                    onDelete(card.id);
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
                <Save size={16} /> Salvar Informações
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
