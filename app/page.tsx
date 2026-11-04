'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CreditCard, Person, Invoice, Installment, ExtractedInvoiceData } from '@/lib/types';
import { INITIAL_CARDS, INITIAL_PEOPLE, calculateInvoiceStatus } from '@/lib/storage';
import { Sidebar } from '@/components/Sidebar';
import { InvoiceView } from '@/components/InvoiceView';
import { EditCardModal } from '@/components/EditCardModal';
import { EditPersonModal } from '@/components/EditPersonModal';
import { EditInstallmentModal } from '@/components/EditInstallmentModal';
import { UploadModal } from '@/components/UploadModal';
import { SplitPurchaseModal } from '@/components/SplitPurchaseModal';
import {
  findDuplicatesInInvoice,
  cleanInvoiceDuplicates,
  reconcileInvoiceItems,
} from '@/lib/deduplicate';
import {
  fetchCloudData,
  cloudSaveCard,
  cloudSavePerson,
  cloudDeletePerson,
  cloudUpdateInvoice,
  cloudSaveInstallment,
  cloudDeleteInstallment,
  cloudAssignDebtor,
  cloudUpdateInstallmentStatus,
  cloudSyncImportInvoice,
  subscribeToCloudChanges,
  migrateLocalStorageToCloud,
  getOrCreateCloudInvoice,
} from '@/lib/supabaseSync';

export default function HomePage() {
  // Estado de Dados
  const [cards, setCards] = useState<CreditCard[]>(INITIAL_CARDS);
  const [people, setPeople] = useState<Person[]>(INITIAL_PEOPLE);
  const [selectedCardId, setSelectedCardId] = useState<string>(INITIAL_CARDS[0].id);

  // Status de Sincronização em Nuvem (Supabase)
  const [syncStatus, setSyncStatus] = useState<'online' | 'connecting' | 'offline'>('connecting');

  // Mês e Ano de Competência Selecionado
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth() + 1);
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());

  // Faturas e Parcelas
  const [invoices, setInvoices] = useState<Record<string, Invoice>>({});
  const [installments, setInstallments] = useState<Installment[]>([]);

  // Modais e Menu Mobile
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [cardModalData, setCardModalData] = useState<{ isOpen: boolean; card: CreditCard | null }>({
    isOpen: false,
    card: null,
  });
  const [personModalData, setPersonModalData] = useState<{
    isOpen: boolean;
    person: Person | 'new' | null;
  }>({
    isOpen: false,
    person: null,
  });
  const [installmentModalData, setInstallmentModalData] = useState<{
    isOpen: boolean;
    installment: Installment | null;
  }>({ isOpen: false, installment: null });
  const [splitModalData, setSplitModalData] = useState<{
    isOpen: boolean;
    installment: Installment | null;
  }>({ isOpen: false, installment: null });
  const [deletedInstallments, setDeletedInstallments] = useState<Installment[]>([]);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Ref para evitar loops ou condições de corrida durante sincronização
  const isSyncingRef = useRef(false);

  // 1. CARREGAMENTO INICIAL (OFFLINE-FIRST + SINCRONIZAÇÃO EM NUVEM)
  useEffect(() => {
    // Carrega instantaneamente do LocalStorage e da URL (preserva a tela exata no celular ao atualizar)
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const urlCard = searchParams.get('card');
      const urlMonth = searchParams.get('m');
      const urlYear = searchParams.get('y');

      const savedCardId = urlCard || localStorage.getItem('dgtech_selected_card_id');
      const savedMonth = urlMonth ? parseInt(urlMonth, 10) : parseInt(localStorage.getItem('dgtech_selected_month') || '', 10);
      const savedYear = urlYear ? parseInt(urlYear, 10) : parseInt(localStorage.getItem('dgtech_selected_year') || '', 10);

      if (savedCardId) setSelectedCardId(savedCardId);
      if (savedMonth && savedMonth >= 1 && savedMonth <= 12) setCurrentMonth(savedMonth);
      if (savedYear && savedYear >= 2020) setCurrentYear(savedYear);

      const savedCards = localStorage.getItem('dgtech_cards');
      if (savedCards) setCards(JSON.parse(savedCards));

      const savedPeople = localStorage.getItem('dgtech_people');
      if (savedPeople) setPeople(JSON.parse(savedPeople));

      const savedInvoices = localStorage.getItem('dgtech_invoices');
      if (savedInvoices) setInvoices(JSON.parse(savedInvoices));

      const savedInstallments = localStorage.getItem('dgtech_installments');
      if (savedInstallments) setInstallments(JSON.parse(savedInstallments));

      const savedDeleted = localStorage.getItem('dgtech_deleted_installments');
      if (savedDeleted) setDeletedInstallments(JSON.parse(savedDeleted));
    } catch (e) {
      console.error('Erro ao ler localStorage', e);
    }

    // Função de sincronização com o Supabase (instantânea, silenciosa e sem loops)
    const loadFromCloud = async () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;

      try {
        const cloudData = await fetchCloudData();

        if (!cloudData) {
          setSyncStatus('offline');
          isSyncingRef.current = false;
          return;
        }

        applyCloudData(cloudData);
      } catch (err) {
        console.error('Falha ao conectar na nuvem:', err);
        setSyncStatus('offline');
      } finally {
        isSyncingRef.current = false;
      }
    };

    const applyCloudData = (data: {
      cards: CreditCard[];
      people: Person[];
      invoices: Record<string, Invoice>;
      installments: Installment[];
    }) => {
      if (data.cards.length > 0) {
        setCards(data.cards);
        localStorage.setItem('dgtech_cards', JSON.stringify(data.cards));
      }
      if (data.people.length > 0) {
        setPeople(data.people);
        localStorage.setItem('dgtech_people', JSON.stringify(data.people));
      }
      setInvoices(data.invoices);
      localStorage.setItem('dgtech_invoices', JSON.stringify(data.invoices));
      setInstallments(data.installments);
      localStorage.setItem('dgtech_installments', JSON.stringify(data.installments));
      setSyncStatus('online');
    };

    // Executa busca na nuvem
    loadFromCloud();

    // 2. ASSINATURA EM TEMPO REAL (SUPABASE REALTIME)
    // Atualiza automaticamente quando houver alterações de outro celular/computador
    const unsubscribe = subscribeToCloudChanges(() => {
      console.log('🔄 Atualização remota recebida do Supabase! Sincronizando tela...');
      loadFromCloud();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Persiste a tela ativa (Cartão, Mês e Ano) na URL e no LocalStorage
  // Isso garante que ao puxar para baixo no celular (pull-to-refresh), a tela permaneça exatamente a mesma!
  useEffect(() => {
    try {
      localStorage.setItem('dgtech_selected_card_id', selectedCardId);
      localStorage.setItem('dgtech_selected_month', String(currentMonth));
      localStorage.setItem('dgtech_selected_year', String(currentYear));

      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        params.set('card', selectedCardId);
        params.set('m', String(currentMonth));
        params.set('y', String(currentYear));
        window.history.replaceState(null, '', `?${params.toString()}`);
      }
    } catch (e) {
      console.error(e);
    }
  }, [selectedCardId, currentMonth, currentYear]);

  // Helpers de persistência LocalStorage
  const saveCards = (newCards: CreditCard[]) => {
    setCards(newCards);
    localStorage.setItem('dgtech_cards', JSON.stringify(newCards));
  };

  const savePeople = (newPeople: Person[]) => {
    setPeople(newPeople);
    localStorage.setItem('dgtech_people', JSON.stringify(newPeople));
  };

  const saveInvoices = (newInvoices: Record<string, Invoice>) => {
    setInvoices(newInvoices);
    localStorage.setItem('dgtech_invoices', JSON.stringify(newInvoices));
  };

  const saveInstallments = (newInstallments: Installment[]) => {
    setInstallments(newInstallments);
    localStorage.setItem('dgtech_installments', JSON.stringify(newInstallments));
  };

  // Cartão Ativo (com busca inteligente por ID ou Nome para manter a seleção ao recarregar)
  const activeCard =
    cards.find((c) => c.id === selectedCardId) ||
    cards.find((c) => c.name.toLowerCase() === selectedCardId.toLowerCase()) ||
    cards[0];

  // Chave única para a fatura do cartão no mês/ano
  const invoiceKey = `${activeCard.id}_${currentYear}_${currentMonth}`;
  const existingInvoice = invoices[invoiceKey] || invoices[activeCard.id];

  // Calcula o status da fatura dinamicamente com base no Melhor Dia de Compras
  const computedStatus = calculateInvoiceStatus(
    activeCard,
    currentMonth,
    currentYear,
    existingInvoice?.status
  );

  const currentInvoice: Invoice = {
    id: existingInvoice?.id || invoiceKey,
    card_id: activeCard.id,
    month: currentMonth,
    year: currentYear,
    total_bank_amount: existingInvoice?.total_bank_amount || 0,
    status: computedStatus,
    pdf_url: existingInvoice?.pdf_url,
    notes: existingInvoice?.notes,
  };

  // Lançamentos da fatura atual (suporta tanto UUID do Supabase quanto chave composta)
  const rawCurrentInstallments = installments.filter(
    (i) =>
      i.invoice_id === currentInvoice.id ||
      i.invoice_id === invoiceKey ||
      (existingInvoice && i.invoice_id === existingInvoice.id)
  );

  // Garante integridade: desduplica estritamente por ID único sem descartar compras divididas
  const currentInstallments = React.useMemo(() => {
    const seenIds = new Set<string>();
    const result: Installment[] = [];

    rawCurrentInstallments.forEach((i) => {
      if (seenIds.has(i.id)) return;
      seenIds.add(i.id);
      result.push(i);
    });
    return result;
  }, [rawCurrentInstallments]);

  // Detecção inteligente de compras duplicadas na fatura atual
  const { duplicateIdsToRemove } = findDuplicatesInInvoice(currentInstallments);
  const duplicateCount = duplicateIdsToRemove.size;

  const handleCleanDuplicates = () => {
    const { cleanedInstallments, removedCount } = cleanInvoiceDuplicates(
      installments,
      currentInvoice.id
    );
    if (removedCount > 0) {
      saveInstallments(cleanedInstallments);
      // Apaga duplicatas do Supabase
      duplicateIdsToRemove.forEach((id) => cloudDeleteInstallment(id));
      alert(
        `🎉 Sucesso! ${removedCount} compra(s) duplicada(s) removida(s). Os valores foram normalizados e sincronizados.`
      );
    }
  };

  const handleClearCurrentInvoicePurchases = () => {
    const count = currentInstallments.length;
    if (count === 0) {
      alert('Não há compras registradas nesta fatura para limpar.');
      return;
    }

    const confirmed = window.confirm(
      `⚠️ Tem certeza que deseja apagar TODAS as ${count} compras identificadas desta fatura do cartão "${activeCard.name}" (${currentMonth.toString().padStart(2, '0')}/${currentYear})?\n\nIsso zerará as compras desta fatura para você recomeçar limpo.`
    );

    if (confirmed) {
      // Remove do Supabase
      currentInstallments.forEach((inst) => cloudDeleteInstallment(inst.id));
      const remaining = installments.filter(
        (i) =>
          i.invoice_id !== currentInvoice.id &&
          i.invoice_id !== invoiceKey &&
          (!existingInvoice || i.invoice_id !== existingInvoice.id)
      );
      saveInstallments(remaining);
      alert('✅ Todas as compras desta fatura foram limpas com sucesso na nuvem!');
    }
  };

  // Navegação Mês a Mês
  const handleChangeMonth = (delta: number) => {
    let nextM = currentMonth + delta;
    let nextY = currentYear;
    if (nextM > 12) {
      nextM = 1;
      nextY += 1;
    } else if (nextM < 1) {
      nextM = 12;
      nextY -= 1;
    }
    setCurrentMonth(nextM);
    setCurrentYear(nextY);
  };

  // 1. Edição e Salvamento de Cartão (Local + Nuvem)
  const handleSaveCard = async (updatedCard: CreditCard) => {
    const exists = cards.some((c) => c.id === updatedCard.id);
    let nextCards: CreditCard[];
    if (exists) {
      nextCards = cards.map((c) => (c.id === updatedCard.id ? updatedCard : c));
    } else {
      nextCards = [...cards, updatedCard];
    }
    saveCards(nextCards);
    await cloudSaveCard(updatedCard);
  };

  const handleDeleteCard = (cardId: string) => {
    const nextCards = cards.filter((c) => c.id !== cardId);
    saveCards(nextCards);
    if (selectedCardId === cardId && nextCards.length > 0) {
      setSelectedCardId(nextCards[0].id);
    }
  };

  // 2. Atualizar Valor Total da Fatura do Banco (Local + Nuvem)
  const handleUpdateInvoiceTotal = async (newTotal: number) => {
    const updatedInvoice: Invoice = {
      ...currentInvoice,
      total_bank_amount: newTotal,
    };
    saveInvoices({
      ...invoices,
      [invoiceKey]: updatedInvoice,
      [currentInvoice.id]: updatedInvoice,
    });
    await cloudUpdateInvoice(activeCard.id, currentMonth, currentYear, {
      total_bank_amount: newTotal,
    });
  };

  const handleUpdateInvoiceStatus = async (newStatus: 'aberta' | 'fechada' | 'paga') => {
    const updatedInvoice: Invoice = {
      ...currentInvoice,
      status: newStatus,
    };
    saveInvoices({
      ...invoices,
      [invoiceKey]: updatedInvoice,
      [currentInvoice.id]: updatedInvoice,
    });
    await cloudUpdateInvoice(activeCard.id, currentMonth, currentYear, {
      status: newStatus,
    });
  };

  // 3. Atribuir Comprador na Triagem (Local + Nuvem em Tempo Real)
  const handleAssignDebtor = async (installmentId: string, personId: string) => {
    const target = installments.find((i) => i.id === installmentId);
    if (!target) return;

    // Detecta se esta parcela faz parte de uma compra dividida (múltiplas pessoas na mesma compra)
    const isSplitBrother =
      target.purchase_id &&
      installments.some(
        (other) =>
          other.purchase_id === target.purchase_id &&
          other.installment_number === target.installment_number &&
          other.id !== target.id
      );

    // Atualização otimista imediata: nunca altera o devedor da outra pessoa na compra dividida
    const updated = installments.map((i) => {
      if (i.id === installmentId) {
        return { ...i, person_id: personId };
      }
      // Se não for compra dividida, propaga para parcelas futuras da mesma compra
      if (
        !isSplitBrother &&
        i.purchase_id &&
        i.purchase_id === target.purchase_id &&
        i.installment_number > target.installment_number
      ) {
        return { ...i, person_id: personId };
      }
      return i;
    });

    saveInstallments(updated);

    // Salva na nuvem
    await cloudAssignDebtor(installmentId, personId);
  };

  const handleUnassignDebtor = async (installmentId: string) => {
    const updated = installments.map((i) =>
      i.id === installmentId ? { ...i, person_id: null } : i
    );
    saveInstallments(updated);
    await cloudAssignDebtor(installmentId, null);
  };

  // 4. Salvar ou Adicionar Lançamento Manual / Edição (Local + Nuvem)
  const handleSaveInstallment = async (data: Partial<Installment>) => {
    if (data.id) {
      // Edição
      const updated = installments.map((i) =>
        i.id === data.id
          ? {
              ...i,
              description: data.description || i.description,
              person_id: data.person_id !== undefined ? data.person_id : i.person_id,
              amount: data.amount !== undefined ? data.amount : i.amount,
              installment_number: data.installment_number || i.installment_number,
              total_installments: data.total_installments || i.total_installments,
              purchase_date: data.purchase_date || i.purchase_date,
              notes: data.notes || i.notes,
            }
          : i
      );
      saveInstallments(updated);

      const targetInst = updated.find((i) => i.id === data.id);
      if (targetInst) {
        await cloudSaveInstallment(targetInst, activeCard.id, currentMonth, currentYear);
      }
    } else {
      // Novo Lançamento
      const newInstId = 'inst_' + Date.now();
      const newPurchaseId = 'pur_' + Date.now();
      const newInst: Installment = {
        id: newInstId,
        invoice_id: currentInvoice.id,
        purchase_id: newPurchaseId,
        person_id: data.person_id || null,
        description: data.description || 'Compra Manual',
        amount: data.amount || 0,
        installment_number: data.installment_number || 1,
        total_installments: data.total_installments || 1,
        status: 'pendente',
        purchase_date: data.purchase_date || new Date().toISOString().slice(0, 10),
        notes: data.notes,
      };

      const futureInstallments: Installment[] = [];
      if (newInst.total_installments > 1 && newInst.installment_number < newInst.total_installments) {
        const remaining = newInst.total_installments - newInst.installment_number;
        for (let step = 1; step <= remaining; step++) {
          let futM = currentMonth + step;
          let futY = currentYear;
          while (futM > 12) {
            futM -= 12;
            futY += 1;
          }
          const futInvoiceKey = `${activeCard.id}_${futY}_${futM}`;
          futureInstallments.push({
            id: `inst_${Date.now()}_${step}`,
            invoice_id: futInvoiceKey,
            purchase_id: newPurchaseId,
            person_id: data.person_id || null,
            description: data.description || 'Compra Manual',
            amount: data.amount || 0,
            installment_number: newInst.installment_number + step,
            total_installments: newInst.total_installments,
            status: 'pendente',
            purchase_date: newInst.purchase_date,
            notes: newInst.notes,
          });
        }
      }

      saveInstallments([...installments, newInst, ...futureInstallments]);
      await cloudSaveInstallment(newInst, activeCard.id, currentMonth, currentYear);
    }
  };

  const handleDeleteInstallment = async (id: string) => {
    const target = installments.find((i) => i.id === id);
    if (target) {
      const updatedDeleted = [target, ...deletedInstallments];
      setDeletedInstallments(updatedDeleted);
      localStorage.setItem('dgtech_deleted_installments', JSON.stringify(updatedDeleted));
    }
    saveInstallments(installments.filter((i) => i.id !== id));
    await cloudDeleteInstallment(id);
  };

  const handleRestoreInstallment = async (id: string) => {
    const target = deletedInstallments.find((i) => i.id === id);
    if (target) {
      const remainingDeleted = deletedInstallments.filter((i) => i.id !== id);
      setDeletedInstallments(remainingDeleted);
      localStorage.setItem('dgtech_deleted_installments', JSON.stringify(remainingDeleted));
      saveInstallments([...installments, target]);
      await cloudSaveInstallment(target, activeCard.id, currentMonth, currentYear);
    }
  };

  // 5. Salvar Pessoas / Devedores (Local + Nuvem)
  const handleSavePeople = async (updatedPeople: Person[]) => {
    savePeople(updatedPeople);
    for (const p of updatedPeople) {
      await cloudSavePerson(p);
    }
  };

  // 6. Importação Inteligente e Conciliação da Fatura (Local + Nuvem em Tempo Real)
  const handleConfirmImport = async (extracted: ExtractedInvoiceData) => {
    const newTotal = extracted.total_amount || 0;
    const updatedInvoice: Invoice = {
      ...currentInvoice,
      total_bank_amount: newTotal > 0 ? newTotal : currentInvoice.total_bank_amount,
    };

    const existingInThisInvoice = currentInstallments;
    const otherInvoicesInstallments = installments.filter(
      (i) =>
        i.invoice_id !== currentInvoice.id &&
        i.invoice_id !== invoiceKey &&
        (!existingInvoice || i.invoice_id !== existingInvoice.id)
    );

    // Conciliação estrita com ordem de critérios:
    // 1. Valor da Prestação -> 2. Data de Compra -> 3. Número de Prestação
    const reconciliation = reconcileInvoiceItems(extracted.items || [], existingInThisInvoice);

    const matchUpdates = new Map<string, { newDesc: string; newDate?: string }>();
    const purchaseIdsToSyncName = new Set<string>();

    reconciliation.matches.forEach((m) => {
      matchUpdates.set(m.existing.id, {
        newDesc: m.extractedItem.description,
        newDate: m.extractedItem.date,
      });
      if (m.existing.purchase_id) {
        purchaseIdsToSyncName.add(m.existing.purchase_id);
      }
    });

    // Atualiza lançamentos existentes desta fatura:
    // CORRIGE o nome do estabelecimento para o nome oficial da fatura,
    // PRESERVANDO 100% dos compradores (person_id), parcelas e status
    const updatedInvoiceItems: Installment[] = existingInThisInvoice.map((inst) => {
      const update = matchUpdates.get(inst.id);
      if (update) {
        return {
          ...inst,
          description: update.newDesc,
          purchase_date: update.newDate || inst.purchase_date,
        };
      }
      return inst;
    });

    // Sincroniza o novo nome também nas parcelas futuras da mesma compra
    const updatedOtherInstallments: Installment[] = otherInvoicesInstallments.map((inst) => {
      if (inst.purchase_id && purchaseIdsToSyncName.has(inst.purchase_id)) {
        const matched = reconciliation.matches.find(
          (m) => m.existing.purchase_id === inst.purchase_id
        );
        if (matched) {
          return {
            ...inst,
            description: matched.extractedItem.description,
          };
        }
      }
      return inst;
    });

    // Insere compras novas
    const newFutureInstallments: Installment[] = [];
    reconciliation.newItems.forEach((item, index) => {
      const purchaseId = `pur_${Date.now()}_${index}`;
      const newInst: Installment = {
        id: `inst_${Date.now()}_${index}`,
        invoice_id: currentInvoice.id,
        purchase_id: purchaseId,
        person_id: null,
        description: item.description,
        amount: item.amount,
        installment_number: item.current_installment,
        total_installments: item.total_installments,
        status: 'pendente',
        purchase_date: item.date || new Date().toISOString().slice(0, 10),
      };

      updatedInvoiceItems.push(newInst);

      if (item.total_installments > 1 && item.current_installment < item.total_installments) {
        const remaining = item.total_installments - item.current_installment;
        for (let step = 1; step <= remaining; step++) {
          let futM = currentMonth + step;
          let futY = currentYear;
          while (futM > 12) {
            futM -= 12;
            futY += 1;
          }
          const futInvoiceKey = `${activeCard.id}_${futY}_${futM}`;
          newFutureInstallments.push({
            id: `inst_${Date.now()}_${index}_${step}`,
            invoice_id: futInvoiceKey,
            purchase_id: purchaseId,
            person_id: null,
            description: item.description,
            amount: item.amount,
            installment_number: item.current_installment + step,
            total_installments: item.total_installments,
            status: 'pendente',
            purchase_date: item.date || new Date().toISOString().slice(0, 10),
          });
        }
      }
    });

    // Salva localmente
    saveInvoices({
      ...invoices,
      [invoiceKey]: updatedInvoice,
      [currentInvoice.id]: updatedInvoice,
    });
    saveInstallments([
      ...updatedOtherInstallments,
      ...updatedInvoiceItems,
      ...newFutureInstallments,
    ]);

    // Salva na nuvem (Supabase)
    await cloudSyncImportInvoice({
      cardId: activeCard.id,
      month: currentMonth,
      year: currentYear,
      totalAmount: newTotal,
      matches: reconciliation.matches,
      newItems: reconciliation.newItems,
    });
  };

  // 7. Dividir Compra entre 2 ou mais pessoas
  const handleConfirmSplit = async (
    originalInstallment: Installment,
    splits: Array<{ person_id: string; amount: number; person_name: string }>,
    applyToFuture: boolean
  ) => {
    const newFracionadas: Installment[] = splits.map((s, index) => ({
      id: `inst_split_${Date.now()}_${index}`,
      invoice_id: originalInstallment.invoice_id,
      purchase_id: originalInstallment.purchase_id,
      person_id: s.person_id,
      description: `${originalInstallment.description} (${s.person_name})`,
      amount: s.amount,
      installment_number: originalInstallment.installment_number,
      total_installments: originalInstallment.total_installments,
      status: originalInstallment.status,
      purchase_date: originalInstallment.purchase_date,
      notes: originalInstallment.notes,
    }));

    let updatedList = installments.filter((i) => i.id !== originalInstallment.id);

    if (applyToFuture && originalInstallment.purchase_id) {
      const futureItems = updatedList.filter(
        (i) =>
          i.purchase_id === originalInstallment.purchase_id &&
          i.installment_number > originalInstallment.installment_number
      );

      const futureIdsToRemove = new Set(futureItems.map((f) => f.id));
      updatedList = updatedList.filter((i) => !futureIdsToRemove.has(i.id));

      futureItems.forEach((futItem) => {
        splits.forEach((s, sIdx) => {
          newFracionadas.push({
            id: `inst_split_fut_${futItem.id}_${sIdx}`,
            invoice_id: futItem.invoice_id,
            purchase_id: futItem.purchase_id,
            person_id: s.person_id,
            description: `${futItem.description} (${s.person_name})`,
            amount: s.amount,
            installment_number: futItem.installment_number,
            total_installments: futItem.total_installments,
            status: futItem.status,
            purchase_date: futItem.purchase_date,
            notes: futItem.notes,
          });
        });
      });
    }

    saveInstallments([...updatedList, ...newFracionadas]);

    // Sincroniza divisão na nuvem
    await cloudDeleteInstallment(originalInstallment.id);
    for (const f of newFracionadas) {
      await cloudSaveInstallment(f, activeCard.id, currentMonth, currentYear);
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-950 overflow-hidden">
      {/* Sidebar com Menu Hambúrguer e Status da Nuvem */}
      <Sidebar
        cards={cards}
        selectedCardId={activeCard.id}
        onSelectCard={(id) => setSelectedCardId(id)}
        people={people}
        onOpenEditCard={(card) => setCardModalData({ isOpen: true, card })}
        onOpenManagePeople={() => setPersonModalData({ isOpen: true, person: null })}
        onOpenNewPerson={() => setPersonModalData({ isOpen: true, person: 'new' })}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        currentMonth={currentMonth}
        currentYear={currentYear}
        syncStatus={syncStatus}
      />

      {/* Área Principal do Cartão e Fatura */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-80 h-full">
        <InvoiceView
          card={activeCard}
          people={people}
          invoice={currentInvoice}
          installments={currentInstallments}
          allInstallments={installments}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          onOpenEditCard={(card) => setCardModalData({ isOpen: true, card })}
          onOpenUpload={() => setIsUploadOpen(true)}
          onOpenNewInstallment={() => setInstallmentModalData({ isOpen: true, installment: null })}
          onOpenEditInstallment={(inst) => setInstallmentModalData({ isOpen: true, installment: inst })}
          onDeleteInstallment={handleDeleteInstallment}
          onAssignDebtor={handleAssignDebtor}
          onUpdateInvoiceTotal={handleUpdateInvoiceTotal}
          onChangeMonth={handleChangeMonth}
          onOpenManagePeople={() => setPersonModalData({ isOpen: true, person: null })}
          onOpenNewPerson={() => setPersonModalData({ isOpen: true, person: 'new' })}
          onEditPerson={(person) => setPersonModalData({ isOpen: true, person })}
          onOpenSplitInstallment={(inst) => setSplitModalData({ isOpen: true, installment: inst })}
          deletedInstallments={deletedInstallments}
          onRestoreInstallment={handleRestoreInstallment}
          onUnassignDebtor={handleUnassignDebtor}
          duplicateCount={duplicateCount}
          onCleanDuplicates={handleCleanDuplicates}
          onClearInvoicePurchases={handleClearCurrentInvoicePurchases}
          onUpdateInvoiceStatus={handleUpdateInvoiceStatus}
        />
      </div>

      {/* Modais de Edição e Salvamento */}
      <EditCardModal
        card={cardModalData.card}
        isOpen={cardModalData.isOpen}
        onClose={() => setCardModalData({ isOpen: false, card: null })}
        onSave={handleSaveCard}
        onDelete={handleDeleteCard}
      />

      <EditPersonModal
        people={people}
        isOpen={personModalData.isOpen}
        initialPerson={personModalData.person}
        onClose={() => setPersonModalData({ isOpen: false, person: null })}
        onSavePeople={handleSavePeople}
      />

      <EditInstallmentModal
        installment={installmentModalData.installment}
        people={people}
        isOpen={installmentModalData.isOpen}
        onClose={() => setInstallmentModalData({ isOpen: false, installment: null })}
        onSave={handleSaveInstallment}
        onDelete={handleDeleteInstallment}
        onOpenNewPerson={() => setPersonModalData({ isOpen: true, person: 'new' })}
      />

      <UploadModal
        card={activeCard}
        month={currentMonth}
        year={currentYear}
        people={people}
        existingInstallments={currentInstallments}
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onConfirmImport={handleConfirmImport}
      />

      <SplitPurchaseModal
        installment={splitModalData.installment}
        people={people}
        isOpen={splitModalData.isOpen}
        onClose={() => setSplitModalData({ isOpen: false, installment: null })}
        onConfirmSplit={handleConfirmSplit}
        onOpenNewPerson={() => setPersonModalData({ isOpen: true, person: 'new' })}
      />
    </div>
  );
}
