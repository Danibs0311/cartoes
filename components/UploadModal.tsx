'use client';

import React, { useState } from 'react';
import { CreditCard, Person, ExtractedInvoiceData } from '@/lib/types';
import { X, UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/storage';

interface UploadModalProps {
  card: CreditCard;
  month: number;
  year: number;
  people: Person[];
  isOpen: boolean;
  onClose: () => void;
  onConfirmImport: (data: ExtractedInvoiceData) => void;
}

export function UploadModal({
  card,
  month,
  year,
  people,
  isOpen,
  onClose,
  onConfirmImport,
}: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedInvoiceData | null>(null);

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

      const res = await fetch('/api/extract', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(json.error || 'Erro ao processar fatura.');
      }

      setExtracted(json.data);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Falha na comunicação com o Gemini Pro.');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-750 text-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <UploadCloud size={20} className="text-indigo-400" />
              Upload de Fatura ({card.name})
            </h2>
            <p className="text-xs text-slate-400">
              Competência: Mês {month.toString().padStart(2, '0')}/{year}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
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

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-start gap-2.5">
                <span className="text-sm">🔒</span>
                <div>
                  <p className="font-semibold text-amber-200">Sua fatura tem senha de banco?</p>
                  <p className="text-[11px] text-amber-300/80 mt-0.5 leading-relaxed">
                    A IA do Google não consegue ler PDFs protegidos por senha. Para enviar, basta abrir o PDF no computador ou celular, digitar a senha e clicar em <strong>Imprimir &gt; Salvar como PDF</strong>. O novo PDF salvo estará sem senha e pronto para ser lido em segundos!
                  </p>
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
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 size={16} /> Leitura Concluída com Sucesso!
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Total identificado: <strong>{formatCurrency(extracted.total_amount)}</strong> • Itens encontrados: {extracted.items?.length || 0}
                  </p>
                </div>
                <button
                  onClick={() => setExtracted(null)}
                  className="text-xs text-slate-400 hover:text-white underline"
                >
                  Enviar outro arquivo
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-slate-400">Prévia dos lançamentos extraídos:</label>
                <div className="border border-slate-800 rounded-xl overflow-hidden max-h-60 overflow-y-auto divide-y divide-slate-800">
                  {extracted.items?.map((item, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between text-xs bg-slate-900/60 hover:bg-slate-800/40">
                      <div>
                        <p className="font-semibold text-white">{item.description}</p>
                        <p className="text-slate-400">
                          {item.date ? `${item.date} • ` : ''}
                          Parcela {item.current_installment} de {item.total_installments}
                        </p>
                      </div>
                      <span className="font-bold text-emerald-400">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>

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
                  onClick={handleFinalize}
                  className="px-5 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition"
                >
                  <CheckCircle2 size={16} />
                  Importar para a Fatura
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
