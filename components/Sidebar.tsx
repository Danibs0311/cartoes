'use client';

import React, { useState } from 'react';
import { CreditCard, Person } from '@/lib/types';
import { CreditCard as CardIcon, Calendar, Users, Plus, Search, ChevronRight, Menu, X, Settings, ShieldCheck } from 'lucide-react';
import { formatCurrency, calculateInvoiceStatus } from '@/lib/storage';

interface SidebarProps {
  cards: CreditCard[];
  selectedCardId: string;
  onSelectCard: (id: string) => void;
  people: Person[];
  onOpenEditCard: (card: CreditCard | null) => void;
  onOpenManagePeople: () => void;
  onOpenNewPerson: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  currentMonth?: number;
  currentYear?: number;
}

export function Sidebar({
  cards,
  selectedCardId,
  onSelectCard,
  people,
  onOpenEditCard,
  onOpenManagePeople,
  onOpenNewPerson,
  isOpenMobile,
  onCloseMobile,
  currentMonth,
  currentYear,
}: SidebarProps) {
  const [search, setSearch] = useState('');

  // Ordena os cartões por dia de vencimento
  const sortedCards = [...cards].sort((a, b) => {
    if (a.due_day === null) return 1;
    if (b.due_day === null) return -1;
    return a.due_day - b.due_day;
  });

  const filteredCards = sortedCards.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {/* Overlay escuro para mobile */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-80 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Cabeçalho da Sidebar */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <CardIcon size={20} />
            </div>
            <div>
              <h1 className="font-bold text-white text-base leading-tight">DGTECH Faturas</h1>
              <p className="text-xs text-slate-400">Gestão Compartilhada</p>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        {/* Busca rápida */}
        <div className="p-3 border-b border-slate-800/60">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cartão..."
              className="w-full bg-slate-950/60 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Acesso rápido aos Devedores */}
        <div className="p-3 border-b border-slate-800/60 bg-slate-950/20">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/50 border border-slate-750">
            <button
              onClick={() => {
                onOpenManagePeople();
                onCloseMobile();
              }}
              className="flex items-center gap-2 text-left hover:text-white transition group"
            >
              <Users size={16} className="text-emerald-400 group-hover:scale-110 transition" />
              <div>
                <p className="text-xs font-bold text-slate-200 group-hover:text-emerald-300">
                  Devedores Cadastrados
                </p>
                <p className="text-[10px] text-slate-400">
                  {people.length} pessoas registradas
                </p>
              </div>
            </button>

            <button
              onClick={() => {
                onOpenNewPerson();
                onCloseMobile();
              }}
              className="p-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-medium flex items-center gap-1 transition"
              title="Adicionar Novo Comprador"
            >
              <Plus size={14} /> Novo
            </button>
          </div>
        </div>

        {/* Lista de Cartões (Ordenados por Vencimento) */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
          <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span>Meus Cartões ({cards.length})</span>
            <button
              onClick={() => onOpenEditCard(null)}
              className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium capitalize"
              title="Adicionar Cartão"
            >
              <Plus size={14} /> Novo
            </button>
          </div>

          {filteredCards.map((card) => {
            const isSelected = card.id === selectedCardId;
            const cardStatus = calculateInvoiceStatus(
              card,
              currentMonth || new Date().getMonth() + 1,
              currentYear || new Date().getFullYear()
            );

            return (
              <div
                key={card.id}
                onClick={() => {
                  onSelectCard(card.id);
                  onCloseMobile();
                }}
                className={`group relative rounded-xl p-3 cursor-pointer transition border text-left flex flex-col gap-1.5 ${
                  isSelected
                    ? 'bg-indigo-600/15 border-indigo-500/60 text-white shadow-sm'
                    : 'bg-slate-800/30 hover:bg-slate-800/80 border-slate-800/80 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full ring-2 ring-slate-800"
                      style={{ backgroundColor: card.color || '#4F46E5' }}
                    />
                    <span className="font-bold text-sm tracking-wide text-white group-hover:text-indigo-300 transition">
                      {card.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                        cardStatus === 'fechada'
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {cardStatus}
                    </span>
                    {card.due_day ? (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        Venc: {card.due_day.toString().padStart(2, '0')}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500">Sem data</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pl-4.5">
                  <span>
                    {card.best_day ? `Melhor dia: ${card.best_day}` : 'Melhor dia: —'}
                  </span>
                  <span className="font-semibold text-slate-300">
                    {card.credit_limit ? formatCurrency(card.credit_limit) : 'Limite —'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Rodapé da Sidebar */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40 space-y-1.5">
          <button
            onClick={onOpenManagePeople}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium border border-slate-750 transition"
          >
            <span className="flex items-center gap-2">
              <Users size={16} className="text-emerald-400" />
              Compradores / Devedores
            </span>
            <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded text-[10px] font-bold">
              {people.length}
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}
