import { supabase, isSupabaseConfigured } from './supabase';
import { CreditCard, Person, Invoice, Installment, ExtractedInvoiceData } from './types';

export interface CloudSyncState {
  status: 'online' | 'connecting' | 'offline';
  lastSyncedAt: Date | null;
  error: string | null;
}

/**
 * Carrega todos os dados do Supabase na nuvem
 */
export async function fetchCloudData(): Promise<{
  cards: CreditCard[];
  people: Person[];
  invoices: Record<string, Invoice>;
  installments: Installment[];
} | null> {
  if (!supabase || !isSupabaseConfigured) return null;

  try {
    const [cardsRes, peopleRes, invoicesRes, installmentsRes] = await Promise.all([
      supabase.from('cards').select('*').order('name'),
      supabase.from('people').select('*').order('name'),
      supabase.from('invoices').select('*'),
      supabase
        .from('installments')
        .select(`
          id,
          invoice_id,
          purchase_id,
          person_id,
          installment_number,
          total_installments,
          amount,
          status,
          notes,
          purchase:purchases (
            id,
            card_id,
            description,
            purchase_date,
            total_installments,
            total_amount
          )
        `),
    ]);

    if (cardsRes.error || peopleRes.error || invoicesRes.error || installmentsRes.error) {
      console.warn('Erro ao buscar dados do Supabase:', {
        cardsErr: cardsRes.error,
        peopleErr: peopleRes.error,
        invoicesErr: invoicesRes.error,
        installmentsErr: installmentsRes.error,
      });
      return null;
    }

    const cards: CreditCard[] = (cardsRes.data || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      due_day: c.due_day,
      best_day: c.best_day,
      credit_limit: c.credit_limit ? Number(c.credit_limit) : null,
      bank: c.bank || undefined,
      color: c.color || '#4F46E5',
      is_active: c.is_active ?? true,
    }));

    const people: Person[] = (peopleRes.data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      phone: p.phone || undefined,
      color: p.color || '#10B981',
      notes: p.notes || undefined,
      is_active: p.is_active ?? true,
    }));

    const invoices: Record<string, Invoice> = {};
    (invoicesRes.data || []).forEach((inv: any) => {
      const invObj: Invoice = {
        id: inv.id,
        card_id: inv.card_id,
        month: inv.month,
        year: inv.year,
        due_date: inv.due_date || undefined,
        total_bank_amount: Number(inv.total_bank_amount || 0),
        status: inv.status || 'aberta',
        pdf_url: inv.pdf_url || undefined,
        notes: inv.notes || undefined,
      };
      // Permite lookup tanto pelo UUID quanto pela chave composta (cardId_year_month)
      invoices[inv.id] = invObj;
      invoices[`${inv.card_id}_${inv.year}_${inv.month}`] = invObj;
    });

    const installments: Installment[] = (installmentsRes.data || []).map((inst: any) => {
      const pur = Array.isArray(inst.purchase) ? inst.purchase[0] : inst.purchase;
      return {
        id: inst.id,
        invoice_id: inst.invoice_id,
        purchase_id: inst.purchase_id,
        person_id: inst.person_id || null,
        installment_number: inst.installment_number || 1,
        total_installments: inst.total_installments || 1,
        amount: Number(inst.amount || 0),
        status: inst.status || 'pendente',
        notes: inst.notes || undefined,
        description: pur?.description || 'Compra',
        purchase_date: pur?.purchase_date || undefined,
      };
    });

    return { cards, people, invoices, installments };
  } catch (err) {
    console.error('Falha inesperada ao conectar ao Supabase:', err);
    return null;
  }
}

/**
 * Garante que uma fatura exista no Supabase e retorna seu ID UUID
 */
export async function getOrCreateCloudInvoice(
  cardId: string,
  month: number,
  year: number,
  totalBankAmount: number = 0,
  status: 'aberta' | 'fechada' | 'paga' = 'aberta'
): Promise<string | null> {
  if (!supabase || !isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from('invoices')
      .upsert(
        {
          card_id: cardId,
          month,
          year,
          total_bank_amount: totalBankAmount,
          status,
        },
        { onConflict: 'card_id,month,year' }
      )
      .select('id')
      .single();

    if (error || !data) {
      console.error('Erro ao upsert fatura:', error);
      return null;
    }

    return data.id;
  } catch (e) {
    console.error('Exceção ao upsert fatura:', e);
    return null;
  }
}

/**
 * Salva ou atualiza um cartão no Supabase
 */
export async function cloudSaveCard(card: Partial<CreditCard> & { name: string }): Promise<CreditCard | null> {
  if (!supabase || !isSupabaseConfigured) return null;

  const payload: any = {
    name: card.name,
    due_day: card.due_day ?? null,
    best_day: card.best_day ?? null,
    credit_limit: card.credit_limit ?? null,
    color: card.color || '#4F46E5',
    is_active: card.is_active ?? true,
  };
  if (card.id && card.id.length > 20) {
    payload.id = card.id;
  }

  const { data, error } = await supabase
    .from('cards')
    .upsert(payload, { onConflict: 'name' })
    .select()
    .single();

  if (error || !data) {
    console.error('Erro ao salvar cartão na nuvem:', error);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    due_day: data.due_day,
    best_day: data.best_day,
    credit_limit: data.credit_limit ? Number(data.credit_limit) : null,
    bank: data.bank || undefined,
    color: data.color,
    is_active: data.is_active,
  };
}

/**
 * Salva ou atualiza uma pessoa/devedor no Supabase
 */
export async function cloudSavePerson(person: Partial<Person> & { name: string }): Promise<Person | null> {
  if (!supabase || !isSupabaseConfigured) return null;

  const payload: any = {
    name: person.name,
    phone: person.phone || null,
    color: person.color || '#10B981',
    notes: person.notes || null,
    is_active: person.is_active ?? true,
  };
  if (person.id && person.id.length > 20 && !person.id.startsWith('p')) {
    payload.id = person.id;
  }

  const { data, error } = await supabase
    .from('people')
    .upsert(payload)
    .select()
    .single();

  if (error || !data) {
    console.error('Erro ao salvar pessoa no Supabase:', error);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    phone: data.phone || undefined,
    color: data.color,
    notes: data.notes || undefined,
    is_active: data.is_active,
  };
}

/**
 * Deleta uma pessoa no Supabase
 */
export async function cloudDeletePerson(personId: string): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured) return false;
  const { error } = await supabase.from('people').delete().eq('id', personId);
  return !error;
}

/**
 * Atualiza status ou valor de uma fatura
 */
export async function cloudUpdateInvoice(
  cardId: string,
  month: number,
  year: number,
  updates: Partial<Invoice>
): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured) return false;

  try {
    const payload: any = {
      card_id: cardId,
      month,
      year,
    };
    if (updates.status) payload.status = updates.status;
    if (updates.total_bank_amount !== undefined) payload.total_bank_amount = updates.total_bank_amount;
    if (updates.notes !== undefined) payload.notes = updates.notes;

    const { error } = await supabase
      .from('invoices')
      .upsert(payload, { onConflict: 'card_id,month,year' });

    return !error;
  } catch {
    return false;
  }
}

/**
 * Cria ou atualiza um lançamento com sua compra no Supabase
 */
export async function cloudSaveInstallment(
  installment: Installment,
  cardId: string,
  month: number,
  year: number
): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured) return false;

  try {
    // 1. Garante a fatura na nuvem
    let cloudInvoiceId = installment.invoice_id;
    if (!cloudInvoiceId || cloudInvoiceId.includes('_') || cloudInvoiceId.length < 20) {
      cloudInvoiceId = (await getOrCreateCloudInvoice(cardId, month, year)) || '';
    }

    if (!cloudInvoiceId) return false;

    // 2. Atualiza ou cria a compra correspondente
    let purchaseId = installment.purchase_id;
    const isTempPurchaseId = !purchaseId || purchaseId.startsWith('pur_') || purchaseId.length < 20;

    if (isTempPurchaseId) {
      const { data: purData, error: purErr } = await supabase
        .from('purchases')
        .insert({
          card_id: cardId,
          person_id: installment.person_id && installment.person_id.length > 20 ? installment.person_id : null,
          description: installment.description || 'Compra',
          purchase_date: installment.purchase_date || null,
          total_installments: installment.total_installments || 1,
          total_amount: (installment.amount || 0) * (installment.total_installments || 1),
        })
        .select('id')
        .single();

      if (purErr || !purData) {
        console.error('Erro ao criar purchase na nuvem:', purErr);
        return false;
      }
      purchaseId = purData.id;
    } else {
      // Atualiza descrição e data na compra
      await supabase
        .from('purchases')
        .update({
          description: installment.description,
          purchase_date: installment.purchase_date || null,
          person_id: installment.person_id && installment.person_id.length > 20 ? installment.person_id : null,
        })
        .eq('id', purchaseId);
    }

    // 3. Atualiza ou cria a parcela
    const isTempInstId = !installment.id || installment.id.startsWith('inst_') || installment.id.length < 20;
    const instPayload: any = {
      invoice_id: cloudInvoiceId,
      purchase_id: purchaseId,
      person_id: installment.person_id && installment.person_id.length > 20 ? installment.person_id : null,
      installment_number: installment.installment_number || 1,
      total_installments: installment.total_installments || 1,
      amount: installment.amount || 0,
      status: installment.status || 'pendente',
      notes: installment.notes || null,
    };

    if (!isTempInstId) {
      instPayload.id = installment.id;
    }

    const { error: instErr } = await supabase
      .from('installments')
      .upsert(instPayload);

    return !instErr;
  } catch (e) {
    console.error('Exceção ao salvar parcela na nuvem:', e);
    return false;
  }
}

/**
 * Remove uma parcela no Supabase
 */
export async function cloudDeleteInstallment(installmentId: string): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured) return false;
  const { error } = await supabase.from('installments').delete().eq('id', installmentId);
  return !error;
}

/**
 * Atualiza o comprador de uma parcela no Supabase
 */
export async function cloudAssignDebtor(
  installmentId: string,
  personId: string | null
): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured) return false;
  const validPersonId = personId && personId.length > 20 ? personId : null;
  const { error } = await supabase
    .from('installments')
    .update({ person_id: validPersonId })
    .eq('id', installmentId);
  return !error;
}

/**
 * Atualiza o status de pagamento de uma parcela ('pendente' | 'pago') no Supabase
 */
export async function cloudUpdateInstallmentStatus(
  installmentId: string,
  status: 'pendente' | 'pago'
): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured) return false;
  const { error } = await supabase
    .from('installments')
    .update({ status })
    .eq('id', installmentId);
  return !error;
}

/**
 * Sincroniza importação completa de fatura com conciliação e criação de compras
 */
export async function cloudSyncImportInvoice({
  cardId,
  month,
  year,
  totalAmount,
  matches,
  newItems,
}: {
  cardId: string;
  month: number;
  year: number;
  totalAmount: number;
  matches: Array<{
    existing: Installment;
    extractedItem: any;
    nameChanged: boolean;
  }>;
  newItems: any[];
}): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured) return false;

  try {
    // 1. Atualiza valor total da fatura
    const currentInvoiceId = await getOrCreateCloudInvoice(cardId, month, year, totalAmount, 'aberta');
    if (!currentInvoiceId) return false;

    // 2. Para compras conciliadas cujo nome mudou: atualiza o estabelecimento na tabela purchases
    for (const m of matches) {
      if (m.nameChanged && m.existing.purchase_id && m.existing.purchase_id.length > 20) {
        await supabase
          .from('purchases')
          .update({
            description: m.extractedItem.description,
            purchase_date: m.extractedItem.date || null,
          })
          .eq('id', m.existing.purchase_id);
      }
    }

    // 3. Para compras novas encontradas no PDF: insere em purchases e installments
    for (const item of newItems) {
      const totalInst = item.total_installments || 1;
      const currentInst = item.current_installment || 1;
      const amount = item.amount || 0;

      const { data: pur, error: purErr } = await supabase
        .from('purchases')
        .insert({
          card_id: cardId,
          person_id: null,
          description: item.description,
          purchase_date: item.date || null,
          total_installments: totalInst,
          total_amount: amount * totalInst,
        })
        .select('id')
        .single();

      if (purErr || !pur) continue;

      // Parcela atual
      await supabase.from('installments').insert({
        invoice_id: currentInvoiceId,
        purchase_id: pur.id,
        person_id: null,
        installment_number: currentInst,
        total_installments: totalInst,
        amount: amount,
        status: 'pendente',
      });

      // Parcelas futuras
      if (totalInst > 1 && currentInst < totalInst) {
        const remaining = totalInst - currentInst;
        for (let step = 1; step <= remaining; step++) {
          let futM = month + step;
          let futY = year;
          while (futM > 12) {
            futM -= 12;
            futY += 1;
          }
          const futInvId = await getOrCreateCloudInvoice(cardId, futM, futY, 0, 'aberta');
          if (futInvId) {
            await supabase.from('installments').insert({
              invoice_id: futInvId,
              purchase_id: pur.id,
              person_id: null,
              installment_number: currentInst + step,
              total_installments: totalInst,
              amount: amount,
              status: 'pendente',
            });
          }
        }
      }
    }

    return true;
  } catch (err) {
    console.error('Erro ao sincronizar importação na nuvem:', err);
    return false;
  }
}

/**
 * Assina mudanças em tempo real em todas as tabelas do Supabase
 */
export function subscribeToCloudChanges(onDataChange: () => void): () => void {
  if (!supabase || !isSupabaseConfigured) return () => {};

  const client = supabase;
  const channel = client
    .channel('cloud-realtime-sync')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public' },
      (payload) => {
        console.log('⚡ Atualização em tempo real recebida do Supabase:', payload.table, payload.eventType);
        onDataChange();
      }
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

/**
 * Migra dados locais existentes no localStorage para o Supabase
 */
export async function migrateLocalStorageToCloud(
  localCards: CreditCard[],
  localPeople: Person[],
  localInvoices: Record<string, Invoice>,
  localInstallments: Installment[]
): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured) return false;

  try {
    // 1. Mapeia cartões locais com os cartões do Supabase
    const { data: cloudCards } = await supabase.from('cards').select('*');
    const cardNameToCloudId = new Map<string, string>();
    const localCardIdToCloudId = new Map<string, string>();

    (cloudCards || []).forEach((c) => {
      cardNameToCloudId.set(c.name.trim().toUpperCase(), c.id);
    });

    localCards.forEach((lc) => {
      const cloudId = cardNameToCloudId.get(lc.name.trim().toUpperCase());
      if (cloudId) {
        localCardIdToCloudId.set(lc.id, cloudId);
      }
    });

    // 2. Migra Pessoas / Devedores
    const personLocalIdToCloudId = new Map<string, string>();
    for (const p of localPeople) {
      const { data: pData } = await supabase
        .from('people')
        .insert({
          name: p.name,
          phone: p.phone || null,
          color: p.color || '#10B981',
          notes: p.notes || null,
          is_active: p.is_active ?? true,
        })
        .select('id')
        .single();

      if (pData) {
        personLocalIdToCloudId.set(p.id, pData.id);
      }
    }

    // 3. Migra Faturas
    const invoiceKeyToCloudId = new Map<string, string>();
    for (const key of Object.keys(localInvoices)) {
      const inv = localInvoices[key];
      const cloudCardId = localCardIdToCloudId.get(inv.card_id) || inv.card_id;

      const { data: invData } = await supabase
        .from('invoices')
        .upsert(
          {
            card_id: cloudCardId,
            month: inv.month,
            year: inv.year,
            total_bank_amount: inv.total_bank_amount || 0,
            status: inv.status || 'aberta',
            notes: inv.notes || null,
          },
          { onConflict: 'card_id,month,year' }
        )
        .select('id')
        .single();

      if (invData) {
        invoiceKeyToCloudId.set(key, invData.id);
        invoiceKeyToCloudId.set(inv.id, invData.id);
      }
    }

    // 4. Migra Compras e Parcelas
    const purchaseGroups = new Map<string, Installment[]>();
    localInstallments.forEach((inst) => {
      const key = inst.purchase_id || inst.id;
      if (!purchaseGroups.has(key)) {
        purchaseGroups.set(key, []);
      }
      purchaseGroups.get(key)!.push(inst);
    });

    for (const [purKey, insts] of purchaseGroups.entries()) {
      const first = insts[0];
      let cloudCardId = '';

      const parts = first.invoice_id.split('_');
      if (parts.length === 3) {
        const localCId = parts[0];
        cloudCardId = localCardIdToCloudId.get(localCId) || '';
      }

      if (!cloudCardId || cloudCardId.length < 20) {
        if (cloudCards && cloudCards.length > 0) {
          cloudCardId = cloudCards[0].id;
        }
      }

      const assignedCloudPersonId = first.person_id
        ? personLocalIdToCloudId.get(first.person_id) || null
        : null;

      const totalAmount = insts.reduce((acc, i) => acc + i.amount, 0);

      const { data: purData } = await supabase
        .from('purchases')
        .insert({
          card_id: cloudCardId,
          person_id: assignedCloudPersonId,
          description: first.description || 'Compra Importada',
          purchase_date: first.purchase_date || null,
          total_installments: first.total_installments || insts.length || 1,
          total_amount: totalAmount,
        })
        .select('id')
        .single();

      if (!purData) continue;

      for (const inst of insts) {
        let invId = invoiceKeyToCloudId.get(inst.invoice_id);

        if (!invId) {
          const invParts = inst.invoice_id.split('_');
          if (invParts.length === 3) {
            const lCId = invParts[0];
            const y = parseInt(invParts[1], 10) || 2026;
            const m = parseInt(invParts[2], 10) || 4;
            const targetCId = localCardIdToCloudId.get(lCId) || cloudCardId;
            invId = (await getOrCreateCloudInvoice(targetCId, m, y)) || undefined;
            if (invId) {
              invoiceKeyToCloudId.set(inst.invoice_id, invId);
            }
          }
        }

        if (!invId) {
          invId = (await getOrCreateCloudInvoice(cloudCardId, 4, 2026)) || undefined;
        }

        if (!invId) continue;

        const pId = inst.person_id ? personLocalIdToCloudId.get(inst.person_id) || null : null;

        await supabase.from('installments').insert({
          invoice_id: invId,
          purchase_id: purData.id,
          person_id: pId,
          installment_number: inst.installment_number || 1,
          total_installments: inst.total_installments || 1,
          amount: inst.amount || 0,
          status: inst.status || 'pendente',
          notes: inst.notes || null,
        });
      }
    }

    return true;
  } catch (err) {
    console.error('Erro na migração para o Supabase:', err);
    return false;
  }
}
