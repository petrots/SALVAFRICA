import React, { useState } from 'react';
import {
  Bell,
  BellOff,
  CheckCheck,
  Heart,
  Plus,
  Quote,
  Settings,
  Smartphone,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  deleteNotificationItem,
  getPushEnvironmentStatus,
  isNotificationUnread,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notificationService';
import {
  DS_PARTNER_STYLES,
  getSheetBackdropMotion,
  getSheetPanelMotion,
} from '../styles/designSystem';
import { NotificationItem, PartnerKey, Vault } from '../types';
import { formatDateTime } from '../utils/format';

interface NotificationsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  vault: Vault;
  notifications: NotificationItem[];
  currentPartnerKey: PartnerKey;
  onChangePartnerKey: (key: PartnerKey) => void;
  pushSubscribed: boolean;
  onEnablePush: () => Promise<{ ok: boolean; error?: string }>;
  onOpenSettings: () => void;
  onNavigateTab: (tab: 'home' | 'feed') => void;
}

function getNotificationIcon(item: NotificationItem) {
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

function getNotificationIconStyle(item: NotificationItem): string {
  if (item.type === 'milestone') {
    return 'bg-[#E09F3E]/16 text-[#85580D] dark:text-[#F7C76E]';
  }
  if (item.actorKey === 'A') {
    return DS_PARTNER_STYLES.A.iconBadge;
  }
  if (item.actorKey === 'B') {
    return DS_PARTNER_STYLES.B.iconBadge;
  }
  return 'bg-[#F2ECE3] dark:bg-[#162D42] text-[#122638] dark:text-[#FAF6F0]';
}

export const NotificationsSheet: React.FC<NotificationsSheetProps> = ({
  isOpen,
  onClose,
  vault,
  notifications,
  currentPartnerKey,
  onChangePartnerKey,
  pushSubscribed,
  onEnablePush,
  onOpenSettings,
  onNavigateTab,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const backdropMotion = getSheetBackdropMotion(prefersReducedMotion);
  const panelMotion = getSheetPanelMotion(prefersReducedMotion);

  const [enablingPush, setEnablingPush] = useState(false);
  const [pushFeedback, setPushFeedback] = useState('');
  const [markingAll, setMarkingAll] = useState(false);

  const envStatus = getPushEnvironmentStatus();
  const unreadCount = notifications.filter((n) =>
    isNotificationUnread(n, currentPartnerKey)
  ).length;

  const handleEnablePush = async () => {
    if (enablingPush) return;
    setEnablingPush(true);
    setPushFeedback('');
    try {
      const result = await onEnablePush();
      if (!result.ok && result.error) {
        setPushFeedback(result.error);
      }
    } finally {
      setEnablingPush(false);
    }
  };

  const handleMarkAllRead = async () => {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    try {
      await markAllNotificationsRead(vault.id, notifications, currentPartnerKey);
    } finally {
      setMarkingAll(false);
    }
  };

  const handleItemTap = async (item: NotificationItem) => {
    void markNotificationRead(vault.id, item, currentPartnerKey);
    if (item.type === 'deposit' || item.type === 'reaction') {
      onNavigateTab('feed');
    } else {
      onNavigateTab('home');
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <motion.div
            {...backdropMotion}
            onClick={onClose}
            className="ds-sheet-backdrop"
          />

          <motion.div
            {...panelMotion}
            className="ds-sheet-panel max-h-[90dvh]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notifications-sheet-title"
          >
            <div className="ds-sheet-handle" />

            {/* Editorial Header */}
            <div className="ds-sheet-header">
              <div className="min-w-0">
                <h2
                  id="notifications-sheet-title"
                  className="ds-heading-sheet"
                >
                  Notifiche
                </h2>
                <p className="ds-caption">
                  {unreadCount === 0
                    ? 'Sei in pari con tutti gli aggiornamenti'
                    : `${unreadCount} ${
                        unreadCount === 1 ? 'nuova notifica' : 'nuove notifiche'
                      }`}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleMarkAllRead()}
                    disabled={markingAll}
                    aria-label="Segna tutte come lette"
                    className="ds-btn-ghost text-[#1A6B8A] dark:text-[#2D8FB3]"
                  >
                    <CheckCheck className="w-4 h-4" />
                    <span className="hidden xs:inline">Tutte lette</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSettings();
                  }}
                  aria-label="Preferenze notifiche"
                  className="ds-btn-icon"
                >
                  <Settings className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Chiudi"
                  className="ds-btn-icon -mr-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Device Identity & Push Banner */}
            <div className="shrink-0 px-5 sm:px-6 py-3 border-b ds-divider space-y-2.5 bg-[#F2ECE3]/55 dark:bg-[#162D42]/45">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-[#5B6B79] dark:text-[#9DB0C0] inline-flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-[#1A6B8A] dark:text-[#2D8FB3]" />
                  <span>Questo telefono è di:</span>
                </span>

                <div className="inline-flex items-center gap-1 rounded-full border ds-divider bg-[#FAF6F0] dark:bg-[#0E1F2E] p-0.5">
                  <button
                    type="button"
                    onClick={() => onChangePartnerKey('A')}
                    className={`min-h-[40px] px-3.5 rounded-full text-xs font-semibold transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A6B8A] ${
                      currentPartnerKey === 'A'
                        ? DS_PARTNER_STYLES.A.activeSegment
                        : 'text-[#5B6B79] dark:text-[#9DB0C0] hover:text-[#122638] dark:hover:text-[#FAF6F0]'
                    }`}
                  >
                    {vault.partnerAName}
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangePartnerKey('B')}
                    className={`min-h-[40px] px-3.5 rounded-full text-xs font-semibold transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E86A52] ${
                      currentPartnerKey === 'B'
                        ? DS_PARTNER_STYLES.B.activeSegment
                        : 'text-[#5B6B79] dark:text-[#9DB0C0] hover:text-[#122638] dark:hover:text-[#FAF6F0]'
                    }`}
                  >
                    {vault.partnerBName}
                  </button>
                </div>
              </div>

              {!pushSubscribed && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                  {envStatus.isIOS && !envStatus.isStandalone ? (
                    <p className="text-[11px] leading-relaxed text-[#5B6B79] dark:text-[#9DB0C0]">
                      Su iPhone: aggiungi l’app alla schermata Home (Condividi →
                      Aggiungi a schermata Home) per ricevere avvisi Push anche ad app
                      chiusa.
                    </p>
                  ) : envStatus.permission === 'denied' ? (
                    <p className="text-[11px] leading-relaxed text-[#D1533C] dark:text-[#E86A52] inline-flex items-center gap-1.5">
                      <BellOff className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Notifiche Push bloccate nelle impostazioni del browser.
                      </span>
                    </p>
                  ) : (
                    <>
                      <span className="text-[11px] text-[#5B6B79] dark:text-[#9DB0C0]">
                        {envStatus.isInIframe
                          ? 'Apri l’app nella sua finestra per attivare le Push di sistema.'
                          : 'Ricevi avvisi Push sul telefono anche ad app chiusa.'}
                      </span>
                      {envStatus.supported && !envStatus.isInIframe && (
                        <button
                          type="button"
                          onClick={() => void handleEnablePush()}
                          disabled={enablingPush}
                          className="ds-btn-primary"
                        >
                          {enablingPush ? 'Attivazione...' : 'Attiva Push'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              {pushFeedback && (
                <p className="text-[11px] font-medium text-[#D1533C] dark:text-[#E86A52]">
                  {pushFeedback}
                </p>
              )}
            </div>

            {/* Scrollable Notifications List */}
            <div className="ds-sheet-body pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              {notifications.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <span className="w-11 h-11 rounded-full bg-[#F2ECE3] dark:bg-[#162D42] text-[#5B6B79] dark:text-[#9DB0C0] inline-flex items-center justify-center mx-auto">
                    <Bell className="w-5 h-5" />
                  </span>
                  <p className="font-display text-lg font-semibold text-[#122638] dark:text-[#FAF6F0]">
                    Nessuna notifica per ora
                  </p>
                  <p className="ds-caption max-w-xs mx-auto leading-relaxed">
                    Qui compariranno i nuovi versamenti del partner, le reazioni ai
                    tuoi extra e i traguardi raggiunti insieme.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-[#E6DDD1] dark:divide-[#264561]">
                  {notifications.map((item) => {
                    const unread = isNotificationUnread(item, currentPartnerKey);
                    return (
                      <li key={item.id} className="py-3.5 flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => void handleItemTap(item)}
                          className="flex-1 min-w-0 flex items-start gap-3 text-left group focus:outline-none"
                        >
                          <span
                            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${getNotificationIconStyle(
                              item
                            )}`}
                          >
                            {getNotificationIcon(item)}
                          </span>

                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2">
                              {unread && (
                                <span
                                  aria-label="Non letta"
                                  className="w-2 h-2 rounded-full bg-[#E86A52] shrink-0"
                                />
                              )}
                              <p
                                className={`text-sm leading-snug truncate ${
                                  unread
                                    ? 'font-semibold text-[#122638] dark:text-[#FAF6F0]'
                                    : 'font-medium text-[#122638]/85 dark:text-[#FAF6F0]/85'
                                }`}
                              >
                                {item.title}
                              </p>
                            </div>
                            <p className="text-xs text-[#5B6B79] dark:text-[#9DB0C0] leading-relaxed break-words">
                              {item.body}
                            </p>
                            <p className="text-[11px] text-[#5B6B79]/80 dark:text-[#9DB0C0]/75 pt-0.5">
                              {formatDateTime(item.createdAt)}
                            </p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => void deleteNotificationItem(vault.id, item.id)}
                          aria-label="Rimuovi notifica"
                          className="ds-btn-icon -mr-2 hover:text-[#D1533C] dark:hover:text-[#E86A52] hover:bg-[#E86A52]/10 shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
