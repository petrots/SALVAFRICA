import { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import confetti from 'canvas-confetti';
import {
  ListChecks,
  Plus,
  Route,
  Settings,
  Sparkles,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from './firebase';
import { DEFAULT_VAULT, ensureMainVaultExists } from './services/vaultService';
import {
  Contribution,
  MAIN_VAULT_ID,
  MILESTONES,
  Vault,
} from './types';
import { DashboardTab } from './components/DashboardTab';
import { DepositSheet } from './components/DepositSheet';
import { FeedTab } from './components/FeedTab';
import { OfflineIndicator } from './components/OfflineIndicator';
import { SettingsSheet } from './components/SettingsSheet';
import { triggerHaptic } from './utils/haptics';

type ActiveTab = 'home' | 'feed';

export default function App() {
  const [vault, setVault] = useState<Vault>(DEFAULT_VAULT);
  const [vaultLoaded, setVaultLoaded] = useState(false);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [contributionsLoaded, setContributionsLoaded] = useState(false);
  const ensuringVaultRef = useRef(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [depositOpen, setDepositOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
      metaTheme.setAttribute('content', isDark ? '#0E1F2E' : '#FAF8F5');
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

  const evaluateMilestoneCelebration = (effectiveSaved: number): boolean => {
    if (!vaultLoaded || !contributionsLoaded) return false;

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
      return false;
    }

    const newlyUnlocked = MILESTONES.filter(
      (m) => pct >= m.percent && !celebratedMilestonesRef.current.has(m.percent)
    );

    if (newlyUnlocked.length === 0) {
      return false;
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
      colors: ['#E86A52', '#1A6B8A', '#D99B38', '#FAF8F5'],
      disableForReducedMotion: true,
    });

    if (bannerTimerRef.current !== null) {
      window.clearTimeout(bannerTimerRef.current);
    }
    bannerTimerRef.current = window.setTimeout(() => {
      setMilestoneBanner(null);
      bannerTimerRef.current = null;
    }, 5000);

    return true;
  };

  useEffect(() => {
    evaluateMilestoneCelebration(stats.totalSaved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultLoaded, contributionsLoaded, vault.id, vault.targetAmount, stats.totalSaved]);

  const handleDepositStart = () => {
    pendingPreDepositTotalRef.current = totalSavedRef.current;
  };

  const handleDepositSuccess = (addedAmount: number): boolean => {
    setJustDepositedKey((k) => k + 1);
    const baseline = pendingPreDepositTotalRef.current ?? totalSavedRef.current;
    pendingPreDepositTotalRef.current = null;
    const effectiveTotal = Math.max(totalSavedRef.current, baseline + addedAmount);

    const celebratedNow = evaluateMilestoneCelebration(effectiveTotal);
    const celebratedViaSnapshot = Date.now() - lastMilestoneEventTimeRef.current < 2000;
    return celebratedNow || celebratedViaSnapshot;
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

          <div className="flex items-center gap-2 shrink-0">
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
              onClick={() => setDepositOpen(true)}
              className="hidden md:inline-flex min-h-[40px] px-4 rounded-xl bg-[#E86A52] text-xs font-semibold text-white hover:bg-[#D1533C] transition-colors items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              Versa extra
            </button>
          </div>
        </div>
      </header>

      {/* Milestone Unlocked Celebration Banner */}
      {milestoneBanner && (
        <div className="shrink-0 mx-auto max-w-6xl w-full px-4 sm:px-6 pt-3">
          <div className="rounded-2xl bg-[#E09F3E]/15 border border-[#E09F3E]/40 px-4 py-3 text-sm font-semibold text-[#122638] dark:text-[#FAF6F0] flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-[#E09F3E]" />
            <span>{milestoneBanner}</span>
          </div>
        </div>
      )}

      {/* Scrollable Main Content (isolated scroll container, zero overscroll bleed) */}
      <main className="flex-1 min-h-0 overflow-y-auto overscroll-none">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-6 pb-10 md:pb-12">
          {activeTab === 'home' && (
            <DashboardTab
              vault={vault}
              contributions={contributions}
              totalSaved={stats.totalSaved}
              partnerATotal={stats.partnerATotal}
              partnerBTotal={stats.partnerBTotal}
              partnerACount={stats.partnerACount}
              partnerBCount={stats.partnerBCount}
              justDepositedKey={justDepositedKey}
              celebratedMilestoneEvent={celebratedMilestoneEvent}
              onOpenDeposit={() => setDepositOpen(true)}
              onNavigateFeed={() => setActiveTab('feed')}
            />
          )}

          {activeTab === 'feed' && (
            <FeedTab
              vault={vault}
              contributions={contributions}
              onOpenDeposit={() => setDepositOpen(true)}
            />
          )}
        </div>
      </main>

      {/* Mobile Bottom Tab Bar anchored flush to viewport bottom */}
      <nav
        aria-label="Navigazione principale"
        className="md:hidden shrink-0 z-40 bg-white/95 dark:bg-[#162D42]/95 backdrop-blur-md border-t border-[#E6DDD1] dark:border-[#264561] pb-safe shadow-[0_-4px_20px_-8px_rgba(18,38,56,0.08)] dark:shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.45)] transition-colors duration-200"
      >
        <div className="grid grid-cols-3 items-end h-[64px] px-3 pb-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className={`min-h-[48px] flex flex-col items-center justify-end gap-1 pb-0.5 transition-colors ${
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
            onClick={() => setDepositOpen(true)}
            aria-label="Versa extra"
            className="flex flex-col items-center justify-end gap-1 pb-0.5 active:scale-95 transition-transform"
          >
            <span className="w-[62px] h-[50px] rounded-[18px] bg-gradient-to-br from-[#E86A52] to-[#D1533C] text-white flex items-center justify-center shadow-[0_8px_18px_-4px_rgba(232,106,82,0.48)] ring-[4px] ring-white dark:ring-[#162D42]">
              <Plus className="w-7 h-7 stroke-[2.5]" />
            </span>
            <span className="text-[11px] leading-none font-bold tracking-tight text-[#E86A52]">
              Versa
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('feed')}
            className={`min-h-[48px] flex flex-col items-center justify-end gap-1 pb-0.5 transition-colors ${
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
        onClose={() => setDepositOpen(false)}
        vault={vault}
        onDepositStart={handleDepositStart}
        onSuccessDeposit={handleDepositSuccess}
      />

      <SettingsSheet
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        vault={vault}
        isDark={isDark}
        onToggleTheme={() => setIsDark((prev) => !prev)}
      />
    </div>
  );
}
