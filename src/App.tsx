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
  PiggyBank,
  Plus,
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

type ActiveTab = 'home' | 'feed';

export default function App() {
  const [vault, setVault] = useState<Vault>(DEFAULT_VAULT);
  const [vaultLoaded, setVaultLoaded] = useState(false);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const ensuringVaultRef = useRef(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [depositOpen, setDepositOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [justDepositedKey, setJustDepositedKey] = useState(0);
  const [milestoneBanner, setMilestoneBanner] = useState<string | null>(null);

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

  const handleDepositSuccess = (addedAmount: number) => {
    setJustDepositedKey((k) => k + 1);
    const target = Math.max(1, vault.targetAmount);
    const prevPct = (stats.totalSaved / target) * 100;
    const nextPct = ((stats.totalSaved + addedAmount) / target) * 100;

    const crossed = MILESTONES.filter(
      (m) => prevPct < m.percent && nextPct >= m.percent
    );

    if (crossed.length > 0) {
      const highest = crossed[crossed.length - 1];
      setMilestoneBanner(`Traguardo sbloccato: ${highest.label}`);
      confetti({
        particleCount: highest.percent === 100 ? 140 : 85,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#E86A52', '#1A6B8A', '#D99B38', '#FAF8F5'],
      });
      setTimeout(() => setMilestoneBanner(null), 5000);
    }
  };

  if (!vaultLoaded) {
    return (
      <div className="h-[100dvh] w-full overflow-hidden bg-[#FAF6F0] text-[#122638] flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="font-display text-2xl font-semibold text-[#122638]">
            SALVAFRICA
          </p>
          <p className="text-xs text-[#5B6B79]">Caricamento salvadanaio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-[#FAF6F0] text-[#122638] flex flex-col">
      <OfflineIndicator />

      {/* Top Navigation Bar */}
      <header className="shrink-0 z-30 bg-[#FAF6F0]/95 backdrop-blur-md border-b border-[#E6DDD1] pt-safe">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="inline-flex items-center gap-2.5 font-display text-xl font-semibold tracking-tight text-[#122638] whitespace-nowrap shrink-0"
          >
            <svg viewBox="0 0 28 28" className="w-6 h-6 shrink-0" aria-hidden="true">
              <circle cx="14" cy="14" r="14" fill="#122638" />
              <circle cx="14" cy="13" r="6" fill="#E86A52" />
              <path d="M2 16 Q8 13.5 14 16 T26 16 L26 28 L2 28 Z" fill="#1A6B8A" />
            </svg>
            <span>SALVAFRICA</span>
          </button>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#5B6B79]">
            <button
              type="button"
              onClick={() => setActiveTab('home')}
              className={`min-h-[40px] transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'home'
                  ? 'text-[#122638] font-semibold underline decoration-[#E86A52] decoration-2 underline-offset-8'
                  : 'hover:text-[#122638]'
              }`}
            >
              Salvadanaio
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('feed')}
              className={`min-h-[40px] transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'feed'
                  ? 'text-[#122638] font-semibold underline decoration-[#E86A52] decoration-2 underline-offset-8'
                  : 'hover:text-[#122638]'
              }`}
            >
              Movimenti
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="min-h-[40px] transition-colors hover:text-[#122638] whitespace-nowrap shrink-0"
            >
              Impostazioni
            </button>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Impostazioni salvadanaio"
              className="md:hidden min-h-[40px] px-3 rounded-xl bg-[#F2ECE3] text-xs font-semibold text-[#122638] hover:bg-[#E6DDD1] transition-colors inline-flex items-center gap-1.5"
            >
              <Settings className="w-4 h-4 text-[#5B6B79]" />
              <span>Impostazioni</span>
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
          <div className="rounded-2xl bg-[#E09F3E]/15 border border-[#E09F3E]/40 px-4 py-3 text-sm font-semibold text-[#122638] flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-[#E09F3E]" />
            <span>{milestoneBanner}</span>
          </div>
        </div>
      )}

      {/* Scrollable Main Content (isolated scroll container, zero overscroll bleed) */}
      <main className="flex-1 min-h-0 overflow-y-auto overscroll-none">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-6 pb-8 md:pb-12">
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
        className="md:hidden shrink-0 z-40 bg-white border-t border-[#E6DDD1] pb-safe"
      >
        <div className="grid grid-cols-3 items-center h-16 px-4">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
              activeTab === 'home' ? 'text-[#E86A52]' : 'text-[#5B6B79]'
            }`}
          >
            <PiggyBank className="w-5 h-5" />
            <span className="text-[11px] font-medium tracking-tight">Salvadanaio</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('feed')}
            className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
              activeTab === 'feed' ? 'text-[#E86A52]' : 'text-[#5B6B79]'
            }`}
          >
            <ListChecks className="w-5 h-5" />
            <span className="text-[11px] font-medium tracking-tight">Movimenti</span>
          </button>

          <button
            type="button"
            onClick={() => setDepositOpen(true)}
            className="min-h-[48px] flex flex-col items-center justify-center gap-0.5"
          >
            <span className="w-11 h-8 rounded-xl bg-[#E86A52] text-white flex items-center justify-center shadow-xs">
              <Plus className="w-5 h-5" />
            </span>
            <span className="text-[11px] font-semibold tracking-tight text-[#E86A52]">
              Versa
            </span>
          </button>
        </div>
      </nav>

      {/* Modals / Bottom Sheets */}
      <DepositSheet
        isOpen={depositOpen}
        onClose={() => setDepositOpen(false)}
        vault={vault}
        onSuccessDeposit={handleDepositSuccess}
      />

      <SettingsSheet
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        vault={vault}
      />
    </div>
  );
}
