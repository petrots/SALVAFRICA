import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  APP_LIMITS,
  Category,
  Contribution,
  INITIAL_CATEGORY_ID,
  INITIAL_CATEGORY_NAME,
  MAIN_VAULT_ID,
  PartnerKey,
  Vault,
} from '../types';
import { findDuplicateCategory, normalizeCategoryName } from '../utils/categories';

export const DEFAULT_VAULT: Vault = {
  id: MAIN_VAULT_ID,
  title: 'Viaggio in Africa',
  destination: 'Africa',
  targetAmount: 2500,
  partnerAName: 'Tiziano',
  partnerBName: 'Daria',
  loveNote: 'Zero risparmi o stipendio: ogni piccola entrata extra ci porta in Africa.',
};

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/[^a-zA-Z0-9_-]/g, '');
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function clampString(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

export async function ensureMainVaultExists(): Promise<void> {
  const vaultPath = `vaults/${MAIN_VAULT_ID}`;
  const vaultRef = doc(db, 'vaults', MAIN_VAULT_ID);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(vaultRef);
      if (!snap.exists()) {
        tx.set(vaultRef, {
          id: DEFAULT_VAULT.id,
          title: DEFAULT_VAULT.title,
          destination: DEFAULT_VAULT.destination,
          targetAmount: DEFAULT_VAULT.targetAmount,
          partnerAName: DEFAULT_VAULT.partnerAName,
          partnerBName: DEFAULT_VAULT.partnerBName,
          loveNote: DEFAULT_VAULT.loveNote,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const data = snap.data() as Partial<Vault>;
        if (data.partnerAName === 'Partner 1' && data.partnerBName === 'Partner 2') {
          tx.update(vaultRef, {
            partnerAName: 'Tiziano',
            partnerBName: 'Daria',
            updatedAt: serverTimestamp(),
          });
        }
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, vaultPath);
  }
}

/**
 * Seeds ONLY the single initial category ("Mance") when the vault has zero categories.
 * Never touches historical contributions and never re-adds Mance if other categories exist.
 */
export async function ensureInitialCategoryExists(vaultId: string): Promise<void> {
  const categoriesColPath = `vaults/${vaultId}/categories`;
  const initialCatRef = doc(db, 'vaults', vaultId, 'categories', INITIAL_CATEGORY_ID);

  try {
    await ensureMainVaultExists();
    const existingSnap = await getDocs(
      query(collection(db, categoriesColPath), limit(1))
    );
    if (!existingSnap.empty) {
      return;
    }

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(initialCatRef);
      if (!snap.exists()) {
        tx.set(initialCatRef, {
          id: INITIAL_CATEGORY_ID,
          name: INITIAL_CATEGORY_NAME,
          archived: false,
          lastUsedAt: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, categoriesColPath);
  }
}

export async function createCategory(
  vaultId: string,
  rawName: string,
  existingCategories: Category[]
): Promise<Category> {
  const name = normalizeCategoryName(rawName);
  if (!name) {
    throw new Error('Inserisci un nome per la categoria.');
  }

  const duplicate = findDuplicateCategory(name, existingCategories);
  if (duplicate) {
    throw new Error(
      duplicate.archived
        ? 'Esiste già nelle categorie archiviate: riattivala dalle Impostazioni.'
        : 'Esiste già una categoria con questo nome.'
    );
  }

  const categoryId = `cat-${makeId()}`.slice(0, 48);
  const path = `vaults/${vaultId}/categories/${categoryId}`;
  const catRef = doc(db, 'vaults', vaultId, 'categories', categoryId);

  try {
    await ensureMainVaultExists();
    await setDoc(catRef, {
      id: categoryId,
      name,
      archived: false,
      lastUsedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return {
      id: categoryId,
      name,
      archived: false,
      lastUsedAt: null,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function renameCategory(
  vaultId: string,
  category: Category,
  rawNewName: string,
  existingCategories: Category[],
  contributions: Contribution[]
): Promise<void> {
  const name = normalizeCategoryName(rawNewName);
  if (!name) {
    throw new Error('Inserisci un nome valido per la categoria.');
  }

  const duplicate = findDuplicateCategory(name, existingCategories, category.id);
  if (duplicate) {
    throw new Error(
      duplicate.archived
        ? 'Esiste già una categoria archiviata con questo nome.'
        : 'Esiste già un’altra categoria con questo nome.'
    );
  }

  if (name === category.name) {
    return;
  }

  const path = `vaults/${vaultId}/categories/${category.id}`;
  const matchingContribs = contributions.filter(
    (c) => c.categoryId === category.id
  );

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'vaults', vaultId, 'categories', category.id), {
      name,
      updatedAt: serverTimestamp(),
    });

    // Keep sourceTag synchronized on contributions linked to this category (limit 400 per batch)
    for (const entry of matchingContribs.slice(0, 400)) {
      batch.update(doc(db, 'vaults', vaultId, 'contributions', entry.id), {
        sourceTag: name,
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();

    // Handle rare >400 linked contributions cleanly in subsequent batches
    for (let i = 400; i < matchingContribs.length; i += 400) {
      const extraBatch = writeBatch(db);
      for (const entry of matchingContribs.slice(i, i + 400)) {
        extraBatch.update(doc(db, 'vaults', vaultId, 'contributions', entry.id), {
          sourceTag: name,
          updatedAt: serverTimestamp(),
        });
      }
      await extraBatch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function setCategoryArchived(
  vaultId: string,
  categoryId: string,
  archived: boolean
): Promise<void> {
  const path = `vaults/${vaultId}/categories/${categoryId}`;
  try {
    await updateDoc(doc(db, 'vaults', vaultId, 'categories', categoryId), {
      archived,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateVaultSettings(
  vaultId: string,
  updates: {
    title: string;
    destination: string;
    targetAmount: number;
    partnerAName: string;
    partnerBName: string;
    loveNote: string;
  }
): Promise<void> {
  const path = `vaults/${vaultId}`;
  try {
    await ensureMainVaultExists();
    await updateDoc(doc(db, 'vaults', vaultId), {
      title: clampString(updates.title, APP_LIMITS.titleMax) || 'Viaggio in Africa',
      destination: clampString(updates.destination, APP_LIMITS.destinationMax) || 'Africa',
      targetAmount: Math.min(1000000, Math.max(1, Number(updates.targetAmount) || 1000)),
      partnerAName: clampString(updates.partnerAName, APP_LIMITS.partnerNameMax) || 'Tiziano',
      partnerBName: clampString(updates.partnerBName, APP_LIMITS.partnerNameMax) || 'Daria',
      loveNote: clampString(updates.loveNote, APP_LIMITS.loveNoteMax),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateLoveNote(vaultId: string, loveNote: string): Promise<void> {
  const path = `vaults/${vaultId}`;
  try {
    await ensureMainVaultExists();
    await updateDoc(doc(db, 'vaults', vaultId), {
      loveNote: clampString(loveNote, APP_LIMITS.loveNoteMax),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function addContribution(
  vaultId: string,
  data: {
    amount: number;
    partnerKey: PartnerKey;
    partnerName: string;
    sourceTag: string;
    categoryId?: string;
    note: string;
  }
): Promise<void> {
  const contributionId = `dep-${makeId()}`.slice(0, 48);
  const amount = Math.min(100000, Math.max(0.01, Math.round(data.amount * 100) / 100));
  const partnerName = clampString(data.partnerName, APP_LIMITS.partnerNameMax) || 'Partner';
  const sourceTag = clampString(data.sourceTag, APP_LIMITS.sourceTagMax) || INITIAL_CATEGORY_NAME;
  const note = clampString(data.note, APP_LIMITS.contributionNoteMax);

  const contributionPath = `vaults/${vaultId}/contributions/${contributionId}`;
  const contribRef = doc(db, 'vaults', vaultId, 'contributions', contributionId);

  try {
    await ensureMainVaultExists();
    const batch = writeBatch(db);

    const payload: Record<string, unknown> = {
      id: contributionId,
      amount,
      partnerKey: data.partnerKey,
      partnerName,
      sourceTag,
      note,
      reactionHeart: false,
      reactionToast: false,
      reactionPlane: false,
      reactionFire: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (data.categoryId) {
      payload.categoryId = data.categoryId;
      batch.update(doc(db, 'vaults', vaultId, 'categories', data.categoryId), {
        lastUsedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    batch.set(contribRef, payload);
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, contributionPath);
  }
}

export type ReactionField = 'reactionHeart' | 'reactionToast' | 'reactionPlane' | 'reactionFire';

export async function toggleContributionReaction(
  vaultId: string,
  entry: Contribution,
  field: ReactionField
): Promise<void> {
  const path = `vaults/${vaultId}/contributions/${entry.id}`;
  try {
    await updateDoc(doc(db, 'vaults', vaultId, 'contributions', entry.id), {
      [field]: !entry[field],
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteContribution(vaultId: string, entryId: string): Promise<void> {
  const path = `vaults/${vaultId}/contributions/${entryId}`;
  try {
    await deleteDoc(doc(db, 'vaults', vaultId, 'contributions', entryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
