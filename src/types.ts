import { Timestamp } from 'firebase/firestore';

export type PartnerKey = 'A' | 'B';

export interface Vault {
  id: string;
  title: string;
  destination: string;
  targetAmount: number;
  partnerAName: string;
  partnerBName: string;
  loveNote: string;
  ownerUid: string;
  memberUids: string[];
  inviteCode: string;
  joinedInviteCode: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface VaultInvite {
  inviteCode: string;
  vaultId: string;
  ownerUid: string;
  vaultTitle: string;
  destination: string;
  partnerAName: string;
  partnerBName: string;
  createdAt?: Timestamp;
}

export interface Contribution {
  id: string;
  amount: number;
  partnerKey: PartnerKey;
  partnerName: string;
  sourceTag: string;
  note: string;
  reactionHeart: boolean;
  reactionToast: boolean;
  reactionPlane: boolean;
  reactionFire: boolean;
  authorUid: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export const EXTERNAL_SOURCE_TAGS = [
  'Vendita Vinted / Subito',
  'Lavoretto / extra',
  'Monetine e resti trovati',
  'Cashback / rimborso / bonus',
  'Scommessa di coppia vinta',
  'Mancia / premio / regalo',
  'Mercatino / oggetti usati',
  'Altra entrata esterna',
] as const;

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
  contributionNoteMax: 200,
} as const;
