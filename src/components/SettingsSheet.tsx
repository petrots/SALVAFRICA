import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Check,
  Copy,
  Download,
  Moon,
  Pencil,
  Plus,
  RotateCcw,
  Share2,
  Sun,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  createCategory,
  renameCategory,
  setCategoryArchived,
  updateVaultSettings,
} from '../services/vaultService';
import { APP_LIMITS, Category, Contribution, Vault } from '../types';
import { getSourceIcon } from '../utils/sourceIcons';

interface SettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  vault: Vault;
  categories: Category[];
  contributions: Contribution[];
  isDark: boolean;
  onToggleTheme: () => void;
}

export const SettingsSheet: React.FC<SettingsSheetProps> = ({
  isOpen,
  onClose,
  vault,
  categories,
  contributions,
  isDark,
  onToggleTheme,
}) => {
  const [title, setTitle] = useState(vault.title);
  const [targetAmount, setTargetAmount] = useState(String(vault.targetAmount));
  const [partnerAName, setPartnerAName] = useState(vault.partnerAName);
  const [partnerBName, setPartnerBName] = useState(vault.partnerBName);
  const [loveNote, setLoveNote] = useState(vault.loveNote);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  // Category management states
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [catBusyId, setCatBusyId] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState('');
  const [showArchived, setShowArchived] = useState(false);

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
  }, [isOpen, vault]);

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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#122638]/55 dark:bg-[#07111A]/80 backdrop-blur-xs"
          />

          <motion.div
            initial={{ y: '100%', opacity: 0.85 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0.85 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-[#FAF6F0] dark:bg-[#0E1F2E] border-t sm:border border-[#E6DDD1] dark:border-[#264561] max-h-[90dvh] flex flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-sheet-title"
          >
            <div className="sm:hidden w-10 h-1 bg-[#E6DDD1] dark:bg-[#264561] rounded-full mx-auto mt-2.5 shrink-0" />

            <div className="shrink-0 flex items-center justify-between px-5 sm:px-6 pt-3 pb-3 border-b border-[#E6DDD1] dark:border-[#264561]">
              <h2
                id="settings-sheet-title"
                className="font-display text-xl sm:text-2xl font-semibold text-[#122638] dark:text-[#FAF6F0] tracking-tight"
              >
                Impostazioni salvadanaio
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Chiudi"
                className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-full text-[#5B6B79] dark:text-[#9DB0C0] hover:bg-[#F2ECE3] dark:hover:bg-[#162D42] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-6">
              {/* Theme Mode Toggle */}
              <div className="flex items-center justify-between gap-4 pb-5 border-b border-[#E6DDD1] dark:border-[#264561]">
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
                    <p className="text-xs text-[#5B6B79] dark:text-[#9DB0C0] truncate">
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
                  className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A6B8A] ${
                    isDark
                      ? 'bg-[#1A6B8A] border-[#2D8FB3]'
                      : 'bg-[#E6DDD1] border-[#D8CEC0]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-xs transition-transform duration-200 ${
                      isDark ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Direct Couple Link Section */}
              <div className="pb-5 border-b border-[#E6DDD1] dark:border-[#264561] space-y-3">
                <div>
                  <p className="text-sm font-semibold text-[#122638] dark:text-[#FAF6F0]">
                    Link privato di SALVAFRICA
                  </p>
                  <p className="text-xs text-[#5B6B79] dark:text-[#9DB0C0] mt-0.5 leading-relaxed">
                    Aprite lo stesso link sui vostri due telefoni per vedere e aggiornare il
                    salvadanaio in tempo reale, senza nessun login.
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleCopyInvite}
                    className="flex-1 min-h-[44px] rounded-full bg-[#F2ECE3] dark:bg-[#162D42] border border-[#E6DDD1] dark:border-[#264561] px-4 text-xs font-semibold text-[#122638] dark:text-[#FAF6F0] hover:bg-[#E6DDD1]/70 dark:hover:bg-[#1E3952] inline-flex items-center justify-center gap-2 transition-colors"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-[#1A6B8A] dark:text-[#2D8FB3]" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    {copied ? 'Link copiato' : 'Copia link app'}
                  </button>
                  <button
                    type="button"
                    onClick={handleShareNative}
                    className="min-h-[44px] px-5 rounded-full bg-[#1A6B8A] text-white text-xs font-semibold hover:bg-[#14556F] inline-flex items-center justify-center gap-2 transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                    Invia
                  </button>
                </div>
              </div>

              {/* Custom Categories Management Section */}
              <section
                aria-label="Gestisci categorie"
                className="pb-5 border-b border-[#E6DDD1] dark:border-[#264561] space-y-3.5"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div>
                    <h3 className="font-display text-lg font-semibold text-[#122638] dark:text-[#FAF6F0]">
                      Gestisci categorie
                    </h3>
                    <p className="text-xs text-[#5B6B79] dark:text-[#9DB0C0]">
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
                    className="flex-1 min-w-0 min-h-[44px] bg-transparent border-b border-[#E6DDD1] dark:border-[#264561] focus:border-[#E86A52] py-1.5 text-base text-[#122638] dark:text-[#FAF6F0] placeholder:text-[#5B6B79]/60 dark:placeholder:text-[#9DB0C0]/50 focus:outline-none transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={creatingCategory}
                    className="min-h-[44px] px-4 rounded-full bg-[#E86A52] text-xs font-semibold text-white hover:bg-[#D1533C] disabled:opacity-50 inline-flex items-center gap-1.5 shrink-0 transition-colors"
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
                  <p className="text-xs text-[#5B6B79] dark:text-[#9DB0C0] py-2">
                    Nessuna categoria attiva. Aggiungine una nuova qui sopra o riattiva una archiviata.
                  </p>
                ) : (
                  <ul className="divide-y divide-[#E6DDD1] dark:divide-[#264561] border-t border-[#E6DDD1] dark:border-[#264561]">
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
                                className="flex-1 min-w-0 min-h-[44px] bg-transparent border-b-2 border-[#1A6B8A] dark:border-[#2D8FB3] py-1 text-base text-[#122638] dark:text-[#FAF6F0] focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => void handleSaveRename(cat)}
                                disabled={isBusy}
                                className="min-h-[44px] px-3.5 rounded-full bg-[#122638] dark:bg-[#E86A52] text-xs font-semibold text-white shrink-0"
                              >
                                {isBusy ? 'Salvo...' : 'Salva'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCatId(null);
                                  setCategoryError('');
                                }}
                                className="min-h-[44px] px-2.5 text-xs font-semibold text-[#5B6B79] dark:text-[#9DB0C0] shrink-0"
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
                                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[#5B6B79] dark:text-[#9DB0C0] hover:text-[#122638] dark:hover:text-[#FAF6F0] hover:bg-[#F2ECE3] dark:hover:bg-[#162D42] transition-colors"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleToggleArchive(cat, true)}
                                  disabled={isBusy}
                                  aria-label={`Archivia ${cat.name}`}
                                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[#5B6B79] dark:text-[#9DB0C0] hover:text-[#D1533C] dark:hover:text-[#E86A52] hover:bg-[#E86A52]/10 transition-colors"
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
                      className="min-h-[40px] text-xs font-semibold text-[#5B6B79] dark:text-[#9DB0C0] hover:text-[#122638] dark:hover:text-[#FAF6F0] transition-colors"
                    >
                      {showArchived
                        ? `Nascondi archiviate (${archivedCategories.length})`
                        : `Mostra archiviate (${archivedCategories.length})`}
                    </button>

                    {showArchived && (
                      <ul className="mt-1 divide-y divide-[#E6DDD1] dark:divide-[#264561] border-t border-[#E6DDD1] dark:border-[#264561]">
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
                                className="min-h-[44px] px-3 rounded-full text-xs font-semibold text-[#1A6B8A] dark:text-[#2D8FB3] hover:bg-[#1A6B8A]/10 inline-flex items-center gap-1.5 shrink-0 transition-colors"
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
                  <label className="block text-xs font-semibold text-[#5B6B79] dark:text-[#9DB0C0] mb-1">
                    Titolo vacanza
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={APP_LIMITS.titleMax}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full min-h-[44px] bg-transparent border-b border-[#E6DDD1] dark:border-[#264561] focus:border-[#1A6B8A] py-1.5 text-base text-[#122638] dark:text-[#FAF6F0] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#5B6B79] dark:text-[#9DB0C0] mb-1">
                    Obiettivo fisso a completamento (€)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={1000000}
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    className="w-full min-h-[44px] bg-transparent border-b border-[#E6DDD1] dark:border-[#264561] focus:border-[#1A6B8A] py-1.5 text-base font-semibold tabular-nums text-[#122638] dark:text-[#FAF6F0] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#5B6B79] dark:text-[#9DB0C0] mb-1">
                      Nome Partner 1
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={APP_LIMITS.partnerNameMax}
                      value={partnerAName}
                      onChange={(e) => setPartnerAName(e.target.value)}
                      className="w-full min-h-[44px] bg-transparent border-b border-[#E6DDD1] dark:border-[#264561] focus:border-[#E86A52] py-1.5 text-base text-[#122638] dark:text-[#FAF6F0] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#5B6B79] dark:text-[#9DB0C0] mb-1">
                      Nome Partner 2
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={APP_LIMITS.partnerNameMax}
                      value={partnerBName}
                      onChange={(e) => setPartnerBName(e.target.value)}
                      className="w-full min-h-[44px] bg-transparent border-b border-[#E6DDD1] dark:border-[#264561] focus:border-[#1A6B8A] py-1.5 text-base text-[#122638] dark:text-[#FAF6F0] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#5B6B79] dark:text-[#9DB0C0] mb-1">
                    Bigliettino di coppia
                  </label>
                  <input
                    type="text"
                    maxLength={APP_LIMITS.loveNoteMax}
                    value={loveNote}
                    onChange={(e) => setLoveNote(e.target.value)}
                    className="w-full min-h-[44px] bg-transparent border-b border-[#E6DDD1] dark:border-[#264561] focus:border-[#1A6B8A] py-1.5 text-base text-[#122638] dark:text-[#FAF6F0] focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full min-h-[48px] rounded-full bg-[#122638] dark:bg-[#E86A52] text-white text-sm font-semibold hover:bg-[#1C3852] dark:hover:bg-[#D1533C] transition-colors disabled:opacity-60"
                >
                  {saving ? 'Salvataggio...' : 'Salva modifiche'}
                </button>
              </form>

              {isInstallable && !isInstalled && (
                <div className="pt-4 border-t border-[#E6DDD1] dark:border-[#264561]">
                  <button
                    type="button"
                    onClick={() => install()}
                    className="w-full min-h-[44px] rounded-full bg-[#F2ECE3] dark:bg-[#162D42] border border-[#E6DDD1] dark:border-[#264561] text-xs font-semibold text-[#122638] dark:text-[#FAF6F0] hover:bg-[#E6DDD1] dark:hover:bg-[#1E3952] transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4 text-[#1A6B8A] dark:text-[#2D8FB3]" />
                    Installa app sul dispositivo
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
