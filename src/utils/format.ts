import { Timestamp } from 'firebase/firestore';

export function formatEuro(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  const hasCents = Math.abs(safe % 1) > 0.001;
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(safe);
}

export function formatDateTime(ts?: Timestamp): string {
  if (!ts || typeof ts.toDate !== 'function') {
    return 'Adesso';
  }
  const date = ts.toDate();
  return new Intl.DateTimeFormat('it-IT', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
