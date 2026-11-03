'use client';

import React, { useState, useEffect } from 'react';
import { Installment, Person } from '@/lib/types';
import { X, Users, Scissors, Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/storage';

interface SplitPart {
  person_id: string;
  amount: number;
}

interface SplitPurchaseModalProps {
  installment: Installment | null;
  people: Person[];
  isOpen: boolean;
  onClose: () => void;
  onConfirmSplit: (
    originalInstallment: Installment,
    splits: Array<{ person_id: string; amount: number; person_name: string }>,
    applyToFuture: boolean
  ) => void;
  onOpenNewPerson?: () => void;
}

export function SplitPurchaseModal({
  installment,
  people,
  isOpen,
  onClose,
  onConfirmSplit,
  onOpenNewPerson,
}: SplitPurchaseModalProps) {
  const [splits, setSplits] = useState<SplitPart[]>([]);
  const [applyToFuture, setApplyToFuture] = useState(true);

  useEffect(() => {
    if (installment && isOpen) {
      const half = parseFloat((installment.amount / 2).toFixed(2));
      const secondHalf = parseFloat((installment.amount - half).toFixed(2));

      const firstPerson = installment.person_id || (people[0] ? people[0].id : '');
      const secondPerson = people.find((p) => p.id !== firstPerson)?.id || (people[1] ? people[1].id : '');

      setSplits([
        { person_id: firstPerson, amount: half },
        { person_id: secondPerson, amount: secondHalf },
      ]);
      setApplyToFuture(installment.total_installments > 1);
    }
  }, [installment, isOpen, people]);

  if (!isOpen || !installment) return null;

  const totalSplit = splits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const diff = parseFloat((installment.amount - totalSplit).toFixed(2));
  const isValid = Math.abs(diff) < 0.01;

  // Dividir igualmente entre os participantes selecionados
  const handleSplitEqually = () => {
    if (splits.length === 0) return;
    const basePart = Math.floor((installment.amount / splits.length) * 100) / 100;
    let remainder = Math.round((installment.amount - basePart * splits.length) * 100) / 100;

    const newSplits = splits.map((s, idx) => {
      let amt = basePart;
      if (remainder > 0) {
        amt = parseFloat((amt + 0.01).toFixed(2));
        remainder = parseFloat((remainder - 0.01).toFixed(2));
      }
      return { ...s, amount: amt };
    });

    setSplits(newSplits);
  };

  const addPersonToSplit = () => {
    const existingIds = new Set(splits.map((s) => s.person_id));
    const nextPerson = people.find((p) => !existingIds.has(p.id)) || people[0];
    const newSplits = [...splits, { person_id: nextPerson ? nextPerson.id : '', amount: 0 }];
    setSplits(newSplits);
  };

  const removeSplit = (index: number) => {
    if (splits.length <= 2) return;
    const newSplits = splits.filter((_, i) => i !== index);
    setSplits(newSplits);
  };

  const updateSplit = (index: number, field: 'person_id' | 'amount', value: any) => {
    const newSplits = [...splits];
    newSplits[index] = { ...newSplits[index], [field]: value };
    setSplits(newSplits);
  };

  const handleConfirm = () => {
    if (!isValid) return;

    const formattedSplits = splits.map((s) => {
      const personObj = people.find((p) => p.id === s.person_id);
      return {
        person_id: s.person_id,
        amount: Number(s.amount),
        person_name: personObj ? personObj.name : 'Comprador',
      };
    });

    onConfirmSplit(installment, formattedSplits, applyToFuture);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-750 text-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Scissors size={20} className="text-indigo-400" />
            Dividir Compra entre 2 ou mais Pessoas
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Card da compra original */}
          <div className="p-3.5 bg-slate-800/60 border border-slate-700/60 rounded-xl flex items-center justify-between">
            <div>
              <p className="font-bold text-sm text-white">{installment.description}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {installment.total_installments > 1
                  ? `Parcela ${installment.installment_number} de ${installment.total_installments}`
                  : 'Compra à vista'}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-slate-400">Valor Original:</span>
              <p className="text-base font-black text-emerald-400">{formatCurrency(installment.amount)}</p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-semibold uppercase text-slate-400">Quem vai pagar e quanto:</span>
            <button
              type="button"
              onClick={handleSplitEqually}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium underline"
            >
              Dividir igualmente
            </button>
          </div>

          {/* Lista de pessoas na divisão */}
          <div className="space-y-3">
            {splits.map((split, index) => (
              <div key={index} className="flex items-center gap-2 bg-slate-800/40 p-2.5 rounded-xl border border-slate-750">
                <div className="flex-1">
                  <select
                    value={split.person_id}
                    onChange={(e) => updateSplit(index, 'person_id', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="" disabled>Selecione a pessoa...</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        👤 {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-32">
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-xs text-slate-400">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={split.amount}
                      onChange={(e) => updateSplit(index, 'amount', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-2 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {splits.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeSplit(index)}
                    className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                    title="Remover pessoa"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={addPersonToSplit}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
            >
              <Plus size={14} /> Adicionar mais uma pessoa
            </button>

            {onOpenNewPerson && (
              <button
                type="button"
                onClick={onOpenNewPerson}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
              >
                + Cadastrar novo devedor
              </button>
            )}
          </div>

          {/* Validação de soma dos valores */}
          <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
            isValid
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            <div className="flex items-center gap-2">
              {isValid ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>
                {isValid
                  ? 'A soma bate exatamente com o valor total da compra!'
                  : `Diferença de ${formatCurrency(Math.abs(diff))} (${diff > 0 ? 'falta distribuir' : 'distribuído a mais'})`}
              </span>
            </div>
            <span className="font-bold">{formatCurrency(totalSplit)} / {formatCurrency(installment.amount)}</span>
          </div>

          {/* Opção para replicar em meses futuros se for parcelado */}
          {installment.total_installments > installment.installment_number && (
            <label className="flex items-start gap-2.5 p-3 bg-slate-800/40 border border-slate-750 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={applyToFuture}
                onChange={(e) => setApplyToFuture(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs text-slate-300">
                <strong>Replicar esta divisão nas próximas parcelas:</strong> aplicar a mesma divisão entre essas pessoas nas parcelas restantes dos meses seguintes.
              </span>
            </label>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!isValid}
              onClick={handleConfirm}
              className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition"
            >
              <Scissors size={15} /> Confirmar Divisão
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
