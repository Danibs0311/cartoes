import { Installment } from './types';

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
