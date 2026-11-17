import React, { useEffect, useState } from 'react';
import { Check, Copy, Download, Moon, Share2, Sun, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { updateVaultSettings } from '../services/vaultService';
import { APP_LIMITS, Vault } from '../types';

interface SettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  vault: Vault;
  isDark: boolean;
  onToggleTheme: () => void;
}

export const SettingsSheet: React.FC<SettingsSheetProps> = ({
  isOpen,
  onClose,
  vault,
  isDark,
  onToggleTheme,
}) => {
  const [title, setTitle] = useState(vault.title);
  const [destination, setDestination] = useState(vault.destination);
  const [targetAmount, setTargetAmount] = useState(String(vault.targetAmount));
  const [partnerAName, setPartnerAName] = useState(vault.partnerAName);
  const [partnerBName, setPartnerBName] = useState(vault.partnerBName);
  const [loveNote, setLoveNote] = useState(vault.loveNote);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const { isInstallable, isInstalled, install } = usePWAInstall();

  useEffect(() => {
    if (!isOpen) return;
    setTitle(vault.title);
    setDestination(vault.destination);
    setTargetAmount(String(vault.targetAmount));
    setPartnerAName(vault.partnerAName);
    setPartnerBName(vault.partnerBName);
    setLoveNote(vault.loveNote);
    setCopied(false);
  }, [isOpen, vault]);

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
        destination,
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

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#122638]/50 dark:bg-[#07111A]/75 backdrop-blur-xs"
          />

          <motion.div
            initial={{ y: '100%', opacity: 0.8 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0.8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#162D42] border border-[#E6DDD1] dark:border-[#264561] shadow-xl max-h-[90vh] flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-sheet-title"
          >
            <div className="sm:hidden w-10 h-1.5 bg-[#E6DDD1] dark:bg-[#264561] rounded-full mx-auto mt-3" />

            <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-[#E6DDD1] dark:border-[#264561]">
              <h2
                id="settings-sheet-title"
                className="font-display text-xl font-semibold text-[#122638] dark:text-[#FAF6F0]"
              >
                Impostazioni salvadanaio
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Chiudi"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#5B6B79] dark:text-[#9DB0C0] hover:bg-[#F2ECE3] dark:hover:bg-[#1E3952]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5 space-y-6">
              {/* Theme Mode Toggle */}
              <div className="rounded-2xl bg-[#F2ECE3] dark:bg-[#1E3952] p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-xl bg-white dark:bg-[#162D42] border border-[#E6DDD1] dark:border-[#264561] flex items-center justify-center shrink-0">
                    {isDark ? (
                      <Moon className="w-4 h-4 text-[#F7C76E]" />
                    ) : (
                      <Sun className="w-4 h-4 text-[#E86A52]" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#122638] dark:text-[#FAF6F0]">
                      Modalità notte
                    </p>
                    <p className="text-xs text-[#5B6B79] dark:text-[#9DB0C0] mt-0.5 truncate">
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
              <div className="rounded-2xl bg-[#F2ECE3] dark:bg-[#1E3952] p-4 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-[#122638] dark:text-[#FAF6F0]">
                    Link privato di SALVAFRICA
                  </p>
                  <p className="text-xs text-[#5B6B79] dark:text-[#9DB0C0] mt-0.5">
                    Aprite lo stesso link sui vostri due telefoni per vedere e aggiornare il
                    salvadanaio in tempo reale, senza nessun login.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyInvite}
                    className="flex-1 min-h-[44px] rounded-xl bg-white dark:bg-[#162D42] border border-[#E6DDD1] dark:border-[#264561] px-3 text-xs font-semibold text-[#122638] dark:text-[#FAF6F0] hover:bg-[#FAF6F0] dark:hover:bg-[#112436] inline-flex items-center justify-center gap-2"
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
                    className="min-h-[44px] px-4 rounded-xl bg-[#1A6B8A] text-white text-xs font-semibold hover:bg-[#14556F] inline-flex items-center justify-center gap-2"
                  >
                    <Share2 className="w-4 h-4" />
                    Invia
                  </button>
                </div>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
                      className="w-full min-h-[44px] rounded-xl border border-[#E6DDD1] dark:border-[#264561] bg-[#FAF6F0] dark:bg-[#112436] px-3.5 text-base text-[#122638] dark:text-[#FAF6F0] focus:outline-none focus:border-[#1A6B8A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#5B6B79] dark:text-[#9DB0C0] mb-1">
                      Destinazione
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={APP_LIMITS.destinationMax}
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-[#E6DDD1] dark:border-[#264561] bg-[#FAF6F0] dark:bg-[#112436] px-3.5 text-base text-[#122638] dark:text-[#FAF6F0] focus:outline-none focus:border-[#1A6B8A]"
                    />
                  </div>
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
                    className="w-full min-h-[44px] rounded-xl border border-[#E6DDD1] dark:border-[#264561] bg-[#FAF6F0] dark:bg-[#112436] px-3.5 text-base font-semibold tabular-nums text-[#122638] dark:text-[#FAF6F0] focus:outline-none focus:border-[#1A6B8A]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3.5">
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
                      className="w-full min-h-[44px] rounded-xl border border-[#E6DDD1] dark:border-[#264561] bg-[#FAF6F0] dark:bg-[#112436] px-3.5 text-base text-[#122638] dark:text-[#FAF6F0] focus:outline-none focus:border-[#E86A52]"
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
                      className="w-full min-h-[44px] rounded-xl border border-[#E6DDD1] dark:border-[#264561] bg-[#FAF6F0] dark:bg-[#112436] px-3.5 text-base text-[#122638] dark:text-[#FAF6F0] focus:outline-none focus:border-[#1A6B8A]"
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
                    className="w-full min-h-[44px] rounded-xl border border-[#E6DDD1] dark:border-[#264561] bg-[#FAF6F0] dark:bg-[#112436] px-3.5 text-base text-[#122638] dark:text-[#FAF6F0] focus:outline-none focus:border-[#1A6B8A]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full min-h-[48px] rounded-xl bg-[#122638] dark:bg-[#E86A52] text-white text-sm font-semibold hover:bg-[#1C3852] dark:hover:bg-[#D1533C] transition-colors disabled:opacity-60"
                >
                  {saving ? 'Salvataggio...' : 'Salva modifiche'}
                </button>
              </form>

              {isInstallable && !isInstalled && (
                <div className="pt-3 border-t border-[#E6DDD1] dark:border-[#264561] pb-safe">
                  <button
                    type="button"
                    onClick={() => install()}
                    className="w-full min-h-[44px] rounded-xl bg-[#F2ECE3] dark:bg-[#1E3952] text-xs font-semibold text-[#122638] dark:text-[#FAF6F0] hover:bg-[#E6DDD1] dark:hover:bg-[#264561] transition-colors inline-flex items-center justify-center gap-2"
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
