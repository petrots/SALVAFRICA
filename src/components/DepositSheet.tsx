import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { addContribution } from '../services/vaultService';
import {
  APP_LIMITS,
  EXTERNAL_SOURCE_TAGS,
  PartnerKey,
  Vault,
} from '../types';

interface DepositSheetProps {
  isOpen: boolean;
  onClose: () => void;
  vault: Vault;
  onSuccessDeposit: (addedAmount: number) => void;
}

const QUICK_AMOUNTS = [5, 10, 20, 50];

export const DepositSheet: React.FC<DepositSheetProps> = ({
  isOpen,
  onClose,
  vault,
  onSuccessDeposit,
}) => {
  const [amountStr, setAmountStr] = useState('20');
  const [partnerKey, setPartnerKey] = useState<PartnerKey>('A');
  const [sourceTag, setSourceTag] = useState<string>(EXTERNAL_SOURCE_TAGS[0]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    setAmountStr('20');
    setSourceTag(EXTERNAL_SOURCE_TAGS[0]);
    setNote('');
    try {
      const saved = window.localStorage.getItem('salvafrica_partner_key');
      setPartnerKey(saved === 'B' ? 'B' : 'A');
    } catch {
      setPartnerKey('A');
    }
  }, [isOpen]);

  const handleQuickAdd = (preset: number) => {
    setAmountStr(String(preset));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const parsed = Number(amountStr.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setErrorMsg('Inserisci un importo valido maggiore di 0 €.');
      return;
    }

    const partnerName = partnerKey === 'A' ? vault.partnerAName : vault.partnerBName;
    try {
      window.localStorage.setItem('salvafrica_partner_key', partnerKey);
    } catch {
      // Ignore storage restrictions
    }
    setSubmitting(true);
    try {
      await addContribution(vault.id, {
        amount: parsed,
        partnerKey,
        partnerName,
        sourceTag,
        note,
      });
      onSuccessDeposit(parsed);
      onClose();
    } catch {
      setErrorMsg('Salvataggio non riuscito. Controlla la connessione e riprova.');
    } finally {
      setSubmitting(false);
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
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#122638]/45 backdrop-blur-xs"
          />

          <motion.div
            initial={{ y: '100%', opacity: 0.8 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0.8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-white border border-[#E6DDD1] shadow-xl max-h-[90dvh] flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deposit-sheet-title"
          >
            <div className="sm:hidden w-10 h-1.5 bg-[#E6DDD1] rounded-full mx-auto mt-3" />

            <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-[#E6DDD1]">
              <div>
                <h2 id="deposit-sheet-title" className="font-display text-xl font-semibold text-[#122638]">
                  Nuovo versamento extra
                </h2>
                <p className="text-xs text-[#5B6B79]">
                  Solo entrate extra esterne (zero stipendio e zero risparmi)
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Chiudi"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#5B6B79] hover:bg-[#F2ECE3] hover:text-[#122638] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 space-y-5">
              {errorMsg && (
                <div className="rounded-xl bg-[#E86A52]/10 border border-[#E86A52]/30 px-3.5 py-2.5 text-sm text-[#D1533C]">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#5B6B79] mb-2">
                  Importo (€)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    min="0.5"
                    max="100000"
                    required
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    className="w-full min-h-[56px] rounded-2xl border border-[#E6DDD1] bg-[#FAF6F0] px-4 pr-12 font-display text-3xl font-semibold tabular-nums text-[#122638] focus:outline-none focus:border-[#E86A52]"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-display text-2xl font-semibold text-[#5B6B79]">
                    €
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-2.5">
                  {QUICK_AMOUNTS.map((val) => {
                    const active = Number(amountStr) === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleQuickAdd(val)}
                        className={`min-h-[44px] rounded-xl text-sm font-semibold tabular-nums transition-colors ${
                          active
                            ? 'bg-[#122638] text-white'
                            : 'bg-[#F2ECE3] text-[#122638] hover:bg-[#E6DDD1]'
                        }`}
                      >
                        +{val} €
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#5B6B79] mb-2">
                  Chi sta versando?
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPartnerKey('A')}
                    className={`min-h-[46px] rounded-xl px-4 text-sm font-semibold transition-all border flex items-center justify-center gap-2 ${
                      partnerKey === 'A'
                        ? 'bg-[#E86A52] text-white border-[#E86A52] shadow-xs'
                        : 'bg-white text-[#122638] border-[#E6DDD1] hover:bg-[#FAF6F0]'
                    }`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        partnerKey === 'A' ? 'bg-white' : 'bg-[#E86A52]'
                      }`}
                    />
                    <span className="truncate">{vault.partnerAName}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPartnerKey('B')}
                    className={`min-h-[46px] rounded-xl px-4 text-sm font-semibold transition-all border flex items-center justify-center gap-2 ${
                      partnerKey === 'B'
                        ? 'bg-[#1A6B8A] text-white border-[#1A6B8A] shadow-xs'
                        : 'bg-white text-[#122638] border-[#E6DDD1] hover:bg-[#FAF6F0]'
                    }`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        partnerKey === 'B' ? 'bg-white' : 'bg-[#1A6B8A]'
                      }`}
                    />
                    <span className="truncate">{vault.partnerBName}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#5B6B79] mb-2">
                  Da quale attività esterna arrivano?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {EXTERNAL_SOURCE_TAGS.map((tag) => {
                    const selected = sourceTag === tag;
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setSourceTag(tag)}
                        className={`min-h-[44px] rounded-xl px-3 py-2 text-xs font-medium text-left transition-colors border ${
                          selected
                            ? 'bg-[#122638] text-white border-[#122638]'
                            : 'bg-[#FAF6F0] text-[#122638] border-[#E6DDD1] hover:bg-[#F2ECE3]'
                        }`}
                      >
                        <span className="line-clamp-1">{tag}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#5B6B79] mb-1.5">
                  Dettaglio attività o dedica (opzionale)
                </label>
                <input
                  type="text"
                  maxLength={APP_LIMITS.contributionNoteMax}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Es. Venduta giacca su Vinted · Per l’Africa"
                  className="w-full min-h-[44px] rounded-xl border border-[#E6DDD1] bg-[#FAF6F0] px-3.5 text-sm text-[#122638] focus:outline-none focus:border-[#1A6B8A]"
                />
              </div>

              <div className="pt-1 pb-safe">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full min-h-[48px] rounded-2xl bg-[#E86A52] px-5 py-3 text-sm font-semibold text-white hover:bg-[#D1533C] active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  {submitting ? 'Salvataggio...' : 'Metti nel salvadanaio'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
