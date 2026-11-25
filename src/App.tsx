import { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import confetti from 'canvas-confetti';
import {
  Bell,
  ListChecks,
  Plus,
  Route,
  Settings,
  Sparkles,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  dispatchActivityNotification,
  doesNotificationMatchPrefs,
  ensurePushSubscriptionSynced,
  getNotificationPrefs,
  getSavedPartnerKey,
  isNotificationForPartner,
  isNotificationUnread,
  markNotificationRead,
  saveNotificationPrefs,
  savePartnerKey,
  showLocalNotificationIfHidden,
  subscribeDeviceToPush,
  syncBrowserAppBadge,
  syncSubscriptionPreferences,
  unsubscribeDeviceFromPush,
} from './services/notificationService';
import {
  DEFAULT_VAULT,
  ensureInitialCategoryExists,
  ensureMainVaultExists,
} from './services/vaultService';
import {
  Category,
  Contribution,
  MAIN_VAULT_ID,
  MILESTONES,
  NotificationItem,
  NotificationPreferences,
  PartnerKey,
  PushSubscriptionRecord,
  Vault,
} from './types';
import { DashboardTab } from './components/DashboardTab';
import { DepositSheet, DepositSuccessMeta } from './components/DepositSheet';
import { FeedTab } from './components/FeedTab';
import { NotificationsSheet } from './components/NotificationsSheet';
import { NotificationToast } from './components/NotificationToast';
import { OfflineIndicator } from './components/OfflineIndicator';
import { SettingsSheet } from './components/SettingsSheet';
import { sortCategoriesByLastUsed } from './utils/categories';
import { formatEuro } from './utils/format';
import { triggerHaptic } from './utils/haptics';

type ActiveTab = 'home' | 'feed';

export default function App() {
  const [vault, setVault] = useState<Vault>(DEFAULT_VAULT);
  const [vaultLoaded, setVaultLoaded] = useState(false);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [contributionsLoaded, setContributionsLoaded] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [pushSubscriptions, setPushSubscriptions] = useState<PushSubscriptionRecord[]>([]);
  const [pushSubscriptionsLoaded, setPushSubscriptionsLoaded] = useState(false);
  const ensuringVaultRef = useRef(false);
  const seedingCategoryRef = useRef(false);

  const [currentPartnerKey, setCurrentPartnerKey] = useState<PartnerKey>(() =>
    getSavedPartnerKey()
  );
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(() =>
    getNotificationPrefs()
  );
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [persistentVapid, setPersistentVapid] = useState<boolean | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('tab') === 'feed' ? 'feed' : 'home';
    } catch {
      return 'home';
    }
  });
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositDefaultPhysical, setDepositDefaultPhysical] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('settings') === '1';
    } catch {
      return false;
    }
  });

  const openDepositSheet = (defaultPhysical = false) => {
    setDepositDefaultPhysical(defaultPhysical);
    setDepositOpen(true);
  };
  const [notificationsOpen, setNotificationsOpen] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('notifications') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('settings') || url.searchParams.has('notifications')) {
        url.searchParams.delete('settings');
        url.searchParams.delete('notifications');
        window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      }
    } catch {
      // Ignore history API errors
    }
  }, []);
  const [liveToast, setLiveToast] = useState<NotificationItem | null>(null);

  const [justDepositedKey, setJustDepositedKey] = useState(0);
  const [milestoneBanner, setMilestoneBanner] = useState<string | null>(null);
  const [celebratedMilestoneEvent, setCelebratedMilestoneEvent] = useState<{
    key: number;
    index: number;
  } | null>(null);
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('salvafrica_theme') === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', isDark ? '#0E1F2E' : '#FAF6F0');
    }
    try {
      window.localStorage.setItem('salvafrica_theme', isDark ? 'dark' : 'light');
    } catch {
      // Ignore storage restrictions
    }
  }, [isDark]);

  // Sync the single shared SALVAFRICA vault directly and auto-initialize if absent
  useEffect(() => {
    const vaultPath = `vaults/${MAIN_VAULT_ID}`;
    const unsub = onSnapshot(
      doc(db, 'vaults', MAIN_VAULT_ID),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Vault;
          setVault(data);
          setVaultLoaded(true);
          if (
            data.partnerAName === 'Partner 1' &&
            data.partnerBName === 'Partner 2' &&
            !ensuringVaultRef.current
          ) {
            ensuringVaultRef.current = true;
            ensureMainVaultExists().catch(() => {
              ensuringVaultRef.current = false;
            });
          }
        } else {
          setVault(DEFAULT_VAULT);
          setVaultLoaded(true);
          if (!ensuringVaultRef.current) {
            ensuringVaultRef.current = true;
            ensureMainVaultExists().catch(() => {
              ensuringVaultRef.current = false;
            });
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, vaultPath);
      }
    );
    return () => unsub();
  }, []);

  // Listen to contributions in real time
  useEffect(() => {
    const contribPath = `vaults/${MAIN_VAULT_ID}/contributions`;
    const contribQuery = query(
      collection(db, contribPath),
      orderBy('createdAt', 'desc')
    );
    const unsubContrib = onSnapshot(
      contribQuery,
      (snap) => {
        setContributions(snap.docs.map((d) => d.data() as Contribution));
        setContributionsLoaded(true);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, contribPath);
      }
    );

    return () => {
      unsubContrib();
    };
  }, []);

  // Listen to customizable categories in real time and seed single initial "Mance" if empty
  useEffect(() => {
    const categoriesPath = `vaults/${MAIN_VAULT_ID}/categories`;
    const unsubCategories = onSnapshot(
      collection(db, categoriesPath),
      (snap) => {
        setCategories(snap.docs.map((d) => d.data() as Category));
        setCategoriesLoaded(true);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, categoriesPath);
      }
    );

    return () => {
      unsubCategories();
    };
  }, []);

  useEffect(() => {
    if (
      vaultLoaded &&
      categoriesLoaded &&
      categories.length === 0 &&
      !seedingCategoryRef.current
    ) {
      seedingCategoryRef.current = true;
      ensureInitialCategoryExists(MAIN_VAULT_ID).catch(() => {
        seedingCategoryRef.current = false;
      });
    }
  }, [vaultLoaded, categoriesLoaded, categories.length]);

  // Listen to notifications and push subscriptions in real time
  const initialNotifSyncDoneRef = useRef(false);
  const seenNotifIdsRef = useRef<Set<string>>(new Set());
  const toastTimerRef = useRef<number | null>(null);
  const partnerKeyRef = useRef(currentPartnerKey);
  partnerKeyRef.current = currentPartnerKey;
  const notifPrefsRef = useRef(notifPrefs);
  notifPrefsRef.current = notifPrefs;

  useEffect(() => {
    const notifPath = `vaults/${MAIN_VAULT_ID}/notifications`;
    const notifQuery = query(
      collection(db, notifPath),
      orderBy('createdAt', 'desc'),
      limit(60)
    );
    const unsubNotifs = onSnapshot(
      notifQuery,
      (snap) => {
        const items = snap.docs.map((d) => d.data() as NotificationItem);
        setNotifications(items);

        if (!initialNotifSyncDoneRef.current) {
          for (const item of items) {
            seenNotifIdsRef.current.add(item.id);
          }
          initialNotifSyncDoneRef.current = true;
          return;
        }

        for (const item of items) {
          if (seenNotifIdsRef.current.has(item.id)) continue;
          seenNotifIdsRef.current.add(item.id);

          const activePartner = partnerKeyRef.current;
          const prefs = notifPrefsRef.current;
          if (
            isNotificationForPartner(item, activePartner) &&
            isNotificationUnread(item, activePartner) &&
            doesNotificationMatchPrefs(item, prefs)
          ) {
            setLiveToast(item);
            triggerHaptic('selection');
            if (toastTimerRef.current !== null) {
              window.clearTimeout(toastTimerRef.current);
            }
            toastTimerRef.current = window.setTimeout(() => {
              setLiveToast(null);
              toastTimerRef.current = null;
            }, 4600);

            const targetUrl =
              item.type === 'deposit' || item.type === 'reaction'
                ? '/?tab=feed'
                : '/?tab=home';
            void showLocalNotificationIfHidden(
              item.title,
              item.body,
              item.id,
              targetUrl
            );
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, notifPath);
      }
    );

    const subsPath = `vaults/${MAIN_VAULT_ID}/pushSubscriptions`;
    const unsubSubs = onSnapshot(
      collection(db, subsPath),
      (snap) => {
        setPushSubscriptions(
          snap.docs.map((d) => d.data() as PushSubscriptionRecord)
        );
        setPushSubscriptionsLoaded(true);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, subsPath);
      }
    );

    return () => {
      unsubNotifs();
      unsubSubs();
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const pushSubscriptionsRef = useRef(pushSubscriptions);
  pushSubscriptionsRef.current = pushSubscriptions;
  const syncingPushRef = useRef(false);

  // Check & auto-heal browser Push subscription, VAPID key alignment, and Firestore registration
  useEffect(() => {
    if (!pushSubscriptionsLoaded) return;
    let active = true;

    const runSync = async () => {
      if (syncingPushRef.current) return;
      syncingPushRef.current = true;
      try {
        const result = await ensurePushSubscriptionSynced(
          MAIN_VAULT_ID,
          partnerKeyRef.current,
          notifPrefsRef.current,
          pushSubscriptionsRef.current
        );
        if (!active) return;
        setPushSubscribed(result.subscribed);
        if (typeof result.persistentVapid === 'boolean') {
          setPersistentVapid(result.persistentVapid);
        }
      } finally {
        syncingPushRef.current = false;
      }
    };

    void runSync();

    const handleResume = () => {
      if (document.visibilityState === 'hidden') return;
      void runSync();
    };
    window.addEventListener('focus', handleResume);
    document.addEventListener('visibilitychange', handleResume);

    return () => {
      active = false;
      window.removeEventListener('focus', handleResume);
      document.removeEventListener('visibilitychange', handleResume);
    };
  }, [pushSubscriptionsLoaded]);

  const relevantNotifications = useMemo(
    () =>
      notifications.filter((n) => isNotificationForPartner(n, currentPartnerKey)),
    [notifications, currentPartnerKey]
  );

  const unreadNotificationsCount = useMemo(
    () =>
      relevantNotifications.filter((n) =>
        isNotificationUnread(n, currentPartnerKey)
      ).length,
    [relevantNotifications, currentPartnerKey]
  );

  // Sync unread counter to iPhone Home Screen PWA app badge
  useEffect(() => {
    syncBrowserAppBadge(unreadNotificationsCount);
  }, [unreadNotificationsCount]);

  // Handle Service Worker notification taps and APNs/browser push key rotation
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; path?: string } | null;
      if (!data || typeof data.type !== 'string') return;

      if (data.type === 'SALVAFRICA_NAVIGATE' && typeof data.path === 'string') {
        try {
          const parsedUrl = new URL(data.path, window.location.origin);
          if (parsedUrl.searchParams.get('notifications') === '1') {
            setNotificationsOpen(true);
            return;
          }
          if (parsedUrl.searchParams.get('tab') === 'feed') {
            setNotificationsOpen(false);
            setActiveTab('feed');
            return;
          }
          setNotificationsOpen(false);
          setActiveTab('home');
        } catch {
          setActiveTab('home');
        }
      } else if (data.type === 'SALVAFRICA_PUSH_SUBSCRIPTION_CHANGED') {
        if (
          typeof window !== 'undefined' &&
          'Notification' in window &&
          window.Notification.permission === 'granted'
        ) {
          void subscribeDeviceToPush(
            MAIN_VAULT_ID,
            partnerKeyRef.current,
            notifPrefsRef.current
          ).then((res) => {
            if (res.ok) {
              setPushSubscribed(true);
            }
          });
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    return () => {
      navigator.serviceWorker.removeEventListener(
        'message',
        handleServiceWorkerMessage
      );
    };
  }, []);

  const handleChangePartnerKey = (nextKey: PartnerKey) => {
    setCurrentPartnerKey(nextKey);
    savePartnerKey(nextKey);
    void syncSubscriptionPreferences(
      vault.id,
      nextKey,
      notifPrefs,
      pushSubscriptions
    );
  };

  const handleUpdateNotifPrefs = (nextPrefs: NotificationPreferences) => {
    setNotifPrefs(nextPrefs);
    saveNotificationPrefs(nextPrefs);
    void syncSubscriptionPreferences(
      vault.id,
      currentPartnerKey,
      nextPrefs,
      pushSubscriptions
    );
  };

  const handleEnablePush = async () => {
    const result = await subscribeDeviceToPush(
      vault.id,
      currentPartnerKey,
      notifPrefs
    );
    if (result.ok) {
      setPushSubscribed(true);
      if (typeof result.persistentVapid === 'boolean') {
        setPersistentVapid(result.persistentVapid);
      }
    }
    return result;
  };

  const handleDisablePush = async () => {
    await unsubscribeDeviceFromPush(vault.id);
    setPushSubscribed(false);
  };

  const sortedCategories = useMemo(
    () => sortCategoriesByLastUsed(categories),
    [categories]
  );

  const activeCategories = useMemo(
    () => sortedCategories.filter((c) => !c.archived),
    [sortedCategories]
  );

  const categoriesById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const stats = useMemo(() => {
    let totalSaved = 0;
    let partnerATotal = 0;
    let partnerBTotal = 0;
    let partnerACount = 0;
    let partnerBCount = 0;

    for (const c of contributions) {
      const amt = Number(c.amount) || 0;
      totalSaved += amt;
      if (c.partnerKey === 'A') {
        partnerATotal += amt;
        partnerACount += 1;
      } else {
        partnerBTotal += amt;
        partnerBCount += 1;
      }
    }

    return {
      totalSaved,
      partnerATotal,
      partnerBTotal,
      partnerACount,
      partnerBCount,
    };
  }, [contributions]);

  const totalSavedRef = useRef(stats.totalSaved);
  totalSavedRef.current = stats.totalSaved;

  const celebratedScopeRef = useRef<string | null>(null);
  const celebratedMilestonesRef = useRef<Set<number>>(new Set());
  const celebrationKeyRef = useRef(0);
  const lastMilestoneEventTimeRef = useRef(0);
  const pendingPreDepositTotalRef = useRef<number | null>(null);
  const bannerTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current !== null) {
        window.clearTimeout(bannerTimerRef.current);
      }
    };
  }, []);

  const evaluateMilestoneCelebration = (effectiveSaved: number): string | null => {
    if (!vaultLoaded || !contributionsLoaded) return null;

    const target = Math.max(1, vault.targetAmount);
    const scopeKey = `salvafrica_celebrated_${vault.id}_${target}`;
    const pct = (Math.max(0, effectiveSaved) / target) * 100;

    if (celebratedScopeRef.current !== scopeKey) {
      const initialSet = new Set<number>();
      try {
        const raw = window.localStorage.getItem(scopeKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (typeof item === 'number') initialSet.add(item);
            }
          }
        }
      } catch {
        // Ignore storage restrictions
      }
      // Seed already-unlocked milestones on initial load or target change without firing celebration
      for (const m of MILESTONES) {
        if (pct >= m.percent) {
          initialSet.add(m.percent);
        }
      }
      celebratedMilestonesRef.current = initialSet;
      celebratedScopeRef.current = scopeKey;
      try {
        window.localStorage.setItem(scopeKey, JSON.stringify([...initialSet]));
      } catch {
        // Ignore storage restrictions
      }
      return null;
    }

    const newlyUnlocked = MILESTONES.filter(
      (m) => pct >= m.percent && !celebratedMilestonesRef.current.has(m.percent)
    );

    if (newlyUnlocked.length === 0) {
      return null;
    }

    for (const m of newlyUnlocked) {
      celebratedMilestonesRef.current.add(m.percent);
    }
    try {
      window.localStorage.setItem(
        scopeKey,
        JSON.stringify([...celebratedMilestonesRef.current])
      );
    } catch {
      // Ignore storage restrictions
    }

    const highest = newlyUnlocked[newlyUnlocked.length - 1];
    const highestIdx = MILESTONES.findIndex((m) => m.percent === highest.percent);
    lastMilestoneEventTimeRef.current = Date.now();

    triggerHaptic('milestone');
    setCelebratedMilestoneEvent({
      key: ++celebrationKeyRef.current,
      index: highestIdx,
    });
    setMilestoneBanner(`Traguardo sbloccato: ${highest.label}`);

    confetti({
      particleCount: highest.percent === 100 ? 140 : 85,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#E86A52', '#1A6B8A', '#D99B38', '#FAF6F0'],
      disableForReducedMotion: true,
    });

    if (bannerTimerRef.current !== null) {
      window.clearTimeout(bannerTimerRef.current);
    }
    bannerTimerRef.current = window.setTimeout(() => {
      setMilestoneBanner(null);
      bannerTimerRef.current = null;
    }, 5000);

    return highest.label;
  };

  useEffect(() => {
    evaluateMilestoneCelebration(stats.totalSaved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultLoaded, contributionsLoaded, vault.id, vault.targetAmount, stats.totalSaved]);

  const handleDepositStart = () => {
    pendingPreDepositTotalRef.current = totalSavedRef.current;
  };

  const handleDepositSuccess = (
    addedAmount: number,
    meta: DepositSuccessMeta
  ): boolean => {
    setJustDepositedKey((k) => k + 1);
    const baseline = pendingPreDepositTotalRef.current ?? totalSavedRef.current;
    pendingPreDepositTotalRef.current = null;
    const effectiveTotal = Math.max(totalSavedRef.current, baseline + addedAmount);

    const unlockedLabel = evaluateMilestoneCelebration(effectiveTotal);
    const celebratedViaSnapshot = Date.now() - lastMilestoneEventTimeRef.current < 2000;

    const targetPartnerKey: PartnerKey = meta.partnerKey === 'A' ? 'B' : 'A';
    const noteSuffix = meta.note ? ` — “${meta.note}”` : '';
    const physicalSuffix = meta.pendingPhysical
      ? ' · Da inserire nel salvadanaio fisico'
      : '';

    void dispatchActivityNotification(
      vault.id,
      {
        type: 'deposit',
        actorKey: meta.partnerKey,
        actorName: meta.partnerName,
        targetPartnerKey,
        title: `Nuovo versamento di ${meta.partnerName}`,
        body: `+${formatEuro(addedAmount)} · ${meta.categoryName}${noteSuffix}${physicalSuffix}`,
        amount: addedAmount,
        contributionId: meta.contributionId,
      },
      pushSubscriptions
    );

    if (unlockedLabel) {
      void dispatchActivityNotification(
        vault.id,
        {
          type: 'milestone',
          actorKey: 'system',
          actorName: 'SALVAFRICA',
          targetPartnerKey: 'all',
          title: 'Traguardo sbloccato!',
          body: `${unlockedLabel} · Totale raccolto ${formatEuro(effectiveTotal)}`,
        },
        pushSubscriptions
      );
    }

    return Boolean(unlockedLabel) || celebratedViaSnapshot;
  };

  const handleReactionAdded = (
    entry: Contribution,
    reactionEmoji: string,
    categoryLabel: string
  ) => {
    const actorName =
      currentPartnerKey === 'A' ? vault.partnerAName : vault.partnerBName;
    void dispatchActivityNotification(
      vault.id,
      {
        type: 'reaction',
        actorKey: currentPartnerKey,
        actorName,
        targetPartnerKey: entry.partnerKey,
        title: `${actorName} ha reagito ${reactionEmoji}`,
        body: `Al tuo versamento di +${formatEuro(entry.amount)} (${categoryLabel})`,
        amount: entry.amount,
        contributionId: entry.id,
        reactionEmoji,
      },
      pushSubscriptions
    );
  };

  const handleLoveNoteUpdated = (newNote: string) => {
    const actorName =
      currentPartnerKey === 'A' ? vault.partnerAName : vault.partnerBName;
    const targetPartnerKey: PartnerKey = currentPartnerKey === 'A' ? 'B' : 'A';
    void dispatchActivityNotification(
      vault.id,
      {
        type: 'love_note',
        actorKey: currentPartnerKey,
        actorName,
        targetPartnerKey,
        title: `${actorName} ha aggiornato il bigliettino`,
        body: `“${newNote}”`,
      },
      pushSubscriptions
    );
  };

  if (!vaultLoaded) {
    return (
      <div className="h-[100dvh] w-full overflow-hidden bg-[#FAF6F0] dark:bg-[#0E1F2E] text-[#122638] dark:text-[#FAF6F0] flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="font-display text-2xl font-semibold text-[#122638] dark:text-[#FAF6F0]">
            SALVAFRICA
          </p>
          <p className="text-xs text-[#5B6B79] dark:text-[#9DB0C0]">Caricamento salvadanaio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-[#FAF6F0] dark:bg-[#0E1F2E] text-[#122638] dark:text-[#FAF6F0] flex flex-col transition-colors duration-200">
      <OfflineIndicator />
      <NotificationToast
        notification={liveToast}
        onDismiss={() => setLiveToast(null)}
        onOpen={(item) => {
          void markNotificationRead(vault.id, item, currentPartnerKey);
          setLiveToast(null);
          if (item.type === 'deposit' || item.type === 'reaction') {
            setActiveTab('feed');
          } else {
            setActiveTab('home');
          }
        }}
      />

      {/* Top Navigation Bar */}
      <header className="shrink-0 z-30 bg-[#FAF6F0]/95 dark:bg-[#0E1F2E]/95 backdrop-blur-md border-b border-[#E6DDD1] dark:border-[#264561] pt-safe transition-colors duration-200">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="inline-flex items-center gap-2.5 font-display text-xl font-semibold tracking-tight text-[#122638] dark:text-[#FAF6F0] whitespace-nowrap shrink-0"
          >
            <svg viewBox="0 0 28 28" className="w-6 h-6 shrink-0" aria-hidden="true">
              <circle cx="14" cy="14" r="14" fill="#122638" />
              <circle cx="14" cy="13" r="6" fill="#E86A52" />
              <path d="M2 16 Q8 13.5 14 16 T26 16 L26 28 L2 28 Z" fill="#1A6B8A" />
            </svg>
            <span>SALVAFRICA</span>
          </button>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#5B6B79] dark:text-[#9DB0C0]">
            <button
              type="button"
              onClick={() => setActiveTab('home')}
              className={`min-h-[40px] transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'home'
                  ? 'text-[#122638] dark:text-[#FAF6F0] font-semibold underline decoration-[#E86A52] decoration-2 underline-offset-8'
                  : 'hover:text-[#122638] dark:hover:text-[#FAF6F0]'
              }`}
            >
              Salvadanaio
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('feed')}
              className={`min-h-[40px] transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'feed'
                  ? 'text-[#122638] dark:text-[#FAF6F0] font-semibold underline decoration-[#E86A52] decoration-2 underline-offset-8'
                  : 'hover:text-[#122638] dark:hover:text-[#FAF6F0]'
              }`}
            >
              Movimenti
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="min-h-[40px] transition-colors hover:text-[#122638] dark:hover:text-[#FAF6F0] whitespace-nowrap shrink-0"
            >
              Impostazioni
            </button>
          </nav>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setNotificationsOpen(true)}
              aria-label={
                unreadNotificationsCount > 0
                  ? `Notifiche (${unreadNotificationsCount} non lette)`
                  : 'Notifiche'
              }
              className="relative min-h-[44px] min-w-[44px] rounded-full text-[#122638]/80 dark:text-[#FAF6F0]/85 hover:bg-[#F2ECE3] dark:hover:bg-[#1E3952] active:bg-[#E6DDD1] dark:active:bg-[#264561] transition-colors flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A6B8A]/50"
            >
              <Bell className="w-5 h-5 stroke-[1.9]" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[17px] h-[17px] px-1 rounded-full bg-[#E86A52] text-[10px] font-bold leading-none text-white flex items-center justify-center tabular-nums ring-2 ring-[#FAF6F0] dark:ring-[#0E1F2E]">
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Impostazioni"
              className="md:hidden min-h-[44px] min-w-[44px] -mr-2 rounded-full text-[#122638]/80 dark:text-[#FAF6F0]/85 hover:bg-[#F2ECE3] dark:hover:bg-[#1E3952] active:bg-[#E6DDD1] dark:active:bg-[#264561] transition-colors flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A6B8A]/50"
            >
              <Settings className="w-5 h-5 stroke-[1.9]" />
            </button>

            <button
              type="button"
              onClick={() => openDepositSheet(false)}
              className="hidden md:inline-flex ds-btn-primary"
            >
              <Plus className="w-4 h-4 stroke-[2.25]" />
              <span>Versa extra</span>
            </button>
          </div>
        </div>
      </header>

      {/* Milestone Unlocked Celebration Banner */}
      {milestoneBanner && (
        <div className="shrink-0 mx-auto max-w-6xl w-full px-4 sm:px-6 pt-3">
          <div className="rounded-2xl bg-[#E09F3E]/15 border border-[#E09F3E]/40 px-4 py-3 text-sm font-semibold text-[#122638] dark:text-[#FAF6F0] flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-[#85580D] dark:text-[#F7C76E] shrink-0" />
            <span>{milestoneBanner}</span>
          </div>
        </div>
      )}

      {/* Scrollable Main Content (isolated scroll container, zero overscroll bleed) */}
      <main className="flex-1 min-h-0 overflow-y-auto overscroll-none">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-5 sm:py-6 pb-8 md:pb-12">
          {activeTab === 'home' && (
            <DashboardTab
              vault={vault}
              contributions={contributions}
              categoriesById={categoriesById}
              totalSaved={stats.totalSaved}
              partnerATotal={stats.partnerATotal}
              partnerBTotal={stats.partnerBTotal}
              partnerACount={stats.partnerACount}
              partnerBCount={stats.partnerBCount}
              justDepositedKey={justDepositedKey}
              celebratedMilestoneEvent={celebratedMilestoneEvent}
              onOpenDeposit={() => openDepositSheet(false)}
              onOpenPhysicalReminder={() => openDepositSheet(true)}
              onNavigateFeed={() => setActiveTab('feed')}
              onLoveNoteUpdated={handleLoveNoteUpdated}
            />
          )}

          {activeTab === 'feed' && (
            <FeedTab
              vault={vault}
              contributions={contributions}
              categoriesById={categoriesById}
              currentPartnerKey={currentPartnerKey}
              onOpenDeposit={() => openDepositSheet(false)}
              onReactionAdded={handleReactionAdded}
            />
          )}
        </div>
      </main>

      {/* Mobile Bottom Tab Bar anchored flush to viewport bottom */}
      <nav
        aria-label="Navigazione principale"
        className="md:hidden shrink-0 z-40 bg-[#FAF6F0]/95 dark:bg-[#162D42]/95 backdrop-blur-md border-t border-[#E6DDD1] dark:border-[#264561] pb-safe shadow-[0_-4px_20px_-8px_rgba(18,38,56,0.08)] dark:shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.45)] transition-colors duration-200"
      >
        <div className="grid grid-cols-3 items-end h-[64px] px-3 pb-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className={`min-h-[48px] flex flex-col items-center justify-end gap-1 pb-0.5 rounded-xl transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A6B8A] ${
              activeTab === 'home' ? 'text-[#E86A52]' : 'text-[#5B6B79] dark:text-[#9DB0C0]'
            }`}
          >
            <Route
              className={`w-[22px] h-[22px] ${
                activeTab === 'home' ? 'stroke-[2.25]' : 'stroke-[1.75]'
              }`}
            />
            <span
              className={`text-[11px] leading-none tracking-tight ${
                activeTab === 'home' ? 'font-semibold' : 'font-medium'
              }`}
            >
              Percorso
            </span>
          </button>

          <button
            type="button"
            onClick={() => openDepositSheet(false)}
            aria-label="Versa extra"
            className="flex flex-col items-center justify-end gap-1 pb-0.5 active:scale-95 transition-transform duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A6B8A] rounded-2xl"
          >
            <span className="w-[62px] h-[50px] rounded-[18px] bg-gradient-to-br from-[#E86A52] to-[#D1533C] text-white flex items-center justify-center shadow-[0_8px_18px_-4px_rgba(232,106,82,0.48)] ring-[4px] ring-[#FAF6F0] dark:ring-[#162D42]">
              <Plus className="w-7 h-7 stroke-[2.5]" />
            </span>
            <span className="text-[11px] leading-none font-bold tracking-tight text-[#E86A52]">
              Versa
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('feed')}
            className={`min-h-[48px] flex flex-col items-center justify-end gap-1 pb-0.5 rounded-xl transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A6B8A] ${
              activeTab === 'feed' ? 'text-[#E86A52]' : 'text-[#5B6B79] dark:text-[#9DB0C0]'
            }`}
          >
            <ListChecks
              className={`w-[22px] h-[22px] ${
                activeTab === 'feed' ? 'stroke-[2.25]' : 'stroke-[1.75]'
              }`}
            />
            <span
              className={`text-[11px] leading-none tracking-tight ${
                activeTab === 'feed' ? 'font-semibold' : 'font-medium'
              }`}
            >
              Movimenti
            </span>
          </button>
        </div>
      </nav>

      {/* Modals / Bottom Sheets */}
      <DepositSheet
        isOpen={depositOpen}
        onClose={() => {
          setDepositOpen(false);
          setDepositDefaultPhysical(false);
        }}
        vault={vault}
        categories={sortedCategories}
        activeCategories={activeCategories}
        categoriesLoaded={categoriesLoaded}
        currentPartnerKey={currentPartnerKey}
        defaultPendingPhysical={depositDefaultPhysical}
        onChangePartnerKey={handleChangePartnerKey}
        onDepositStart={handleDepositStart}
        onSuccessDeposit={handleDepositSuccess}
      />

      <NotificationsSheet
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        vault={vault}
        notifications={relevantNotifications}
        currentPartnerKey={currentPartnerKey}
        onChangePartnerKey={handleChangePartnerKey}
        pushSubscribed={pushSubscribed}
        onEnablePush={handleEnablePush}
        onOpenSettings={() => setSettingsOpen(true)}
        onNavigateTab={(tab) => setActiveTab(tab)}
      />

      <SettingsSheet
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        vault={vault}
        categories={sortedCategories}
        contributions={contributions}
        pushSubscriptions={pushSubscriptions}
        isDark={isDark}
        onToggleTheme={() => setIsDark((prev) => !prev)}
        currentPartnerKey={currentPartnerKey}
        onChangePartnerKey={handleChangePartnerKey}
        notifPrefs={notifPrefs}
        onUpdateNotifPrefs={handleUpdateNotifPrefs}
        pushSubscribed={pushSubscribed}
        persistentVapid={persistentVapid}
        onEnablePush={handleEnablePush}
        onDisablePush={handleDisablePush}
      />
    </div>
  );
}
