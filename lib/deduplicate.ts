import { Installment, ExtractedInvoiceData } from './types';

/**
 * Normaliza uma descrição removendo acentos, prefixos de maquininhas e caracteres especiais
 */
export function normalizeDescription(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(pg|pag|mp|picpay|rec|mercadopago|compra|loja|estab|parc)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Verifica se duas descrições de compras referem-se ao mesmo estabelecimento
 */
export function areDescriptionsSimilar(descA?: string, descB?: string): boolean {
  if (!descA || !descB) return false;
  const aRaw = descA.toLowerCase().trim();
  const bRaw = descB.toLowerCase().trim();
  if (aRaw === bRaw) return true;
  if (aRaw.includes(bRaw) || bRaw.includes(aRaw)) return true;

  const aNorm = normalizeDescription(descA);
  const bNorm = normalizeDescription(descB);
  if (aNorm === bNorm) return true;
  if (aNorm.length >= 4 && bNorm.length >= 4) {
    if (aNorm.includes(bNorm) || bNorm.includes(aNorm)) return true;
  }

  // Compara tokens individuais (ex: "uber", "amazon", "renner", "makes")
  const cleanA = descA
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length >= 3);

  const cleanB = descB
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length >= 3);

  const shared = cleanA.filter((t) => cleanB.includes(t));
  return shared.length > 0;
}

/**
 * Encontra lançamentos duplicados em uma fatura específica
 */
export function findDuplicatesInInvoice(invoiceInstallments: Installment[]): {
  duplicateIdsToRemove: Set<string>;
  purchaseIdsToRemove: Set<string>;
} {
  const duplicateIdsToRemove = new Set<string>();
  const purchaseIdsToRemove = new Set<string>();
  const keptIds = new Set<string>();

  for (let i = 0; i < invoiceInstallments.length; i++) {
    const itemA = invoiceInstallments[i];
    if (duplicateIdsToRemove.has(itemA.id)) continue;

    for (let j = i + 1; j < invoiceInstallments.length; j++) {
      const itemB = invoiceInstallments[j];
      if (duplicateIdsToRemove.has(itemB.id)) continue;

      const sameAmount = Math.abs(itemA.amount - itemB.amount) < 0.05;
      const sameInst = itemA.installment_number === itemB.installment_number;

      if (sameAmount && sameInst) {
        const isSimilar =
          areDescriptionsSimilar(itemA.description, itemB.description) ||
          (itemA.person_id && itemB.person_id && itemA.person_id === itemB.person_id);

        if (isSimilar) {
          // Escolhe qual manter:
          // Preferência 1: Quem já tem comprador atribuído (person_id preenchido)
          // Preferência 2: O mais antigo (menor timestamp no ID)
          let toRemove: Installment;
          let toKeep: Installment;

          if (itemA.person_id && !itemB.person_id) {
            toKeep = itemA;
            toRemove = itemB;
          } else if (!itemA.person_id && itemB.person_id) {
            toKeep = itemB;
            toRemove = itemA;
          } else {
            toKeep = itemA;
            toRemove = itemB;
          }

          duplicateIdsToRemove.add(toRemove.id);
          if (toRemove.purchase_id && toRemove.purchase_id !== toKeep.purchase_id) {
            purchaseIdsToRemove.add(toRemove.purchase_id);
          }
          keptIds.add(toKeep.id);

          if (toRemove.id === itemA.id) {
            break; // itemA foi removido, passa para o próximo i
          }
        }
      }
    }
  }

  return { duplicateIdsToRemove, purchaseIdsToRemove };
}

/**
 * Limpa todos os duplicados da fatura e remove suas parcelas futuras órfãs
 */
export function cleanInvoiceDuplicates(
  allInstallments: Installment[],
  currentInvoiceId: string
): {
  cleanedInstallments: Installment[];
  removedCount: number;
} {
  const inThisInvoice = allInstallments.filter((i) => i.invoice_id === currentInvoiceId);
  const { duplicateIdsToRemove, purchaseIdsToRemove } = findDuplicatesInInvoice(inThisInvoice);

  if (duplicateIdsToRemove.size === 0) {
    return { cleanedInstallments: allInstallments, removedCount: 0 };
  }

  // Remove as duplicatas desta fatura E quaisquer parcelas futuras geradas por elas
  const cleanedInstallments = allInstallments.filter((inst) => {
    if (duplicateIdsToRemove.has(inst.id)) return false;
    if (inst.purchase_id && purchaseIdsToRemove.has(inst.purchase_id)) return false;
    return true;
  });

  return {
    cleanedInstallments,
    removedCount: duplicateIdsToRemove.size,
  };
}

/**
 * Busca uma compra existente no sistema com base na ordem estrita de critérios solicitada:
 * 1. Valor da Prestação (obrigatório, margem de 5 centavos)
 * 2. Data de Compra (se disponível)
 * 3. Número de Prestação (número da parcela)
 */
export function findMatchingInstallment(
  item: {
    amount: number;
    current_installment: number;
    total_installments?: number;
    date?: string;
    description: string;
  },
  availableExisting: Installment[]
): Installment | null {
  // Critério 1: Valor da Prestação
  const sameAmountCandidates = availableExisting.filter(
    (e) => Math.abs(e.amount - item.amount) < 0.05
  );

  if (sameAmountCandidates.length === 0) return null;

  // Se houver apenas 1 candidato com esse exato valor no mês
  if (sameAmountCandidates.length === 1) {
    return sameAmountCandidates[0];
  }

  // Critério 2: Data de Compra (se disponível no PDF)
  if (item.date) {
    const rawItemDate = item.date.replace(/[^\d]/g, '');
    const dateCandidates = sameAmountCandidates.filter((e) => {
      if (!e.purchase_date) return false;
      const rawEDate = e.purchase_date.replace(/[^\d]/g, '');
      return rawEDate.includes(rawItemDate) || rawItemDate.includes(rawEDate);
    });

    if (dateCandidates.length > 0) {
      // Critério 3: Número de Prestação
      const instMatch = dateCandidates.find(
        (e) => e.installment_number === item.current_installment
      );
      if (instMatch) return instMatch;
      return dateCandidates[0];
    }
  }

  // Critério 3: Número de Prestação (Parcela)
  const instCandidates = sameAmountCandidates.filter(
    (e) => e.installment_number === item.current_installment
  );

  if (instCandidates.length > 0) {
    const descMatch = instCandidates.find((e) =>
      areDescriptionsSimilar(e.description, item.description)
    );
    return descMatch || instCandidates[0];
  }

  // Fallback por similaridade de nome com mesmo valor
  const descCandidates = sameAmountCandidates.find((e) =>
    areDescriptionsSimilar(e.description, item.description)
  );
  if (descCandidates) return descCandidates;

  return null;
}

export interface InvoiceReconciliationResult {
  matches: Array<{
    existing: Installment;
    extractedItem: ExtractedInvoiceData['items'][0];
    nameChanged: boolean;
  }>;
  newItems: Array<ExtractedInvoiceData['items'][0]>;
  unmatchedExisting: Array<Installment>;
}

/**
 * Realiza o comparativo completo entre os itens da fatura enviada e os lançamentos existentes
 */
export function reconcileInvoiceItems(
  extractedItems: ExtractedInvoiceData['items'],
  existingInstallments: Installment[]
): InvoiceReconciliationResult {
  const matches: InvoiceReconciliationResult['matches'] = [];
  const newItems: ExtractedInvoiceData['items'] = [];
  const usedExistingIds = new Set<string>();

  (extractedItems || []).forEach((item) => {
    const available = existingInstallments.filter((e) => !usedExistingIds.has(e.id));
    const match = findMatchingInstallment(item, available);

    if (match) {
      usedExistingIds.add(match.id);
      const nameChanged =
        (match.description || '').trim().toLowerCase() !== item.description.trim().toLowerCase();
      matches.push({
        existing: match,
        extractedItem: item,
        nameChanged,
      });
    } else {
      newItems.push(item);
    }
  });

  const unmatchedExisting = existingInstallments.filter((e) => !usedExistingIds.has(e.id));

  return { matches, newItems, unmatchedExisting };
}
