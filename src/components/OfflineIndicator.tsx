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
      className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-[#132638] dark:bg-[#1E3952] dark:border dark:border-[#264561] px-3.5 py-1.5 text-xs font-medium text-[#FAF8F5] shadow-md"
    >
      <WifiOff className="w-3.5 h-3.5 text-[#E86A52]" />
      <span>Modalità offline — dati locali in attesa di rete</span>
    </div>
  );
};
