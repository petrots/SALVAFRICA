import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { addContribution } from '../services/vaultService';
import {
  APP_LIMITS,
  EXTERNAL_SOURCE_TAGS,
  PartnerKey,
  Vault,
} from '../types';
import { formatEuro } from '../utils/format';
import { getSourceIcon } from '../utils/sourceIcons';

interface DepositSheetProps {
  isOpen: boolean;
  onClose: () => void;
  vault: Vault;
  onSuccessDeposit: (addedAmount: number) => void;
}

const QUICK_AMOUNTS = [5, 10, 20, 50];

function sanitizeAmountInput(raw: string): string {
  // Allow digits and at most one decimal separator (comma or dot), up to 2 decimal places
  let cleaned = raw.replace(/[^\d.,]/g, '');
  const firstSepIdx = cleaned.search(/[.,]/);
  if (firstSepIdx !== -1) {
    const intPart = cleaned.slice(0, firstSepIdx);
    const sep = cleaned[firstSepIdx];
    const decPart = cleaned
      .slice(firstSepIdx + 1)
      .replace(/[.,]/g, '')
      .slice(0, 2);
    cleaned = `${intPart}${sep}${decPart}`;
  }
  return cleaned;
}

function parseAmountValue(raw: string): number {
  if (!raw.trim()) return NaN;
  const normalized = raw.replace(',', '.');
  const num = Number(normalized);
  if (!Number.isFinite(num)) return NaN;
  return Math.round(num * 100) / 100;
}

export const DepositSheet: React.FC<DepositSheetProps> = ({
  isOpen,
  onClose,
  vault,
  onSuccessDeposit,
}) => {
  const [amountStr, setAmountStr] = useState('20');
  const [amountTouched, setAmountTouched] = useState(false);
  const [partnerKey, setPartnerKey] = useState<PartnerKey>('A');
  const [sourceTag, setSourceTag] = useState<string>(EXTERNAL_SOURCE_TAGS[0]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmedAmount, setConfirmedAmount] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  const submittingLockRef = useRef(false);
  const closeTimerRef = useRef<number | null>(null);
  const amountInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      return;
    }

    submittingLockRef.current = false;
    setSubmitting(false);
    setConfirmedAmount(null);
    setErrorMsg('');
    setAmountStr('20');
    setAmountTouched(false);
    setSourceTag(EXTERNAL_SOURCE_TAGS[0]);
    setNote('');
    setKeyboardOpen(false);
    try {
      const saved = window.localStorage.getItem('salvafrica_partner_key');
      setPartnerKey(saved === 'B' ? 'B' : 'A');
    } catch {
      setPartnerKey('A');
    }
  }, [isOpen]);

  // Keep modal fitted above the iPhone software keyboard when visualViewport shrinks
  useEffect(() => {
    if (!isOpen) {
      setViewportHeight(null);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;

    const syncHeight = () => {
      setViewportHeight(Math.round(vv.height));
    };
    syncHeight();
    vv.addEventListener('resize', syncHeight);
    vv.addEventListener('scroll', syncHeight);
    return () => {
      vv.removeEventListener('resize', syncHeight);
      vv.removeEventListener('scroll', syncHeight);
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const parsedAmount = useMemo(() => parseAmountValue(amountStr), [amountStr]);
  const isAmountValid =
    Number.isFinite(parsedAmount) && parsedAmount >= 0.01 && parsedAmount <= 100000;

  const amountValidationHint = useMemo(() => {
    if (!amountTouched || amountStr.trim() === '' || isAmountValid) {
      if (amountTouched && amountStr.trim() === '') {
        return 'Inserisci un importo per continuare.';
      }
      return '';
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return 'L’importo deve essere maggiore di 0 €.';
    }
    if (parsedAmount > 100000) {
      return 'L’importo massimo per singolo versamento è 100.000 €.';
    }
    return '';
  }, [amountTouched, amountStr, isAmountValid, parsedAmount]);

  const dismissKeyboard = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setKeyboardOpen(false);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmountTouched(true);
    setErrorMsg('');
    setAmountStr(sanitizeAmountInput(e.target.value));
  };

  const handleQuickAdd = (preset: number) => {
    dismissKeyboard();
    setAmountTouched(true);
    setErrorMsg('');
    setAmountStr(String(preset));
  };

  const handleSelectPartner = (key: PartnerKey) => {
    dismissKeyboard();
    setPartnerKey(key);
    try {
      window.localStorage.setItem('salvafrica_partner_key', key);
    } catch {
      // Ignore storage restrictions
    }
  };

  const handleSelectSource = (tag: string) => {
    dismissKeyboard();
    setSourceTag(tag);
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setKeyboardOpen(true);
    const target = e.currentTarget;
    window.setTimeout(() => {
      target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 180);
  };

  const handleInputBlur = () => {
    window.setTimeout(() => {
      const active = document.activeElement;
      if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA')) {
        setKeyboardOpen(false);
      }
    }, 80);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingLockRef.current || confirmedAmount !== null) return;

    setAmountTouched(true);
    setErrorMsg('');

    if (!isAmountValid) {
      setErrorMsg('Inserisci un importo valido maggiore di 0 € (es. 2,50).');
      amountInputRef.current?.focus();
      return;
    }

    dismissKeyboard();
    submittingLockRef.current = true;
    setSubmitting(true);

    const partnerName = partnerKey === 'A' ? vault.partnerAName : vault.partnerBName;
    try {
      window.localStorage.setItem('salvafrica_partner_key', partnerKey);
    } catch {
      // Ignore storage restrictions
    }

    try {
      await addContribution(vault.id, {
        amount: parsedAmount,
        partnerKey,
        partnerName,
        sourceTag,
        note,
      });
      onSuccessDeposit(parsedAmount);
      setConfirmedAmount(parsedAmount);
      closeTimerRef.current = window.setTimeout(() => {
        onClose();
      }, 1150);
    } catch {
      submittingLockRef.current = false;
      setErrorMsg('Salvataggio non riuscito. Controlla la connessione e riprova.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedPartnerName = partnerKey === 'A' ? vault.partnerAName : vault.partnerBName;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => {
              dismissKeyboard();
              onClose();
            }}
            className="fixed inset-0 bg-[#122638]/45 dark:bg-[#07111A]/75 backdrop-blur-xs"
          />

          <motion.div
            initial={{ y: '100%', opacity: 0.85 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0.85 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{
              maxHeight: viewportHeight ? `${Math.max(320, viewportHeight - 16)}px` : '92dvh',
            }}
            className="relative z-10 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#162D42] border border-[#E6DDD1] dark:border-[#264561] shadow-xl flex flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deposit-sheet-title"
          >
            {/* Drag handle & Header */}
            <div
              onClick={dismissKeyboard}
              className="shrink-0 border-b border-[#E6DDD1] dark:border-[#264561]"
            >
              <div className="sm:hidden w-10 h-1.5 bg-[#E6DDD1] dark:bg-[#264561] rounded-full mx-auto mt-3" />

              <div className="flex items-center justify-between px-5 sm:px-6 pt-3.5 pb-3 gap-3">
                <div className="min-w-0">
                  <h2
                    id="deposit-sheet-title"
                    className="font-display text-xl font-semibold text-[#122638] dark:text-[#FAF6F0]"
                  >
                    Nuovo versamento extra
                  </h2>
                  <p className="text-xs text-[#5B6B79] dark:text-[#9DB0C0] truncate">
                    Solo entrate extra esterne (zero stipendio e zero risparmi)
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {keyboardOpen && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={dismissKeyboard}
                      className="min-h-[38px] px-2.5 rounded-xl bg-[#F2ECE3] dark:bg-[#1E3952] text-xs font-semibold text-[#122638] dark:text-[#FAF6F0] inline-flex items-center gap-1"
                    >
                      <span>Fine</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      dismissKeyboard();
                      onClose();
                    }}
                    aria-label="Chiudi"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#5B6B79] dark:text-[#9DB0C0] hover:bg-[#F2ECE3] dark:hover:bg-[#1E3952] hover:text-[#122638] dark:hover:text-[#FAF6F0] transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {confirmedAmount !== null ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="px-6 py-10 pb-safe flex flex-col items-center text-center space-y-3"
              >
                <span className="w-14 h-14 rounded-2xl bg-[#E86A52] text-white flex items-center justify-center shadow-md shadow-[#E86A52]/30">
                  <Check className="w-7 h-7 stroke-[2.75]" />
                </span>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#1A6B8A] dark:text-[#2D8FB3]">
                    Versamento registrato
                  </p>
                  <p className="font-display text-4xl font-semibold tabular-nums text-[#122638] dark:text-[#FAF6F0]">
                    +{formatEuro(confirmedAmount)}
                  </p>
                  <p className="text-sm text-[#5B6B79] dark:text-[#9DB0C0]">
                    Aggiunto da <span className="font-semibold text-[#122638] dark:text-[#FAF6F0]">{selectedPartnerName}</span> · {sourceTag}
                  </p>
                </div>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="flex-1 min-h-0 flex flex-col">
                {/* Scrollable Body */}
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6 py-4 space-y-5">
                  {errorMsg && (
                    <div
                      role="alert"
                      className="rounded-xl bg-[#E86A52]/12 border border-[#E86A52]/35 px-3.5 py-2.5 text-sm font-medium text-[#D1533C] dark:text-[#E86A52]"
                    >
                      {errorMsg}
                    </div>
                  )}

                  {/* 1. Hero Amount Section */}
                  <div className="rounded-2xl bg-[#FAF6F0] dark:bg-[#112436] border border-[#E6DDD1] dark:border-[#264561] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="deposit-amount-input"
                        className="text-xs font-semibold text-[#5B6B79] dark:text-[#9DB0C0]"
                      >
                        Importo guadagnato
                      </label>
                      <span className="text-[11px] font-medium text-[#5B6B79] dark:text-[#9DB0C0]">
                        Es. 2,50 €
                      </span>
                    </div>

                    <div className="relative flex items-center rounded-2xl bg-white dark:bg-[#162D42] border-2 border-[#E6DDD1] dark:border-[#264561] focus-within:border-[#E86A52] dark:focus-within:border-[#E86A52] px-4 transition-colors">
                      <input
                        ref={amountInputRef}
                        id="deposit-amount-input"
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        enterKeyHint="done"
                        placeholder="0,00"
                        value={amountStr}
                        onChange={handleAmountChange}
                        onFocus={handleInputFocus}
                        onBlur={handleInputBlur}
                        aria-invalid={Boolean(amountValidationHint)}
                        className="w-full min-h-[62px] bg-transparent pr-10 font-display text-4xl font-semibold tabular-nums text-[#122638] dark:text-[#FAF6F0] placeholder:text-[#5B6B79]/40 dark:placeholder:text-[#9DB0C0]/40 focus:outline-none"
                      />
                      <span
                        aria-hidden="true"
                        className="shrink-0 font-display text-3xl font-semibold text-[#E86A52]"
                      >
                        €
                      </span>
                    </div>

                    {amountValidationHint && (
                      <p className="text-xs font-medium text-[#D1533C] dark:text-[#E86A52]">
                        {amountValidationHint}
                      </p>
                    )}

                    <div className="grid grid-cols-4 gap-2">
                      {QUICK_AMOUNTS.map((val) => {
                        const active = parsedAmount === val;
                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() => handleQuickAdd(val)}
                            aria-pressed={active}
                            className={`min-h-[44px] rounded-xl text-sm font-semibold tabular-nums transition-all border ${
                              active
                                ? 'bg-[#122638] dark:bg-[#E86A52] text-white border-[#122638] dark:border-[#E86A52] shadow-xs'
                                : 'bg-white dark:bg-[#162D42] text-[#122638] dark:text-[#FAF6F0] border-[#E6DDD1] dark:border-[#264561] hover:bg-[#F2ECE3] dark:hover:bg-[#1E3952]'
                            }`}
                          >
                            +{val} €
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Partner Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-[#5B6B79] dark:text-[#9DB0C0] mb-2">
                      Chi sta versando?
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleSelectPartner('A')}
                        aria-pressed={partnerKey === 'A'}
                        className={`min-h-[48px] rounded-xl px-3.5 text-sm font-semibold transition-all border flex items-center justify-between gap-2 ${
                          partnerKey === 'A'
                            ? 'bg-[#E86A52] text-white border-[#E86A52] shadow-sm'
                            : 'bg-[#FAF6F0] dark:bg-[#112436] text-[#122638] dark:text-[#FAF6F0] border-[#E6DDD1] dark:border-[#264561] hover:bg-[#F2ECE3] dark:hover:bg-[#1E3952]'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              partnerKey === 'A' ? 'bg-white' : 'bg-[#E86A52]'
                            }`}
                          />
                          <span className="truncate">{vault.partnerAName}</span>
                        </span>
                        {partnerKey === 'A' && <Check className="w-4 h-4 shrink-0 stroke-[2.5]" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectPartner('B')}
                        aria-pressed={partnerKey === 'B'}
                        className={`min-h-[48px] rounded-xl px-3.5 text-sm font-semibold transition-all border flex items-center justify-between gap-2 ${
                          partnerKey === 'B'
                            ? 'bg-[#1A6B8A] text-white border-[#1A6B8A] shadow-sm'
                            : 'bg-[#FAF6F0] dark:bg-[#112436] text-[#122638] dark:text-[#FAF6F0] border-[#E6DDD1] dark:border-[#264561] hover:bg-[#F2ECE3] dark:hover:bg-[#1E3952]'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              partnerKey === 'B' ? 'bg-white' : 'bg-[#1A6B8A] dark:bg-[#2D8FB3]'
                            }`}
                          />
                          <span className="truncate">{vault.partnerBName}</span>
                        </span>
                        {partnerKey === 'B' && <Check className="w-4 h-4 shrink-0 stroke-[2.5]" />}
                      </button>
                    </div>
                  </div>

                  {/* 3. External Source Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-[#5B6B79] dark:text-[#9DB0C0] mb-2">
                      Da quale attività esterna arrivano?
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {EXTERNAL_SOURCE_TAGS.map((tag) => {
                        const selected = sourceTag === tag;
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => handleSelectSource(tag)}
                            aria-pressed={selected}
                            className={`min-h-[48px] rounded-xl px-3 py-2 text-xs font-semibold text-left transition-all border flex items-center gap-2 ${
                              selected
                                ? 'bg-[#122638] dark:bg-[#1A6B8A] text-white border-[#122638] dark:border-[#2D8FB3] shadow-xs'
                                : 'bg-[#FAF6F0] dark:bg-[#112436] text-[#122638] dark:text-[#FAF6F0] border-[#E6DDD1] dark:border-[#264561] hover:bg-[#F2ECE3] dark:hover:bg-[#1E3952]'
                            }`}
                          >
                            <span
                              className={`shrink-0 ${
                                selected ? 'text-[#F7C76E]' : 'text-[#1A6B8A] dark:text-[#2D8FB3]'
                              }`}
                            >
                              {getSourceIcon(tag)}
                            </span>
                            <span className="line-clamp-2 leading-tight">{tag}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 4. Optional Note */}
                  <div>
                    <label
                      htmlFor="deposit-note-input"
                      className="block text-xs font-semibold text-[#5B6B79] dark:text-[#9DB0C0] mb-1.5"
                    >
                      Dettaglio attività o dedica (opzionale)
                    </label>
                    <input
                      id="deposit-note-input"
                      type="text"
                      enterKeyHint="done"
                      maxLength={APP_LIMITS.contributionNoteMax}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                      placeholder="Es. Venduta giacca su Vinted · Per l’Africa"
                      className="w-full min-h-[46px] rounded-xl border border-[#E6DDD1] dark:border-[#264561] bg-[#FAF6F0] dark:bg-[#112436] px-3.5 text-base text-[#122638] dark:text-[#FAF6F0] placeholder:text-[#5B6B79]/60 dark:placeholder:text-[#9DB0C0]/50 focus:outline-none focus:border-[#1A6B8A]"
                    />
                  </div>
                </div>

                {/* Sticky Footer Save CTA (Always accessible above keyboard & safe area) */}
                <div className="shrink-0 border-t border-[#E6DDD1] dark:border-[#264561] bg-white dark:bg-[#162D42] px-5 sm:px-6 pt-3 pb-safe">
                  <button
                    type="submit"
                    disabled={!isAmountValid || submitting}
                    className="w-full min-h-[50px] rounded-2xl bg-[#E86A52] px-5 py-3 text-sm font-semibold text-white hover:bg-[#D1533C] active:scale-[0.99] transition-all disabled:opacity-45 disabled:pointer-events-none flex items-center justify-center gap-2 shadow-sm shadow-[#E86A52]/20"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Salvataggio in corso...</span>
                      </>
                    ) : (
                      <span>
                        {isAmountValid
                          ? `Metti ${formatEuro(parsedAmount)} nel salvadanaio`
                          : 'Metti nel salvadanaio'}
                      </span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
