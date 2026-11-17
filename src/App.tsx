import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import confetti from 'canvas-confetti';
import {
  ListChecks,
  PiggyBank,
  Plus,
  Settings,
  Sparkles,
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import {
  Contribution,
  MILESTONES,
  Vault,
} from './types';
import { DashboardTab } from './components/DashboardTab';
import { DepositSheet } from './components/DepositSheet';
import { FeedTab } from './components/FeedTab';
import { OfflineIndicator } from './components/OfflineIndicator';
import { SettingsSheet } from './components/SettingsSheet';
import { WelcomeOnboarding } from './components/WelcomeOnboarding';

type ActiveTab = 'home' | 'feed';

function getInviteCodeFromUrl(): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code') || '';
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [vaults, setVaults] = useState<Vault[]>([]);
  const [vaultsLoaded, setVaultsLoaded] = useState(false);
  const [selectedVaultId, setSelectedVaultId] = useState<string | null>(null);

  const [contributions, setContributions] = useState<Contribution[]>([]);

  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [depositOpen, setDepositOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [justDepositedKey, setJustDepositedKey] = useState(0);
  const [milestoneBanner, setMilestoneBanner] = useState<string | null>(null);

  const initialInviteCode = useMemo(() => getInviteCodeFromUrl(), []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (!currentUser) {
        setVaults([]);
        setVaultsLoaded(false);
        setSelectedVaultId(null);
      }
    });
    return () => unsub();
  }, []);

  // Listen to user's vault in real time
  useEffect(() => {
    if (!authReady || !user) return;
    const q = query(
      collection(db, 'vaults'),
      where('memberUids', 'array-contains', user.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Vault);
        setVaults(list);
        setVaultsLoaded(true);
        if (list.length > 0) {
          setSelectedVaultId((prev) =>
            prev && list.some((v) => v.id === prev) ? prev : list[0].id
          );
          if (initialInviteCode && window.location.search.includes('code=')) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'vaults');
      }
    );
    return () => unsub();
  }, [authReady, user, initialInviteCode]);

  const activeVault = useMemo(
    () => vaults.find((v) => v.id === selectedVaultId) || vaults[0] || null,
    [vaults, selectedVaultId]
  );

  // Listen to active vault contributions in real time
  useEffect(() => {
    if (!authReady || !user || !activeVault) {
      setContributions([]);
      return;
    }

    const contribPath = `vaults/${activeVault.id}/contributions`;
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
  }, [authReady, user, activeVault]);

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
    if (!activeVault) return;
    const target = Math.max(1, activeVault.targetAmount);
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

  if (!authReady || (user && !vaultsLoaded)) {
    return (
      <div className="h-[100dvh] w-full overflow-hidden bg-[#FAF6F0] text-[#122638] flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="font-display text-2xl font-semibold text-[#122638]">
            SALVAFRICA
          </p>
          <p className="text-xs text-[#5B6B79]">Sincronizzazione salvadanaio...</p>
        </div>
      </div>
    );
  }

  if (!user || !activeVault) {
    return (
      <>
        <OfflineIndicator />
        <WelcomeOnboarding
          user={user}
          initialInviteCode={initialInviteCode}
          onVaultReady={(vaultId) => setSelectedVaultId(vaultId)}
        />
      </>
    );
  }

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-[#FAF6F0] text-[#122638] flex flex-col">
      <OfflineIndicator />

      {/* Top Navigation Bar */}
      <header className="shrink-0 z-30 bg-[#FAF6F0]/95 backdrop-blur-md border-b border-[#E6DDD1] pt-safe">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-8">
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
              className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#5B6B79] hover:bg-[#F2ECE3]"
            >
              <Settings className="w-5 h-5" />
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
              vault={activeVault}
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
              vault={activeVault}
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
        vault={activeVault}
        uid={user.uid}
        onSuccessDeposit={handleDepositSuccess}
      />

      <SettingsSheet
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        vault={activeVault}
      />
    </div>
  );
}
