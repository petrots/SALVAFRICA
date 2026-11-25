import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-[max(4rem,calc(env(safe-area-inset-top)+3.75rem))] left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-[#122638] dark:bg-[#162D42] border border-[#264561]/40 dark:border-[#264561] px-3.5 py-1.5 text-xs font-medium text-[#FAF6F0] shadow-md whitespace-nowrap"
    >
      <WifiOff className="w-3.5 h-3.5 text-[#E86A52] shrink-0" />
      <span>Modalità offline — dati locali in attesa di rete</span>
    </div>
  );
};
