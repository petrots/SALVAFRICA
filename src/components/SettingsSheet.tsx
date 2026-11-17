import React, { useEffect, useState } from 'react';
import { Check, Copy, Download, LogOut, Share2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { signOutUser } from '../firebase';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { updateVaultSettings } from '../services/vaultService';
import { APP_LIMITS, Vault } from '../types';

interface SettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  vault: Vault;
}

export const SettingsSheet: React.FC<SettingsSheetProps> = ({
  isOpen,
  onClose,
  vault,
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

  const inviteUrl = `${window.location.origin}/?code=${vault.inviteCode}`;

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
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
          text: `Unisciti al nostro salvadanaio per l’Africa! Codice: ${vault.inviteCode}`,
          url: inviteUrl,
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
            className="fixed inset-0 bg-[#132638]/45 backdrop-blur-xs"
          />

          <motion.div
            initial={{ y: '100%', opacity: 0.8 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0.8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-white border border-[#E8E2D9] shadow-xl max-h-[90vh] flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-sheet-title"
          >
            <div className="sm:hidden w-10 h-1.5 bg-[#E8E2D9] rounded-full mx-auto mt-3" />

            <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-[#E8E2D9]">
              <h2 id="settings-sheet-title" className="font-display text-xl font-semibold text-[#132638]">
                Impostazioni e invito partner
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Chiudi"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#5C6B7A] hover:bg-[#F2ECE4]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5 space-y-6">
              {/* Couple Invite Section */}
              <div className="rounded-2xl bg-[#F2ECE4] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-[#132638]">
                      Invito privato per il tuo partner
                    </p>
                    <p className="text-xs text-[#5C6B7A] mt-0.5">
                      {vault.memberUids.length >= 2
                        ? 'Entrambi siete già collegati a questo salvadanaio.'
                        : 'Condividi questo link segreto: vale per un solo partner.'}
                    </p>
                  </div>
                  <span className="font-mono text-xs font-semibold text-[#1A6B8A] shrink-0">
                    {vault.inviteCode}
                  </span>
                </div>

                {vault.memberUids.length < 2 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyInvite}
                      className="flex-1 min-h-[44px] rounded-xl bg-white border border-[#E8E2D9] px-3 text-xs font-semibold text-[#132638] hover:bg-[#FAF8F5] inline-flex items-center justify-center gap-2"
                    >
                      {copied ? <Check className="w-4 h-4 text-[#1A6B8A]" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'Link copiato' : 'Copia link privato'}
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
                )}
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-[#5C6B7A] mb-1">
                      Titolo vacanza
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={APP_LIMITS.titleMax}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-[#E8E2D9] bg-[#FAF8F5] px-3.5 text-sm text-[#132638]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#5C6B7A] mb-1">
                      Destinazione
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={APP_LIMITS.destinationMax}
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-[#E8E2D9] bg-[#FAF8F5] px-3.5 text-sm text-[#132638]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#5C6B7A] mb-1">
                    Obiettivo fisso a completamento (€)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={1000000}
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-[#E8E2D9] bg-[#FAF8F5] px-3.5 text-sm font-semibold tabular-nums text-[#132638]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-[#5C6B7A] mb-1">
                      Nome Partner 1
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={APP_LIMITS.partnerNameMax}
                      value={partnerAName}
                      onChange={(e) => setPartnerAName(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-[#E8E2D9] bg-[#FAF8F5] px-3.5 text-sm text-[#132638]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#5C6B7A] mb-1">
                      Nome Partner 2
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={APP_LIMITS.partnerNameMax}
                      value={partnerBName}
                      onChange={(e) => setPartnerBName(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-[#E8E2D9] bg-[#FAF8F5] px-3.5 text-sm text-[#132638]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#5C6B7A] mb-1">
                    Bigliettino di coppia
                  </label>
                  <input
                    type="text"
                    maxLength={APP_LIMITS.loveNoteMax}
                    value={loveNote}
                    onChange={(e) => setLoveNote(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-[#E8E2D9] bg-[#FAF8F5] px-3.5 text-sm text-[#132638]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full min-h-[48px] rounded-xl bg-[#132638] text-white text-sm font-semibold hover:bg-[#1C3852] transition-colors disabled:opacity-60"
                >
                  {saving ? 'Salvataggio...' : 'Salva modifiche'}
                </button>
              </form>

              <div className="pt-3 border-t border-[#E8E2D9] pb-safe space-y-2">
                {isInstallable && !isInstalled && (
                  <button
                    type="button"
                    onClick={() => install()}
                    className="w-full min-h-[44px] rounded-xl bg-[#F2ECE4] text-xs font-semibold text-[#132638] hover:bg-[#E8E2D9] transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4 text-[#1A6B8A]" />
                    Installa app sul dispositivo
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => signOutUser()}
                  className="w-full min-h-[44px] rounded-xl text-xs font-semibold text-[#5C6B7A] hover:text-[#D1533C] hover:bg-[#E86A52]/10 transition-colors inline-flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Disconnetti questo dispositivo
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
