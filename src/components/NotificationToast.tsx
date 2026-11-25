import React from 'react';
import { Bell, Heart, Plus, Quote, Sparkles, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { DS_PARTNER_STYLES, getToastMotion } from '../styles/designSystem';
import { NotificationItem } from '../types';

interface NotificationToastProps {
  notification: NotificationItem | null;
  onOpen: (item: NotificationItem) => void;
  onDismiss: () => void;
}

function getToastIcon(item: NotificationItem) {
  switch (item.type) {
    case 'deposit':
      return <Plus className="w-4 h-4 stroke-[2.25]" />;
    case 'reaction':
      return item.reactionEmoji ? (
        <span className="text-sm leading-none">{item.reactionEmoji}</span>
      ) : (
        <Heart className="w-4 h-4" />
      );
    case 'milestone':
      return <Sparkles className="w-4 h-4" />;
    case 'love_note':
      return <Quote className="w-4 h-4" />;
    default:
      return <Bell className="w-4 h-4" />;
  }
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onOpen,
  onDismiss,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const motionProps = getToastMotion(prefersReducedMotion);

  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          key={notification.id}
          {...motionProps}
          className="fixed top-[max(4rem,calc(env(safe-area-inset-top)+3.75rem))] md:top-20 inset-x-4 sm:left-auto sm:right-6 sm:w-96 z-40 pointer-events-auto"
          role="status"
          aria-live="polite"
        >
          <div className="rounded-2xl bg-[#FAF6F0]/98 dark:bg-[#162D42]/98 backdrop-blur-md border border-[#E6DDD1] dark:border-[#264561] shadow-lg px-3.5 py-3 flex items-start gap-3">
            <button
              type="button"
              onClick={() => onOpen(notification)}
              className="flex-1 min-w-0 flex items-start gap-3 text-left focus:outline-none focus-visible:underline"
            >
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  notification.type === 'milestone'
                    ? 'bg-[#E09F3E]/18 text-[#85580D] dark:text-[#F7C76E]'
                    : notification.actorKey === 'B'
                      ? DS_PARTNER_STYLES.B.iconBadge
                      : DS_PARTNER_STYLES.A.iconBadge
                }`}
              >
                {getToastIcon(notification)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[#122638] dark:text-[#FAF6F0] truncate">
                  {notification.title}
                </p>
                <p className="text-xs text-[#5B6B79] dark:text-[#9DB0C0] line-clamp-2 leading-snug mt-0.5">
                  {notification.body}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={onDismiss}
              aria-label="Chiudi avviso"
              className="ds-btn-icon -mr-1.5 -mt-1.5 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
