import {
  deleteDoc,
  doc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  APP_LIMITS,
  Contribution,
  MAIN_VAULT_ID,
  PartnerKey,
  Vault,
} from '../types';

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
    note: string;
  }
): Promise<void> {
  const contributionId = `dep-${makeId()}`.slice(0, 48);
  const amount = Math.min(100000, Math.max(0.01, Math.round(data.amount * 100) / 100));
  const partnerName = clampString(data.partnerName, APP_LIMITS.partnerNameMax) || 'Partner';
  const sourceTag = clampString(data.sourceTag, APP_LIMITS.sourceTagMax) || 'Altra entrata esterna';
  const note = clampString(data.note, APP_LIMITS.contributionNoteMax);

  const contributionPath = `vaults/${vaultId}/contributions/${contributionId}`;
  const contribRef = doc(db, 'vaults', vaultId, 'contributions', contributionId);

  try {
    await ensureMainVaultExists();
    await setDoc(contribRef, {
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
    });
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
