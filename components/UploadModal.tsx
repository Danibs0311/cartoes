'use client';

import React, { useState, useMemo } from 'react';
import { CreditCard, Person, ExtractedInvoiceData, Installment } from '@/lib/types';
import {
  X,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Layers,
  HelpCircle,
  Check,
  AlertTriangle,
  UserCheck,
} from 'lucide-react';
import { formatCurrency } from '@/lib/storage';
import { reconcileInvoiceItems } from '@/lib/deduplicate';

interface UploadModalProps {
  card: CreditCard;
  month: number;
  year: number;
  people: Person[];
  existingInstallments?: Installment[];
  isOpen: boolean;
  onClose: () => void;
  onConfirmImport: (data: ExtractedInvoiceData) => void;
}

export function UploadModal({
  card,
  month,
  year,
  people,
  existingInstallments = [],
  isOpen,
  onClose,
  onConfirmImport,
}: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedInvoiceData | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'changed' | 'new' | 'unmatched'>('all');

  // Mapa rápido de pessoas
  const peopleMap = useMemo(() => {
    const map = new Map<string, string>();
    people.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [people]);

  // Conciliação entre a fatura upada e os lançamentos existentes
  // Ordem de critérios estrita: 1. Valor da Prestação, 2. Data de Compra, 3. Número de Prestação
  const reconciliation = useMemo(() => {
    if (!extracted?.items) return null;
    return reconcileInvoiceItems(extracted.items, existingInstallments);
  }, [extracted, existingInstallments]);

  // Cálculos comparativos de totais
  const totals = useMemo(() => {
    if (!extracted) {
      return { totalPdf: 0, totalExisting: 0, diff: 0, changedCount: 0 };
    }

    const totalPdf =
      extracted.total_amount && extracted.total_amount > 0
        ? extracted.total_amount
        : (extracted.items || []).reduce((acc, item) => acc + item.amount, 0);

    const totalExisting = existingInstallments.reduce((acc, item) => acc + item.amount, 0);
    const diff = totalPdf - totalExisting;

    const changedCount = reconciliation?.matches.filter((m) => m.nameChanged).length || 0;

    return { totalPdf, totalExisting, diff, changedCount };
  }, [extracted, existingInstallments, reconciliation]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setExtracted(null);
    }
  };

  const handleExtract = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('cardName', card.name);
      if (password) {
        formData.append('password', password);
      }

      const res = await fetch('/api/extract', {
        method: 'POST',
        body: formData,
      });

      const responseText = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(responseText);
      } catch {
        if (!res.ok) {
          throw new Error(
            `O servidor da Vercel retornou erro (${res.status}). Aguarde alguns segundos e tente novamente.`
          );
        }
        throw new Error('Resposta inesperada do servidor.');
      }

      if (!res.ok || json.error) {
        throw new Error(json.error || 'Erro ao processar fatura.');
      }

      setExtracted(json.data);
      setActiveTab('all');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Falha na comunicação com o Gemini.');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = () => {
    if (extracted) {
      onConfirmImport(extracted);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-750 text-white rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 sticky top-0 z-10">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <UploadCloud size={20} className="text-indigo-400" />
              Upload e Conciliação de Fatura ({card.name})
            </h2>
            <p className="text-xs text-slate-400">
              Competência: Mês {month.toString().padStart(2, '0')}/{year} • Comparativo inteligente com dados já lançados
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {!extracted ? (
            <div className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition flex flex-col items-center justify-center cursor-pointer ${
                  file ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-700 hover:border-slate-500 bg-slate-800/40'
                }`}
                onClick={() => document.getElementById('invoice-file-input')?.click()}
              >
                <input
                  type="file"
                  id="invoice-file-input"
                  accept=".pdf,image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <FileText size={48} className={file ? 'text-indigo-400' : 'text-slate-500'} />
                <p className="mt-3 text-sm font-medium text-slate-200">
                  {file ? file.name : 'Clique para selecionar o PDF da fatura ou arraste aqui'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Formatos aceitos: PDF ou imagens de fatura (Nubank, Itaú, Inter, Bradesco, etc.)
                </p>
              </div>

              {/* Campo para senha da fatura */}
              <div className="bg-slate-800/60 border border-slate-750 p-3.5 rounded-xl space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Lock size={14} className="text-indigo-400" />
                    Senha da fatura (opcional)
                  </span>
                  <span className="text-[11px] font-normal text-slate-400">
                    Preencha apenas se o seu banco exige senha
                  </span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ex: 4 primeiros dígitos do CPF, data de nascimento..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 pr-10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!file || loading}
                  onClick={handleExtract}
                  className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Analisando com Gemini Pro...
                    </>
                  ) : (
                    <>
                      <UploadCloud size={16} />
                      Processar Fatura
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Painel Comparativo KPI */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 bg-slate-850 border border-slate-750 rounded-xl">
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                    Total Fatura (PDF)
                  </span>
                  <span className="text-xl font-bold text-white mt-1 block">
                    {formatCurrency(totals.totalPdf)}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {extracted.items?.length || 0} lançamentos no arquivo
                  </span>
                </div>

                <div className="p-3.5 bg-slate-850 border border-slate-750 rounded-xl">
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                    Total já no Sistema
                  </span>
                  <span className="text-xl font-bold text-slate-200 mt-1 block">
                    {formatCurrency(totals.totalExisting)}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {existingInstallments.length} compras cadastradas
                  </span>
                </div>

                <div
                  className={`p-3.5 border rounded-xl ${
                    Math.abs(totals.diff) < 0.05
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : totals.diff > 0
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-rose-500/10 border-rose-500/30'
                  }`}
                >
                  <span className="text-[11px] font-medium uppercase tracking-wider block text-slate-400">
                    Diferença
                  </span>
                  <span
                    className={`text-xl font-bold mt-1 block ${
                      Math.abs(totals.diff) < 0.05
                        ? 'text-emerald-400'
                        : totals.diff > 0
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {Math.abs(totals.diff) < 0.05 ? 'R$ 0,00' : formatCurrency(totals.diff)}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {Math.abs(totals.diff) < 0.05
                      ? 'Fatura 100% batendo!'
                      : totals.diff > 0
                      ? 'Faltam lançamentos no App'
                      : 'App tem mais que a fatura'}
                  </span>
                </div>
              </div>

              {/* Informação sobre os critérios de comparação */}
              <div className="p-3 bg-indigo-950/40 border border-indigo-800/40 rounded-xl text-xs text-indigo-200 flex items-start gap-2.5">
                <RefreshCw size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Comparação inteligente por critérios hierárquicos:</strong> 1º Valor da Prestação • 2º Data da Compra • 3º Número da Parcela.
                  {totals.changedCount > 0 && (
                    <span className="block mt-0.5 text-emerald-300 font-medium">
                      ✓ {totals.changedCount} nome(s) de estabelecimentos serão atualizados para a descrição oficial da fatura, mantendo 100% dos compradores já atribuídos.
                    </span>
                  )}
                </div>
              </div>

              {/* Abas / Filtros de visualização */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap flex items-center gap-1.5 ${
                    activeTab === 'all'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Layers size={14} />
                  Todos na Fatura ({reconciliation ? reconciliation.matches.length + reconciliation.newItems.length : 0})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('changed')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap flex items-center gap-1.5 ${
                    activeTab === 'changed'
                      ? 'bg-amber-600 text-white shadow'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <RefreshCw size={14} />
                  Nomes a Corrigir ({totals.changedCount})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('new')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap flex items-center gap-1.5 ${
                    activeTab === 'new'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Sparkles size={14} />
                  Novas Compras ({reconciliation?.newItems.length || 0})
                </button>

                {(reconciliation?.unmatchedExisting.length || 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('unmatched')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap flex items-center gap-1.5 ${
                      activeTab === 'unmatched'
                        ? 'bg-slate-700 text-white shadow'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <AlertTriangle size={14} />
                    Apenas no App ({reconciliation?.unmatchedExisting.length || 0})
                  </button>
                )}
              </div>

              {/* Lista comparativa detalhada */}
              <div className="border border-slate-800 rounded-xl overflow-hidden max-h-72 overflow-y-auto divide-y divide-slate-800/80 bg-slate-950/40">
                {/* Lançamentos Conciliados (Matches) */}
                {reconciliation?.matches
                  .filter((m) => {
                    if (activeTab === 'changed') return m.nameChanged;
                    if (activeTab === 'new') return false;
                    if (activeTab === 'unmatched') return false;
                    return true;
                  })
                  .map((match, idx) => {
                    const personName = match.existing.person_id
                      ? peopleMap.get(match.existing.person_id) || 'Comprador'
                      : 'Fila de Triagem';

                    return (
                      <div
                        key={`match_${idx}`}
                        className={`p-3 text-xs flex flex-col md:flex-row md:items-center justify-between gap-2 transition ${
                          match.nameChanged ? 'bg-amber-500/5 hover:bg-amber-500/10' : 'hover:bg-slate-800/30'
                        }`}
                      >
                        <div className="space-y-1">
                          {match.nameChanged ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-slate-400 line-through">
                                {match.existing.description}
                              </span>
                              <ArrowRight size={13} className="text-amber-400" />
                              <span className="font-semibold text-white bg-amber-500/20 px-2 py-0.5 rounded text-amber-200">
                                {match.extractedItem.description}
                              </span>
                              <span className="text-[10px] bg-amber-400/20 text-amber-300 font-medium px-1.5 py-0.5 rounded">
                                Nome será corrigido
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white">
                                {match.extractedItem.description}
                              </span>
                              <span className="text-[10px] bg-emerald-500/15 text-emerald-300 font-medium px-1.5 py-0.5 rounded flex items-center gap-1">
                                <Check size={10} /> Nome idêntico
                              </span>
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-slate-400 text-[11px] flex-wrap">
                            {match.extractedItem.date && <span>Data: {match.extractedItem.date}</span>}
                            <span>•</span>
                            <span>
                              Parcela {match.extractedItem.current_installment} de {match.extractedItem.total_installments}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-indigo-300 font-medium">
                              <UserCheck size={12} /> {personName}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-bold text-white text-sm">
                            {formatCurrency(match.extractedItem.amount)}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            Conciliado com App
                          </span>
                        </div>
                      </div>
                    );
                  })}

                {/* Compras Novas encontradas na fatura */}
                {(activeTab === 'all' || activeTab === 'new') &&
                  reconciliation?.newItems.map((item, idx) => (
                    <div
                      key={`new_${idx}`}
                      className="p-3 text-xs flex flex-col md:flex-row md:items-center justify-between gap-2 bg-emerald-500/5 hover:bg-emerald-500/10 transition"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-emerald-200">
                            {item.description}
                          </span>
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-medium px-2 py-0.5 rounded flex items-center gap-1">
                            <Sparkles size={11} /> Nova compra identificada
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                          {item.date && <span>Data: {item.date}</span>}
                          <span>•</span>
                          <span>
                            Parcela {item.current_installment} de {item.total_installments}
                          </span>
                          <span>•</span>
                          <span className="text-amber-300">Irá para a Fila de Triagem</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-bold text-emerald-400 text-sm">
                          {formatCurrency(item.amount)}
                        </span>
                        <span className="text-[10px] text-emerald-300/70 block">
                          Adicionar à Fatura
                        </span>
                      </div>
                    </div>
                  ))}

                {/* Lançamentos manuais que estão no app mas não foram identificados na fatura */}
                {activeTab === 'unmatched' &&
                  reconciliation?.unmatchedExisting.map((inst, idx) => (
                    <div
                      key={`unmatched_${idx}`}
                      className="p-3 text-xs flex flex-col md:flex-row md:items-center justify-between gap-2 bg-slate-800/30 hover:bg-slate-800/50 transition"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-300">{inst.description}</span>
                          <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
                            Lançado no App
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                          {inst.purchase_date && <span>Data: {inst.purchase_date}</span>}
                          <span>•</span>
                          <span>
                            Parcela {inst.installment_number} de {inst.total_installments}
                          </span>
                          <span>•</span>
                          <span className="text-slate-300">
                            {inst.person_id ? peopleMap.get(inst.person_id) : 'Sem comprador'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-bold text-slate-300 text-sm">
                          {formatCurrency(inst.amount)}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          Não encontrado no PDF
                        </span>
                      </div>
                    </div>
                  ))}

                {/* Mensagem vazia se filtro não tiver itens */}
                {activeTab === 'changed' && totals.changedCount === 0 && (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    Todos os nomes dos lançamentos existentes já estão perfeitamente alinhados com a fatura!
                  </div>
                )}
                {activeTab === 'new' && (reconciliation?.newItems.length || 0) === 0 && (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    Nenhuma compra nova faltante. Todos os itens da fatura já constavam no sistema!
                  </div>
                )}
              </div>

              {/* Botões de Ação */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setExtracted(null)}
                  className="text-xs text-slate-400 hover:text-white underline text-left"
                >
                  Enviar outro arquivo
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleFinalize}
                    className="px-5 py-2.5 text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition"
                  >
                    <CheckCircle2 size={16} />
                    Confirmar Conciliação e Importação
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
