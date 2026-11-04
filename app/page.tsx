'use client';

import React, { useState, useEffect } from 'react';
import { CreditCard, Person, Invoice, Installment, ExtractedInvoiceData } from '@/lib/types';
import { INITIAL_CARDS, INITIAL_PEOPLE } from '@/lib/storage';
import { Sidebar } from '@/components/Sidebar';
import { InvoiceView } from '@/components/InvoiceView';
import { EditCardModal } from '@/components/EditCardModal';
import { EditPersonModal } from '@/components/EditPersonModal';
import { EditInstallmentModal } from '@/components/EditInstallmentModal';
import { UploadModal } from '@/components/UploadModal';
import { SplitPurchaseModal } from '@/components/SplitPurchaseModal';

export default function HomePage() {
  // Estado de Dados
  const [cards, setCards] = useState<CreditCard[]>(INITIAL_CARDS);
  const [people, setPeople] = useState<Person[]>(INITIAL_PEOPLE);
  const [selectedCardId, setSelectedCardId] = useState<string>(INITIAL_CARDS[0].id);

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

  // Carregar dados salvos do LocalStorage na inicialização com Deduplicação Segura
  useEffect(() => {
    try {
      const savedCards = localStorage.getItem('dgtech_cards');
      if (savedCards) setCards(JSON.parse(savedCards));

      let currentPeople = INITIAL_PEOPLE;
      const savedPeople = localStorage.getItem('dgtech_people');
      if (savedPeople) currentPeople = JSON.parse(savedPeople);

      let currentInstallments: Installment[] = [];
      const savedInstallments = localStorage.getItem('dgtech_installments');
      if (savedInstallments) currentInstallments = JSON.parse(savedInstallments);

      const savedInvoices = localStorage.getItem('dgtech_invoices');
      if (savedInvoices) setInvoices(JSON.parse(savedInvoices));

      const savedDeleted = localStorage.getItem('dgtech_deleted_installments');
      if (savedDeleted) setDeletedInstallments(JSON.parse(savedDeleted));

      // DEDUPLICAÇÃO INTELIGENTE E NÃO-DESTRUTIVA DE PESSOAS COM NOMES REPETIDOS
      const seenNames = new Map<string, Person>();
      const uniquePeopleList: Person[] = [];
      const idRedirectMap = new Map<string, string>();

      currentPeople.forEach((p) => {
        const norm = p.name.trim().toLowerCase();
        if (!seenNames.has(norm)) {
          seenNames.set(norm, p);
          uniquePeopleList.push(p);
        } else {
          // Pessoa duplicada encontrada! Redireciona compras para o ID original
          const canonical = seenNames.get(norm)!;
          idRedirectMap.set(p.id, canonical.id);
        }
      });

      // Se havia cadastros duplicados do mesmo comprador, unifica as parcelas sem perder nenhuma
      if (idRedirectMap.size > 0) {
        currentInstallments = currentInstallments.map((inst) => {
          if (inst.person_id && idRedirectMap.has(inst.person_id)) {
            return { ...inst, person_id: idRedirectMap.get(inst.person_id)! };
          }
          return inst;
        });
        currentPeople = uniquePeopleList;
        localStorage.setItem('dgtech_people', JSON.stringify(currentPeople));
        localStorage.setItem('dgtech_installments', JSON.stringify(currentInstallments));
      }

      setPeople(currentPeople);
      setInstallments(currentInstallments);
    } catch (e) {
      console.error('Erro ao ler localStorage', e);
    }
  }, []);

  // Salvar no LocalStorage sempre que houver alteração
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

  // Cartão Ativo
  const activeCard = cards.find((c) => c.id === selectedCardId) || cards[0];

  // Chave única para a fatura do cartão no mês/ano
  const invoiceKey = `${activeCard.id}_${currentYear}_${currentMonth}`;
  const currentInvoice: Invoice = invoices[invoiceKey] || {
    id: invoiceKey,
    card_id: activeCard.id,
    month: currentMonth,
    year: currentYear,
    total_bank_amount: 0,
    status: 'aberta',
  };

  // Lançamentos da fatura atual
  const currentInstallments = installments.filter((i) => i.invoice_id === currentInvoice.id);

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

  // 1. Edição e Salvamento de Cartão
  const handleSaveCard = (updatedCard: CreditCard) => {
    const exists = cards.some((c) => c.id === updatedCard.id);
    let nextCards: CreditCard[];
    if (exists) {
      nextCards = cards.map((c) => (c.id === updatedCard.id ? updatedCard : c));
    } else {
      nextCards = [...cards, updatedCard];
      setSelectedCardId(updatedCard.id);
    }
    saveCards(nextCards);
  };

  const handleDeleteCard = (cardId: string) => {
    const nextCards = cards.filter((c) => c.id !== cardId);
    saveCards(nextCards);
    if (selectedCardId === cardId && nextCards.length > 0) {
      setSelectedCardId(nextCards[0].id);
    }
  };

  // 2. Atualizar Valor Total da Fatura do Banco
  const handleUpdateInvoiceTotal = (newTotal: number) => {
    const updatedInvoice: Invoice = {
      ...currentInvoice,
      total_bank_amount: newTotal,
    };
    saveInvoices({
      ...invoices,
      [invoiceKey]: updatedInvoice,
    });
  };

  // 3. Atribuir Comprador na Triagem (com memória para futuras parcelas)
  const handleAssignDebtor = (installmentId: string, personId: string) => {
    const target = installments.find((i) => i.id === installmentId);
    if (!target) return;

    // Atualiza esta parcela
    const updated = installments.map((i) => {
      if (i.id === installmentId) {
        return { ...i, person_id: personId };
      }
      // Se for a mesma compra em faturas futuras, vincula também
      if (i.purchase_id && i.purchase_id === target.purchase_id) {
        return { ...i, person_id: personId };
      }
      return i;
    });

    saveInstallments(updated);
  };

  // 4. Salvar ou Adicionar Lançamento Manual / Edição
  const handleSaveInstallment = (data: Partial<Installment>) => {
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

      // Cria parcelas futuras automaticamente se for parcelado!
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
    }
  };

  const handleDeleteInstallment = (id: string) => {
    const target = installments.find((i) => i.id === id);
    if (target) {
      const updatedDeleted = [target, ...deletedInstallments];
      setDeletedInstallments(updatedDeleted);
      localStorage.setItem('dgtech_deleted_installments', JSON.stringify(updatedDeleted));
    }
    saveInstallments(installments.filter((i) => i.id !== id));
  };

  const handleRestoreInstallment = (id: string) => {
    const target = deletedInstallments.find((i) => i.id === id);
    if (target) {
      const remainingDeleted = deletedInstallments.filter((i) => i.id !== id);
      setDeletedInstallments(remainingDeleted);
      localStorage.setItem('dgtech_deleted_installments', JSON.stringify(remainingDeleted));
      saveInstallments([...installments, target]);
    }
  };

  const handleUnassignDebtor = (installmentId: string) => {
    const updated = installments.map((i) =>
      i.id === installmentId ? { ...i, person_id: null } : i
    );
    saveInstallments(updated);
  };

  // 5. Importação Inteligente e Não-Destrutiva da Fatura (Preserva tudo o que já foi atribuído)
  const handleConfirmImport = (extracted: ExtractedInvoiceData) => {
    // 1. Atualiza valor total da fatura
    const newTotal = extracted.total_amount || 0;
    const updatedInvoice: Invoice = {
      ...currentInvoice,
      total_bank_amount: newTotal > 0 ? newTotal : currentInvoice.total_bank_amount,
    };

    // 2. Itens já existentes nesta fatura e em outras faturas
    const existingInThisInvoice = installments.filter((i) => i.invoice_id === currentInvoice.id);
    const otherInvoicesInstallments = installments.filter((i) => i.invoice_id !== currentInvoice.id);

    // Mantém todos os itens que você já lançou e atribuiu
    const updatedInvoiceItems: Installment[] = [...existingInThisInvoice];
    let newItemsAddedCount = 0;

    extracted.items?.forEach((item, index) => {
      const cleanDesc = item.description.trim().toLowerCase();

      // Verifica se este item já existe na fatura para NUNCA duplicar
      const alreadyExists = existingInThisInvoice.find((existing) => {
        const existingDesc = (existing.description || '').trim().toLowerCase();
        const sameDesc = existingDesc.includes(cleanDesc) || cleanDesc.includes(existingDesc);
        const sameAmount = Math.abs(existing.amount - item.amount) < 0.05;
        const sameInst = existing.installment_number === item.current_installment;
        return (sameDesc && sameAmount && sameInst) || (sameDesc && sameAmount);
      });

      if (alreadyExists) {
        // Já existe! Preserva 100% dos dados, do comprador atribuído e das divisões
        return;
      }

      // É um item novo ou que estava faltando (ex: RV MAKES):
      // Tenta buscar no histórico se alguém já comprou nessa mesma loja
      const historyMatch = installments.find(
        (i) => i.person_id && (i.description || '').toLowerCase().includes(cleanDesc)
      );

      const purchaseId = `pur_${Date.now()}_${index}`;
      updatedInvoiceItems.push({
        id: `inst_${Date.now()}_${index}`,
        invoice_id: currentInvoice.id,
        purchase_id: purchaseId,
        person_id: historyMatch ? historyMatch.person_id : null,
        description: item.description,
        amount: item.amount,
        installment_number: item.current_installment,
        total_installments: item.total_installments,
        status: 'pendente',
        purchase_date: item.date || new Date().toISOString().slice(0, 10),
      });
      newItemsAddedCount++;
    });

    saveInvoices({
      ...invoices,
      [invoiceKey]: updatedInvoice,
    });

    saveInstallments([...otherInvoicesInstallments, ...updatedInvoiceItems]);
  };

  // 6. Dividir Compra entre 2 ou mais pessoas
  const handleConfirmSplit = (
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
  };

  return (
    <div className="flex h-screen w-full bg-slate-950 overflow-hidden">
      {/* Sidebar com Menu Hambúrguer */}
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
        onSavePeople={savePeople}
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
