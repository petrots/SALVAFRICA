import { Timestamp } from 'firebase/firestore';

export type PartnerKey = 'A' | 'B';

export type NotificationType = 'deposit' | 'reaction' | 'milestone' | 'love_note';
export type NotificationActorKey = PartnerKey | 'system';
export type NotificationTargetKey = PartnerKey | 'all';

export const MAIN_VAULT_ID = 'salvafrica-viaggio';
export const INITIAL_CATEGORY_ID = 'cat-mance';
export const INITIAL_CATEGORY_NAME = 'Mance';

export interface Vault {
  id: string;
  title: string;
  destination: string;
  targetAmount: number;
  partnerAName: string;
  partnerBName: string;
  loveNote: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Category {
  id: string;
  name: string;
  archived: boolean;
  lastUsedAt?: Timestamp | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Contribution {
  id: string;
  amount: number;
  partnerKey: PartnerKey;
  partnerName: string;
  sourceTag: string;
  categoryId?: string;
  note: string;
  pendingPhysical?: boolean;
  reactionHeart: boolean;
  reactionToast: boolean;
  reactionPlane: boolean;
  reactionFire: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface NotificationItem {
  id: string;
  type: NotificationType;
  actorKey: NotificationActorKey;
  actorName: string;
  targetPartnerKey: NotificationTargetKey;
  title: string;
  body: string;
  amount?: number;
  contributionId?: string;
  reactionEmoji?: string;
  readByA: boolean;
  readByB: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface NotificationPreferences {
  notifyDeposits: boolean;
  notifyReactions: boolean;
  notifyMilestones: boolean;
  notifyLoveNote: boolean;
}

export interface PushSubscriptionRecord extends NotificationPreferences {
  id: string;
  partnerKey: PartnerKey;
  endpoint: string;
  p256dh: string;
  auth: string;
  deviceLabel: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Milestone {
  percent: number;
  label: string;
  subtitle: string;
}

export const MILESTONES: Milestone[] = [
  { percent: 5, label: '5% · Primo slancio', subtitle: 'Si comincia sul serio' },
  { percent: 10, label: '10% · Primi passi', subtitle: 'Il fondo prende forma' },
  { percent: 20, label: '20% · Buon ritmo', subtitle: 'Un quinto del viaggio' },
  { percent: 30, label: '30% · Avanti così', subtitle: 'La rotta è tracciata' },
  { percent: 40, label: '40% · Quasi a metà', subtitle: 'L’Africa si avvicina' },
  { percent: 50, label: '50% · Metà viaggio', subtitle: 'Metà obiettivo conquistata' },
  { percent: 60, label: '60% · Oltre la metà', subtitle: 'Discesa verso la meta' },
  { percent: 75, label: '75% · Zaino pronto', subtitle: 'Manca l’ultimo quarto' },
  { percent: 90, label: '90% · Ultimo miglio', subtitle: 'Manca pochissimo' },
  { percent: 100, label: '100% · Si parte!', subtitle: 'Destinazione Africa raggiunta' },
];

export const APP_LIMITS = {
  titleMax: 80,
  destinationMax: 80,
  partnerNameMax: 40,
  loveNoteMax: 240,
  sourceTagMax: 50,
  categoryNameMax: 50,
  contributionNoteMax: 200,
  notificationTitleMax: 100,
  notificationBodyMax: 240,
  deviceLabelMax: 80,
} as const;
