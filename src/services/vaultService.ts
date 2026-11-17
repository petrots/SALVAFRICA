import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  APP_LIMITS,
  Contribution,
  PartnerKey,
  VaultInvite,
} from '../types';

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/[^a-zA-Z0-9_-]/g, '');
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function makeInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 12; i += 1) {
    result += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return result;
}

function clampString(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

export async function createVaultAndInvite(
  uid: string,
  params: {
    title: string;
    destination: string;
    targetAmount: number;
    partnerAName: string;
    partnerBName: string;
    loveNote?: string;
  }
): Promise<string> {
  const vaultId = `v-${makeId()}`.slice(0, 48);
  const inviteCode = makeInviteCode();

  const title = clampString(params.title, APP_LIMITS.titleMax) || 'Viaggio in Africa';
  const destination = clampString(params.destination, APP_LIMITS.destinationMax) || 'Africa';
  const partnerAName = clampString(params.partnerAName, APP_LIMITS.partnerNameMax) || 'Partner 1';
  const partnerBName = clampString(params.partnerBName, APP_LIMITS.partnerNameMax) || 'Partner 2';
  const loveNote = clampString(
    params.loveNote ?? 'Zero risparmi o stipendio: ogni piccola entrata extra ci porta in Africa.',
    APP_LIMITS.loveNoteMax
  );
  const targetAmount = Math.min(1000000, Math.max(1, Number(params.targetAmount) || 1500));

  const batch = writeBatch(db);
  const vaultRef = doc(db, 'vaults', vaultId);
  const inviteRef = doc(db, 'vaultInvites', inviteCode);

  batch.set(vaultRef, {
    id: vaultId,
    title,
    destination,
    targetAmount,
    partnerAName,
    partnerBName,
    loveNote,
    ownerUid: uid,
    memberUids: [uid],
    inviteCode,
    joinedInviteCode: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(inviteRef, {
    inviteCode,
    vaultId,
    ownerUid: uid,
    vaultTitle: title,
    destination,
    partnerAName,
    partnerBName,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `vaults/${vaultId}`);
  }

  return vaultId;
}

export async function lookupInvite(rawCode: string): Promise<VaultInvite | null> {
  const cleanCode = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleanCode.length < 8 || cleanCode.length > 24) {
    return null;
  }
  const path = `vaultInvites/${cleanCode}`;
  try {
    const snap = await getDoc(doc(db, 'vaultInvites', cleanCode));
    if (!snap.exists()) return null;
    return snap.data() as VaultInvite;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function joinVaultWithCode(
  uid: string,
  rawCode: string
): Promise<{ ok: true; vaultId: string } | { ok: false; reason: string }> {
  const cleanCode = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const invite = await lookupInvite(cleanCode);
  if (!invite) {
    return { ok: false, reason: 'Codice invito non trovato o non valido.' };
  }

  if (invite.ownerUid === uid) {
    return { ok: true, vaultId: invite.vaultId };
  }

  const vaultPath = `vaults/${invite.vaultId}`;
  try {
    await updateDoc(doc(db, 'vaults', invite.vaultId), {
      memberUids: [invite.ownerUid, uid],
      joinedInviteCode: cleanCode,
      updatedAt: serverTimestamp(),
    });
    return { ok: true, vaultId: invite.vaultId };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.toLowerCase().includes('permission')) {
      return {
        ok: false,
        reason: 'Questo salvadanaio ha già due partecipanti oppure non è più disponibile.',
      };
    }
    handleFirestoreError(error, OperationType.UPDATE, vaultPath);
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
    await updateDoc(doc(db, 'vaults', vaultId), {
      title: clampString(updates.title, APP_LIMITS.titleMax) || 'Viaggio in Africa',
      destination: clampString(updates.destination, APP_LIMITS.destinationMax) || 'Africa',
      targetAmount: Math.min(1000000, Math.max(1, Number(updates.targetAmount) || 1000)),
      partnerAName: clampString(updates.partnerAName, APP_LIMITS.partnerNameMax) || 'Partner 1',
      partnerBName: clampString(updates.partnerBName, APP_LIMITS.partnerNameMax) || 'Partner 2',
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
  uid: string,
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
      authorUid: uid,
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
