import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../pwa/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 lg:bottom-5 left-4 z-40 flex items-center gap-2 rounded-xl border border-amber-300/60 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/90 px-3.5 py-2 text-xs font-medium text-amber-900 dark:text-amber-100 shadow-sm"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>وضع عدم الاتصال — التعديلات تُحفظ محليًا بأمان</span>
    </div>
  );
};
