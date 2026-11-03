'use client';

import React, { useState } from 'react';
import { Person } from '@/lib/types';
import { X, Plus, Edit2, Trash2, User, Phone, Check } from 'lucide-react';

interface EditPersonModalProps {
  people: Person[];
  isOpen: boolean;
  initialPerson?: Person | 'new' | null;
  onClose: () => void;
  onSavePeople: (updatedList: Person[]) => void;
}

export function EditPersonModal({
  people,
  isOpen,
  initialPerson = null,
  onClose,
  onSavePeople,
}: EditPersonModalProps) {
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [color, setColor] = useState('#10B981');
  const [notes, setNotes] = useState('');

  React.useEffect(() => {
    if (!isOpen) {
      setEditingPersonId(null);
      return;
    }
    if (initialPerson === 'new') {
      setEditingPersonId('new');
      setName('');
      setPhone('');
      setColor('#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'));
      setNotes('');
    } else if (initialPerson) {
      setEditingPersonId(initialPerson.id);
      setName(initialPerson.name);
      setPhone(initialPerson.phone || '');
      setColor(initialPerson.color || '#10B981');
      setNotes(initialPerson.notes || '');
    } else {
      setEditingPersonId(null);
    }
  }, [isOpen, initialPerson]);

  if (!isOpen) return null;

  const startEdit = (p: Person) => {
    setEditingPersonId(p.id);
    setName(p.name);
    setPhone(p.phone || '');
    setColor(p.color || '#10B981');
    setNotes(p.notes || '');
  };

  const startNew = () => {
    setEditingPersonId('new');
    setName('');
    setPhone('');
    setColor('#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'));
    setNotes('');
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    let updated: Person[];
    if (editingPersonId === 'new') {
      const existing = people.find(
        (p) => p.name.trim().toLowerCase() === name.trim().toLowerCase()
      );
      if (existing) {
        // Atualiza a pessoa existente sem criar duplicado
        updated = people.map((p) =>
          p.id === existing.id
            ? {
                ...p,
                phone: phone.trim().replace(/\D/g, '') || p.phone,
                color: color || p.color,
                notes: notes.trim() || p.notes,
              }
            : p
        );
      } else {
        const newPerson: Person = {
          id: 'p_' + Date.now(),
          name: name.trim(),
          phone: phone.trim().replace(/\D/g, ''),
          color,
          notes: notes.trim(),
          is_active: true,
        };
        updated = [...people, newPerson];
      }
    } else {
      updated = people.map((p) =>
        p.id === editingPersonId
          ? { ...p, name: name.trim(), phone: phone.trim().replace(/\D/g, ''), color, notes: notes.trim() }
          : p
      );
    }

    onSavePeople(updated);
    setEditingPersonId(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('Deseja excluir este comprador?')) {
      const updated = people.filter((p) => p.id !== id);
      onSavePeople(updated);
      if (editingPersonId === id) setEditingPersonId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-750 text-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <User size={20} className="text-indigo-400" />
            Gerenciar Compradores / Devedores
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Formulário de Adicionar / Editar */}
          {editingPersonId ? (
            <form onSubmit={handleSaveItem} className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 space-y-3">
              <h3 className="text-sm font-semibold text-slate-300">
                {editingPersonId === 'new' ? 'Novo Comprador' : 'Editar Comprador'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Nome Completo / Apelido</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: João Silva"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">WhatsApp (DDD + Número)</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ex: 71999999999"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs text-slate-400">Cor:</label>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-8 h-8 rounded border border-slate-700 cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observação (opcional)"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPersonId(null)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-1 font-medium transition"
                >
                  <Check size={14} /> Salvar Comprador
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={startNew}
              className="w-full py-2.5 px-4 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition"
            >
              <Plus size={16} /> Adicionar Novo Comprador
            </button>
          )}

          {/* Lista de Pessoas Cadastradas */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase text-slate-400">Compradores Cadastrados ({people.length})</label>
            {people.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">Nenhum comprador cadastrado ainda.</p>
            ) : (
              people.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 bg-slate-800/40 border border-slate-800 rounded-xl hover:border-slate-700 transition"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-3.5 h-3.5 rounded-full ring-2 ring-slate-700"
                      style={{ backgroundColor: p.color }}
                    />
                    <div>
                      <p className="font-medium text-sm text-white">{p.name}</p>
                      {p.phone && (
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <Phone size={11} /> {p.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(p)}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition"
                      title="Editar"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition"
                      title="Excluir"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-950/50 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}
