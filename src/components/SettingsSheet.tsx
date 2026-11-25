import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Archive,
  Bell,
  BellRing,
  Check,
  Copy,
  Download,
  Moon,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Share,
  Share2,
  Smartphone,
  Sun,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  getPushEnvironmentStatus,
  sendTestPush,
} from '../services/notificationService';
import {
  DS_PARTNER_STYLES,
  getSheetBackdropMotion,
  getSheetPanelMotion,
} from '../styles/designSystem';
import {
  createCategory,
  renameCategory,
  setCategoryArchived,
  updateVaultSettings,
} from '../services/vaultService';
import {
  APP_LIMITS,
  Category,
  Contribution,
  NotificationPreferences,
  PartnerKey,
  PushSubscriptionRecord,
  Vault,
} from '../types';
import { getSourceIcon } from '../utils/sourceIcons';

interface SettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  vault: Vault;
  categories: Category[];
  contributions: Contribution[];
  pushSubscriptions: PushSubscriptionRecord[];
  isDark: boolean;
  onToggleTheme: () => void;
  currentPartnerKey: PartnerKey;
  onChangePartnerKey: (key: PartnerKey) => void;
  notifPrefs: NotificationPreferences;
  onUpdateNotifPrefs: (next: NotificationPreferences) => void;
  pushSubscribed: boolean;
  persistentVapid: boolean | null;
  onEnablePush: () => Promise<{
    ok: boolean;
    error?: string;
    needsSessionRefresh?: boolean;
  }>;
  onDisablePush: () => Promise<void>;
}

export const SettingsSheet: React.FC<SettingsSheetProps> = ({
  isOpen,
  onClose,
  vault,
  categories,
  contributions,
  pushSubscriptions,
  isDark,
  onToggleTheme,
  currentPartnerKey,
  onChangePartnerKey,
  notifPrefs,
  onUpdateNotifPrefs,
  pushSubscribed,
  persistentVapid,
  onEnablePush,
  onDisablePush,
}) => {
  const [title, setTitle] = useState(vault.title);
  const [targetAmount, setTargetAmount] = useState(String(vault.targetAmount));
  const [partnerAName, setPartnerAName] = useState(vault.partnerAName);
  const [partnerBName, setPartnerBName] = useState(vault.partnerBName);
  const [loveNote, setLoveNote] = useState(vault.loveNote);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  // Notification settings states
  const [pushBusy, setPushBusy] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [pushMessage, setPushMessage] = useState('');
  const [pushError, setPushError] = useState('');
  const [pushNeedsRefresh, setPushNeedsRefresh] = useState(false);

  // Category management states
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [catBusyId, setCatBusyId] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const [envTick, setEnvTick] = useState(0);

  const prefersReducedMotion = useReducedMotion();
  const backdropMotion = getSheetBackdropMotion(prefersReducedMotion);
  const panelMotion = getSheetPanelMotion(prefersReducedMotion);

  const { isInstallable, isInstalled, install } = usePWAInstall();

  useEffect(() => {
    if (!isOpen) return;
    setTitle(vault.title);
    setTargetAmount(String(vault.targetAmount));
    setPartnerAName(vault.partnerAName);
    setPartnerBName(vault.partnerBName);
    setLoveNote(vault.loveNote);
    setCopied(false);
    setNewCategoryName('');
    setEditingCatId(null);
    setEditingCatName('');
    setCategoryError('');
    setPushMessage('');
    setPushError('');
    setPushNeedsRefresh(false);
    setEnvTick((t) => t + 1);

    const refreshEnv = () => setEnvTick((t) => t + 1);
    window.addEventListener('focus', refreshEnv);
    document.addEventListener('visibilitychange', refreshEnv);
    return () => {
      window.removeEventListener('focus', refreshEnv);
      document.removeEventListener('visibilitychange', refreshEnv);
    };
  }, [isOpen, vault]);

  void envTick;
  const envStatus = getPushEnvironmentStatus();
  const currentPartnerName =
    currentPartnerKey === 'A' ? vault.partnerAName : vault.partnerBName;

  const partnerPushCounts = useMemo(() => {
    const aEndpoints = new Set<string>();
    const bEndpoints = new Set<string>();
    for (const sub of pushSubscriptions) {
      if (sub.partnerKey === 'A') aEndpoints.add(sub.endpoint);
      else if (sub.partnerKey === 'B') bEndpoints.add(sub.endpoint);
    }
    return { a: aEndpoints.size, b: bEndpoints.size };
  }, [pushSubscriptions]);

  const handleTogglePush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    setPushMessage('');
    setPushError('');
    setPushNeedsRefresh(false);
    try {
      if (pushSubscribed) {
        await onDisablePush();
        setPushMessage('Notifiche Push disattivate su questo dispositivo.');
      } else {
        const res = await onEnablePush();
        if (res.ok) {
          setPushMessage('Notifiche Push attivate su questo dispositivo.');
        } else {
          if (res.error) setPushError(res.error);
          if (res.needsSessionRefresh) setPushNeedsRefresh(true);
        }
      }
    } finally {
      setPushBusy(false);
    }
  };

  const handleSendTestPush = async () => {
    if (testingPush) return;
    setTestingPush(true);
    setPushMessage('');
    setPushError('');
    setPushNeedsRefresh(false);
    try {
      const res = await sendTestPush(
        vault.id,
        currentPartnerName,
        currentPartnerKey,
        notifPrefs
      );
      if (res.ok) {
        setPushMessage(res.message);
      } else {
        setPushError(res.message);
        if (res.needsSessionRefresh) setPushNeedsRefresh(true);
      }
    } finally {
      setTestingPush(false);
    }
  };

  const handleTogglePref = (key: keyof NotificationPreferences) => {
    onUpdateNotifPrefs({
      ...notifPrefs,
      [key]: !notifPrefs[key],
    });
  };

  const activeCategories = useMemo(
    () => categories.filter((c) => !c.archived),
    [categories]
  );

  const archivedCategories = useMemo(
    () => categories.filter((c) => c.archived),
    [categories]
  );

  const shareUrl = window.location.origin;

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  const handleShareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `SALVAFRICA · ${vault.title}`,
          text: 'Ecco il link diretto al nostro salvadanaio per l’Africa!',
          url: shareUrl,
        });
      } catch {
        // User cancelled share
      }
    } else {
      handleCopyInvite();
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateVaultSettings(vault.id, {
        title,
        destination: vault.destination,
        targetAmount: Number(targetAmount) || vault.targetAmount,
        partnerAName,
        partnerBName,
        loveNote,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingCategory) return;
    setCategoryError('');
    setCreatingCategory(true);
    try {
      await createCategory(vault.id, newCategoryName, categories);
      setNewCategoryName('');
    } catch (err) {
      setCategoryError(
        err instanceof Error
          ? err.message
          : 'Impossibile creare la categoria.'
      );
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleSaveRename = async (category: Category) => {
    if (catBusyId) return;
    setCategoryError('');
    setCatBusyId(category.id);
    try {
      await renameCategory(
        vault.id,
        category,
        editingCatName,
        categories,
        contributions
      );
      setEditingCatId(null);
      setEditingCatName('');
    } catch (err) {
      setCategoryError(
        err instanceof Error
          ? err.message
          : 'Impossibile rinominare la categoria.'
      );
    } finally {
      setCatBusyId(null);
    }
  };

  const handleToggleArchive = async (category: Category, nextArchived: boolean) => {
    if (catBusyId) return;
    setCategoryError('');
    setCatBusyId(category.id);
    try {
      await setCategoryArchived(vault.id, category.id, nextArchived);
      if (editingCatId === category.id) {
        setEditingCatId(null);
        setEditingCatName('');
      }
    } catch {
      setCategoryError('Operazione non riuscita. Riprova.');
    } finally {
      setCatBusyId(null);
    }
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
            aria-labelledby="settings-sheet-title"
          >
            <div className="ds-sheet-handle" />

            <div className="ds-sheet-header">
              <h2
                id="settings-sheet-title"
                className="ds-heading-sheet"
              >
                Impostazioni salvadanaio
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Chiudi"
                className="ds-btn-icon -mr-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="ds-sheet-body py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-6">
              {/* Theme Mode Toggle */}
              <div className="flex items-center justify-between gap-4 pb-5 border-b ds-divider">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-9 h-9 rounded-full bg-[#F2ECE3] dark:bg-[#162D42] flex items-center justify-center shrink-0">
                    {isDark ? (
                      <Moon className="w-4 h-4 text-[#F7C76E]" />
                    ) : (
                      <Sun className="w-4 h-4 text-[#E86A52]" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#122638] dark:text-[#FAF6F0]">
                      Modalità notte
                    </p>
                    <p className="ds-caption truncate">
                      {isDark ? 'Tema scuro oceano attivo' : 'Tema chiaro sabbia attivo'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={isDark}
                  aria-label="Attiva o disattiva modalità notte"
                  onClick={onToggleTheme}
                  className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A6B8A] ${
                    isDark
                      ? 'bg-[#1A6B8A] border-[#2D8FB3]'
                      : 'bg-[#E6DDD1] border-[#D8CEC0]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-xs transition-transform duration-150 ${
                      isDark ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Notifications & Push Section */}
              <section
                aria-label="Notifiche e avvisi"
                className="pb-5 border-b ds-divider space-y-4"
              >
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-[#E86A52]/12 dark:bg-[#E86A52]/20 flex items-center justify-center shrink-0">
                    <Bell className="w-4 h-4 text-[#E86A52]" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-display text-lg font-semibold text-[#122638] dark:text-[#FAF6F0]">
                      Notifiche e avvisi
                    </h3>
                    <p className="ds-caption">
                      Avvisi in app sempre attivi + notifiche Push sul telefono
                    </p>
                  </div>
                </div>

                {/* Device Partner Identity */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-[#5B6B79] dark:text-[#9DB0C0]">
                      Questo dispositivo è di
                    </span>
                    <div className="inline-flex items-center gap-1 rounded-full border ds-divider bg-[#F2ECE3]/65 dark:bg-[#162D42] p-0.5">
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
                  <p className="text-[11px] text-[#5B6B79] dark:text-[#9DB0C0]">
                    Dispositivi Push collegati:{' '}
                    <span className="font-semibold text-[#122638] dark:text-[#FAF6F0]">
                      {vault.partnerAName} ({partnerPushCounts.a})
                    </span>
                    {' · '}
                    <span className="font-semibold text-[#122638] dark:text-[#FAF6F0]">
                      {vault.partnerBName} ({partnerPushCounts.b})
                    </span>
                  </p>
                </div>

                {/* Permission Request Banner & Device Push Controls */}
                <div className="space-y-3 pt-1">
                  {pushSubscribed ? (
                    <div className="rounded-2xl border border-[#1A6B8A]/30 dark:border-[#2D8FB3]/35 bg-[#1A6B8A]/[0.06] dark:bg-[#1A6B8A]/[0.14] px-4 py-3.5 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-8 h-8 rounded-full bg-[#1A6B8A]/15 dark:bg-[#2D8FB3]/20 text-[#1A6B8A] dark:text-[#2D8FB3] flex items-center justify-center shrink-0">
                            <Check className="w-4 h-4 stroke-[2.25]" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#122638] dark:text-[#FAF6F0]">
                              Notifiche Push attive
                            </p>
                            <p className="text-xs text-[#5B6B79] dark:text-[#9DB0C0]">
                              Dispositivo registrato per {currentPartnerName}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          role="switch"
                          aria-checked={pushSubscribed}
                          aria-label="Disattiva notifiche Push"
                          disabled={pushBusy}
                          onClick={() => void handleTogglePush()}
                          className="relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border border-[#D1533C] bg-[#E86A52] transition-colors duration-200 disabled:opacity-45 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E86A52]"
                        >
                          <span className="pointer-events-none inline-block h-6 w-6 translate-x-7 transform rounded-full bg-white shadow-xs transition-transform duration-200" />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => void handleSendTestPush()}
                          disabled={testingPush}
                          className="min-h-[44px] px-4 rounded-full bg-[#FAF6F0] dark:bg-[#0E1F2E] border border-[#E6DDD1] dark:border-[#264561] text-xs font-semibold text-[#122638] dark:text-[#FAF6F0] hover:bg-[#F2ECE3] dark:hover:bg-[#162D42] inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5 text-[#E86A52]" />
                          <span>
                            {testingPush ? 'Invio...' : 'Invia notifica di prova'}
                          </span>
                        </button>

                        {persistentVapid === false && (
                          <span className="text-[11px] leading-snug text-[#85580D] dark:text-[#F7C76E]">
                            Chiavi VAPID temporanee: imposta VAPID nelle variabili ambiente per mantenerle tra i riavvii.
                          </span>
                        )}
                      </div>
                    </div>
                  ) : envStatus.isInIframe ? (
                    <div
                      role="region"
                      aria-label="Richiesta permessi notifiche"
                      className="rounded-2xl border border-[#E6DDD1] dark:border-[#264561] bg-[#F2ECE3]/65 dark:bg-[#162D42]/65 px-4 py-3.5 space-y-3"
                    >
                      <div className="flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 text-[#E86A52] shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#122638] dark:text-[#FAF6F0]">
                            Apri l’app fuori dall’anteprima
                          </p>
                          <p className="text-xs text-[#5B6B79] dark:text-[#9DB0C0] mt-0.5 leading-relaxed">
                            Il browser blocca i permessi Push dentro una finestra incorporata. Apri il link diretto in Safari/Chrome o installa SALVAFRICA sulla schermata Home.
                          </p>
                        </div>
                      </div>
                      <a
                        href={shareUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full ds-btn-primary"
                      >
                        <Bell className="w-4 h-4" />
                        <span>Apri in una nuova scheda</span>
                      </a>
                    </div>
                  ) : envStatus.isIOS && !envStatus.isStandalone ? (
                    <div
                      role="region"
                      aria-label="Istruzioni notifiche iPhone"
                      className="rounded-2xl border border-[#E86A52]/35 bg-[#E86A52]/[0.06] dark:bg-[#E86A52]/[0.11] px-4 py-3.5 space-y-2.5"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="w-8 h-8 rounded-full bg-[#E86A52]/15 text-[#E86A52] flex items-center justify-center shrink-0 mt-0.5">
                          <Smartphone className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#122638] dark:text-[#FAF6F0]">
                            Attiva le notifiche su iPhone
                          </p>
                          <p className="text-xs text-[#5B6B79] dark:text-[#9DB0C0] mt-0.5 leading-relaxed">
                            Su iOS le notifiche Push arrivano soltanto quando apri SALVAFRICA come app dalla schermata Home:
                          </p>
                        </div>
                      </div>

                      <ol className="space-y-1.5 pl-1 text-xs text-[#122638] dark:text-[#FAF6F0]">
                        <li className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-[#E86A52]/15 text-[#E86A52] text-[11px] font-bold flex items-center justify-center shrink-0">
                            1
                          </span>
                          <span className="inline-flex items-center gap-1 flex-wrap">
                            Tocca <Share className="w-3.5 h-3.5 text-[#1A6B8A] dark:text-[#2D8FB3] inline" /> <strong>Condividi</strong> in Safari
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-[#E86A52]/15 text-[#E86A52] text-[11px] font-bold flex items-center justify-center shrink-0">
                            2
                          </span>
                          <span>
                            Scegli <strong>Aggiungi alla schermata Home</strong>
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-[#E86A52]/15 text-[#E86A52] text-[11px] font-bold flex items-center justify-center shrink-0">
                            3
                          </span>
                          <span>
                            Apri SALVAFRICA dalla Home e tocca <strong>Consenti notifiche</strong>
                          </span>
                        </li>
                      </ol>
                    </div>
                  ) : envStatus.permission === 'denied' ? (
                    <div
                      role="region"
                      aria-label="Permesso notifiche bloccato"
                      className="rounded-2xl border border-[#D1533C]/35 bg-[#D1533C]/[0.07] dark:bg-[#E86A52]/[0.12] px-4 py-3.5 flex items-start gap-2.5"
                    >
                      <AlertCircle className="w-4 h-4 text-[#D1533C] dark:text-[#E86A52] shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#122638] dark:text-[#FAF6F0]">
                          Permesso notifiche bloccato
                        </p>
                        <p className="text-xs text-[#5B6B79] dark:text-[#9DB0C0] mt-0.5 leading-relaxed">
                          {envStatus.isIOS
                            ? 'Vai in Impostazioni di iPhone → SALVAFRICA → Notifiche e attiva “Consenti notifiche”, poi torna qui.'
                            : 'Abilita le notifiche per questo sito nelle impostazioni del browser e ricarica l’app.'}
                        </p>
                      </div>
                    </div>
                  ) : envStatus.supported ? (
                    <div
                      role="region"
                      aria-label="Richiesta permessi notifiche"
                      className="rounded-2xl border border-[#E86A52]/40 bg-[#E86A52]/[0.07] dark:bg-[#E86A52]/[0.12] px-4 py-3.5 space-y-3"
                    >
                      <div className="flex items-start gap-3">
                        <span className="w-9 h-9 rounded-full bg-[#E86A52]/15 text-[#E86A52] flex items-center justify-center shrink-0 mt-0.5">
                          <BellRing className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#122638] dark:text-[#FAF6F0]">
                            Attiva le notifiche sul telefono
                          </p>
                          <p className="text-xs text-[#5B6B79] dark:text-[#9DB0C0] mt-0.5 leading-relaxed">
                            Ricevi un avviso immediato quando l’altro partner versa un extra, lascia una reazione o sblocca un traguardo, anche ad app chiusa.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={pushBusy}
                        onClick={() => void handleTogglePush()}
                        className="w-full ds-btn-primary"
                      >
                        <Bell className="w-4 h-4" />
                        <span>
                          {pushBusy ? 'Richiesta permesso...' : 'Consenti notifiche'}
                        </span>
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-2xl border ds-divider bg-[#F2ECE3]/65 dark:bg-[#162D42]/65 px-4 py-3">
                      <p className="ds-caption leading-relaxed">
                        Questo browser non supporta le notifiche Push in background. Gli avvisi in app e la campanella restano comunque sempre attivi.
                      </p>
                    </div>
                  )}

                  {pushMessage && (
                    <p className="text-xs font-medium text-[#1A6B8A] dark:text-[#2D8FB3]">
                      {pushMessage}
                    </p>
                  )}
                  {pushError && (
                    <div className="space-y-2">
                      <p
                        role="alert"
                        className="text-xs font-medium text-[#D1533C] dark:text-[#E86A52]"
                      >
                        {pushError}
                      </p>
                      {pushNeedsRefresh && (
                        <button
                          type="button"
                          onClick={() => {
                            window.location.assign(`${window.location.origin}/?settings=1`);
                          }}
                          className="ds-btn-secondary w-full"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-[#1A6B8A] dark:text-[#2D8FB3]" />
                          <span>Aggiorna sessione</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Per-Event Preferences */}
                <div className="divide-y divide-[#E6DDD1]/75 dark:divide-[#264561]/75 border-t border-[#E6DDD1]/75 dark:border-[#264561]/75 pt-1">
                  {(
                    [
                      {
                        key: 'notifyDeposits',
                        label: 'Nuovi versamenti del partner',
                      },
                      {
                        key: 'notifyReactions',
                        label: 'Reazioni ai miei versamenti',
                      },
                      {
                        key: 'notifyMilestones',
                        label: 'Traguardi sbloccati',
                      },
                      {
                        key: 'notifyLoveNote',
                        label: 'Aggiornamenti al bigliettino di coppia',
                      },
                    ] as Array<{ key: keyof NotificationPreferences; label: string }>
                  ).map((pref) => {
                    const enabled = notifPrefs[pref.key];
                    return (
                      <div
                        key={pref.key}
                        className="py-2.5 flex items-center justify-between gap-3"
                      >
                        <span className="text-xs sm:text-sm text-[#122638] dark:text-[#FAF6F0]">
                          {pref.label}
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={enabled}
                          aria-label={pref.label}
                          onClick={() => handleTogglePref(pref.key)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A6B8A] ${
                            enabled
                              ? 'bg-[#1A6B8A] border-[#2D8FB3]'
                              : 'bg-[#E6DDD1] dark:bg-[#162D42] border-[#D8CEC0] dark:border-[#264561]'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform duration-150 ${
                              enabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Direct Couple Link Section */}
              <div className="pb-5 border-b ds-divider space-y-3">
                <div>
                  <p className="text-sm font-semibold text-[#122638] dark:text-[#FAF6F0]">
                    Link privato di SALVAFRICA
                  </p>
                  <p className="ds-caption mt-0.5 leading-relaxed">
                    Aprite lo stesso link sui vostri due telefoni per vedere e aggiornare il
                    salvadanaio in tempo reale, senza nessun login.
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleCopyInvite}
                    className="flex-1 ds-btn-secondary"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-[#1A6B8A] dark:text-[#2D8FB3]" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    <span>{copied ? 'Link copiato' : 'Copia link app'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleShareNative}
                    className="ds-btn-teal px-5"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Invia</span>
                  </button>
                </div>
              </div>

              {/* Custom Categories Management Section */}
              <section
                aria-label="Gestisci categorie"
                className="pb-5 border-b ds-divider space-y-3.5"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div>
                    <h3 className="font-display text-lg font-semibold text-[#122638] dark:text-[#FAF6F0]">
                      Gestisci categorie
                    </h3>
                    <p className="ds-caption">
                      Crea, rinomina o archivia le categorie dei versamenti
                    </p>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-[#1A6B8A] dark:text-[#2D8FB3] shrink-0">
                    {activeCategories.length} attive
                  </span>
                </div>

                {/* Inline New Category Creator */}
                <form onSubmit={handleAddCategory} className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={APP_LIMITS.categoryNameMax}
                    value={newCategoryName}
                    onChange={(e) => {
                      setNewCategoryName(e.target.value);
                      if (categoryError) setCategoryError('');
                    }}
                    placeholder="Nuova categoria..."
                    aria-label="Nuova categoria"
                    className="flex-1 ds-input-underline-coral py-1.5"
                  />
                  <button
                    type="submit"
                    disabled={creatingCategory}
                    className="ds-btn-primary shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.25]" />
                    <span>{creatingCategory ? 'Salvo...' : 'Aggiungi'}</span>
                  </button>
                </form>

                {categoryError && (
                  <p role="alert" className="text-xs font-medium text-[#D1533C] dark:text-[#E86A52]">
                    {categoryError}
                  </p>
                )}

                {/* Active Categories Editorial List */}
                {activeCategories.length === 0 ? (
                  <p className="ds-caption py-2">
                    Nessuna categoria attiva. Aggiungine una nuova qui sopra o riattiva una archiviata.
                  </p>
                ) : (
                  <ul className="divide-y divide-[#E6DDD1] dark:divide-[#264561] border-t ds-divider">
                    {activeCategories.map((cat) => {
                      const isEditing = editingCatId === cat.id;
                      const isBusy = catBusyId === cat.id;
                      return (
                        <li key={cat.id} className="py-2.5">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                maxLength={APP_LIMITS.categoryNameMax}
                                value={editingCatName}
                                onChange={(e) => {
                                  setEditingCatName(e.target.value);
                                  if (categoryError) setCategoryError('');
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    void handleSaveRename(cat);
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    setEditingCatId(null);
                                    setCategoryError('');
                                  }
                                }}
                                autoFocus
                                aria-label={`Rinomina ${cat.name}`}
                                className="flex-1 ds-input-underline py-1 border-b-2"
                              />
                              <button
                                type="button"
                                onClick={() => void handleSaveRename(cat)}
                                disabled={isBusy}
                                className="ds-btn-dark px-3.5 shrink-0"
                              >
                                {isBusy ? 'Salvo...' : 'Salva'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCatId(null);
                                  setCategoryError('');
                                }}
                                className="ds-btn-ghost px-2.5 shrink-0"
                              >
                                Annulla
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="w-7 h-7 rounded-full bg-[#1A6B8A]/10 dark:bg-[#2D8FB3]/18 text-[#1A6B8A] dark:text-[#2D8FB3] flex items-center justify-center shrink-0">
                                  {getSourceIcon(cat.name)}
                                </span>
                                <span className="text-sm font-medium text-[#122638] dark:text-[#FAF6F0] truncate">
                                  {cat.name}
                                </span>
                              </div>

                              <div className="flex items-center gap-0.5 shrink-0 -mr-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCatId(cat.id);
                                    setEditingCatName(cat.name);
                                    setCategoryError('');
                                  }}
                                  disabled={isBusy}
                                  aria-label={`Rinomina ${cat.name}`}
                                  className="ds-btn-icon"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleToggleArchive(cat, true)}
                                  disabled={isBusy}
                                  aria-label={`Archivia ${cat.name}`}
                                  className="ds-btn-icon hover:text-[#D1533C] dark:hover:text-[#E86A52] hover:bg-[#E86A52]/10"
                                >
                                  <Archive className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* Archived Categories Subsection */}
                {archivedCategories.length > 0 && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowArchived((prev) => !prev)}
                      aria-expanded={showArchived}
                      className="min-h-[44px] text-xs font-semibold text-[#5B6B79] dark:text-[#9DB0C0] hover:text-[#122638] dark:hover:text-[#FAF6F0] transition-colors duration-150 focus:outline-none focus-visible:underline"
                    >
                      {showArchived
                        ? `Nascondi archiviate (${archivedCategories.length})`
                        : `Mostra archiviate (${archivedCategories.length})`}
                    </button>

                    {showArchived && (
                      <ul className="mt-1 divide-y divide-[#E6DDD1] dark:divide-[#264561] border-t ds-divider">
                        {archivedCategories.map((cat) => {
                          const isBusy = catBusyId === cat.id;
                          return (
                            <li
                              key={cat.id}
                              className="py-2 flex items-center justify-between gap-3"
                            >
                              <span className="text-sm text-[#5B6B79] dark:text-[#9DB0C0] truncate">
                                {cat.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => void handleToggleArchive(cat, false)}
                                disabled={isBusy}
                                className="ds-btn-ghost text-[#1A6B8A] dark:text-[#2D8FB3] hover:bg-[#1A6B8A]/10 shrink-0"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Riattiva</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </section>

              {/* Vault Settings Form */}
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="ds-label mb-1">
                    Titolo vacanza
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={APP_LIMITS.titleMax}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="ds-input-underline py-1.5"
                  />
                </div>

                <div>
                  <label className="ds-label mb-1">
                    Obiettivo fisso a completamento (€)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={1000000}
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    className="ds-input-underline py-1.5 font-semibold tabular-nums"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="ds-label mb-1">
                      Nome Partner 1
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={APP_LIMITS.partnerNameMax}
                      value={partnerAName}
                      onChange={(e) => setPartnerAName(e.target.value)}
                      className="ds-input-underline-coral py-1.5"
                    />
                  </div>
                  <div>
                    <label className="ds-label mb-1">
                      Nome Partner 2
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={APP_LIMITS.partnerNameMax}
                      value={partnerBName}
                      onChange={(e) => setPartnerBName(e.target.value)}
                      className="ds-input-underline py-1.5"
                    />
                  </div>
                </div>

                <div>
                  <label className="ds-label mb-1">
                    Bigliettino di coppia
                  </label>
                  <input
                    type="text"
                    maxLength={APP_LIMITS.loveNoteMax}
                    value={loveNote}
                    onChange={(e) => setLoveNote(e.target.value)}
                    className="ds-input-underline py-1.5"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full min-h-[48px] ds-btn-dark text-sm"
                >
                  {saving ? 'Salvataggio...' : 'Salva modifiche'}
                </button>
              </form>

              {isInstallable && !isInstalled && (
                <div className="pt-4 border-t ds-divider">
                  <button
                    type="button"
                    onClick={() => install()}
                    className="w-full ds-btn-secondary"
                  >
                    <Download className="w-4 h-4 text-[#1A6B8A] dark:text-[#2D8FB3]" />
                    <span>Installa app sul dispositivo</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
