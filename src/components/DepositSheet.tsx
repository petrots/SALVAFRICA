import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, PiggyBank, Plus, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { addContribution, createCategory } from '../services/vaultService';
import {
  DS_DURATION,
  DS_EASE,
  DS_PARTNER_STYLES,
  getSheetBackdropMotion,
  getSheetPanelMotion,
} from '../styles/designSystem';
import {
  APP_LIMITS,
  Category,
  PartnerKey,
  Vault,
} from '../types';
import { formatEuro } from '../utils/format';
import { triggerHaptic } from '../utils/haptics';
import { getSourceIcon } from '../utils/sourceIcons';

export interface DepositSuccessMeta {
  contributionId: string;
  partnerKey: PartnerKey;
  partnerName: string;
  categoryName: string;
  note: string;
  pendingPhysical: boolean;
}

interface DepositSheetProps {
  isOpen: boolean;
  onClose: () => void;
  vault: Vault;
  categories: Category[];
  activeCategories: Category[];
  categoriesLoaded: boolean;
  currentPartnerKey: PartnerKey;
  defaultPendingPhysical?: boolean;
  onChangePartnerKey: (key: PartnerKey) => void;
  onDepositStart?: () => void;
  onSuccessDeposit: (addedAmount: number, meta: DepositSuccessMeta) => boolean | void;
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
  categories,
  activeCategories,
  categoriesLoaded,
  currentPartnerKey,
  defaultPendingPhysical = false,
  onChangePartnerKey,
  onDepositStart,
  onSuccessDeposit,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const backdropMotion = getSheetBackdropMotion(prefersReducedMotion);
  const panelMotion = getSheetPanelMotion(prefersReducedMotion);

  const [amountStr, setAmountStr] = useState('20');
  const [amountTouched, setAmountTouched] = useState(false);
  const [partnerKey, setPartnerKey] = useState<PartnerKey>('A');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [pendingCreatedCategory, setPendingCreatedCategory] = useState<Category | null>(
    null
  );
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategoryLoading, setCreatingCategoryLoading] = useState(false);
  const [categoryError, setCategoryError] = useState('');
  const [note, setNote] = useState('');
  const [pendingPhysical, setPendingPhysical] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmedDeposit, setConfirmedDeposit] = useState<{
    amount: number;
    categoryName: string;
    pendingPhysical: boolean;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [viewportMetrics, setViewportMetrics] = useState<{
    height: number;
    offsetTop: number;
  } | null>(null);

  const submittingLockRef = useRef(false);
  const closeTimerRef = useRef<number | null>(null);
  const amountInputRef = useRef<HTMLInputElement | null>(null);
  const newCategoryInputRef = useRef<HTMLInputElement | null>(null);

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
    setConfirmedDeposit(null);
    setErrorMsg('');
    setAmountStr('20');
    setAmountTouched(false);
    setPendingCreatedCategory(null);
    setCreatingCategory(false);
    setNewCategoryName('');
    setCategoryError('');
    setSelectedCategoryId(activeCategories[0]?.id ?? '');
    setNote('');
    setPendingPhysical(Boolean(defaultPendingPhysical));
    setKeyboardOpen(false);
    setPartnerKey(currentPartnerKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const displayedCategories = useMemo(() => {
    if (
      pendingCreatedCategory &&
      !activeCategories.some((c) => c.id === pendingCreatedCategory.id)
    ) {
      return [...activeCategories, pendingCreatedCategory];
    }
    return activeCategories;
  }, [activeCategories, pendingCreatedCategory]);

  // Ensure a valid active category is selected if categories finish loading after sheet opens
  useEffect(() => {
    if (!isOpen) return;
    if (
      displayedCategories.length > 0 &&
      !displayedCategories.some((c) => c.id === selectedCategoryId)
    ) {
      setSelectedCategoryId(displayedCategories[0].id);
    }
  }, [isOpen, displayedCategories, selectedCategoryId]);

  const selectedCategory = useMemo(
    () => displayedCategories.find((c) => c.id === selectedCategoryId) ?? null,
    [displayedCategories, selectedCategoryId]
  );

  // Keep modal fitted above the iPhone software keyboard when visualViewport shrinks or shifts
  useEffect(() => {
    if (!isOpen) {
      setViewportMetrics(null);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;

    const syncViewport = () => {
      setViewportMetrics({
        height: Math.round(vv.height),
        offsetTop: Math.round(vv.offsetTop),
      });
    };
    syncViewport();
    vv.addEventListener('resize', syncViewport);
    vv.addEventListener('scroll', syncViewport);
    return () => {
      vv.removeEventListener('resize', syncViewport);
      vv.removeEventListener('scroll', syncViewport);
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
    onChangePartnerKey(key);
  };

  const handleSelectCategory = (cat: Category) => {
    dismissKeyboard();
    setSelectedCategoryId(cat.id);
    setCreatingCategory(false);
    setCategoryError('');
    setErrorMsg('');
  };

  const handleOpenNewCategory = () => {
    setCreatingCategory(true);
    setNewCategoryName('');
    setCategoryError('');
    window.setTimeout(() => {
      newCategoryInputRef.current?.focus();
    }, 60);
  };

  const handleCreateCategory = async () => {
    if (creatingCategoryLoading) return;
    setCategoryError('');
    setCreatingCategoryLoading(true);
    try {
      const created = await createCategory(vault.id, newCategoryName, categories);
      setPendingCreatedCategory(created);
      setSelectedCategoryId(created.id);
      setCreatingCategory(false);
      setNewCategoryName('');
      setErrorMsg('');
      triggerHaptic('selection');
      dismissKeyboard();
    } catch (err) {
      setCategoryError(
        err instanceof Error
          ? err.message
          : 'Impossibile creare la categoria. Riprova.'
      );
    } finally {
      setCreatingCategoryLoading(false);
    }
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
    if (submittingLockRef.current || confirmedDeposit !== null) return;

    setAmountTouched(true);
    setErrorMsg('');

    if (!isAmountValid) {
      setErrorMsg('Inserisci un importo valido maggiore di 0 € (es. 2,50).');
      amountInputRef.current?.focus();
      return;
    }

    if (!selectedCategory) {
      setErrorMsg('Seleziona o crea una categoria per continuare.');
      return;
    }

    dismissKeyboard();
    submittingLockRef.current = true;
    setSubmitting(true);

    const partnerName = partnerKey === 'A' ? vault.partnerAName : vault.partnerBName;
    onChangePartnerKey(partnerKey);

    try {
      onDepositStart?.();
      const contributionId = await addContribution(vault.id, {
        amount: parsedAmount,
        partnerKey,
        partnerName,
        sourceTag: selectedCategory.name,
        categoryId: selectedCategory.id,
        note,
        pendingPhysical,
      });
      const reachedMilestone = onSuccessDeposit(parsedAmount, {
        contributionId,
        partnerKey,
        partnerName,
        categoryName: selectedCategory.name,
        note: note.trim(),
        pendingPhysical,
      });
      if (!reachedMilestone) {
        triggerHaptic('success');
      }
      setConfirmedDeposit({
        amount: parsedAmount,
        categoryName: selectedCategory.name,
        pendingPhysical,
      });
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
        <div
          style={
            viewportMetrics
              ? {
                  top: `${viewportMetrics.offsetTop}px`,
                  height: `${viewportMetrics.height}px`,
                }
              : undefined
          }
          className={`fixed inset-x-0 z-50 flex items-end sm:items-center justify-center ${
            viewportMetrics ? '' : 'inset-y-0'
          }`}
        >
          <motion.div
            {...backdropMotion}
            onClick={() => {
              dismissKeyboard();
              onClose();
            }}
            className="ds-sheet-backdrop"
          />

          <motion.div
            {...panelMotion}
            style={{
              maxHeight: viewportMetrics
                ? `${Math.max(300, viewportMetrics.height - 12)}px`
                : '90dvh',
            }}
            className="ds-sheet-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deposit-sheet-title"
          >
            {/* Drag handle & Editorial Header */}
            <div
              onClick={dismissKeyboard}
              className="shrink-0 border-b ds-divider"
            >
              <div className="ds-sheet-handle" />

              <div className="flex items-center justify-between px-5 sm:px-6 pt-3 pb-3 gap-3">
                <div className="min-w-0">
                  <h2
                    id="deposit-sheet-title"
                    className="ds-heading-sheet"
                  >
                    Nuovo versamento extra
                  </h2>
                  <p className="ds-caption truncate">
                    Solo entrate extra esterne (zero stipendio e zero risparmi)
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {keyboardOpen && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={dismissKeyboard}
                      className="min-h-[44px] px-3 rounded-full bg-[#F2ECE3] dark:bg-[#162D42] text-xs font-semibold text-[#122638] dark:text-[#FAF6F0] inline-flex items-center gap-1 hover:bg-[#E6DDD1] dark:hover:bg-[#1E3952] transition-colors duration-150"
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
                    className="ds-btn-icon -mr-2"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {confirmedDeposit !== null ? (
              <motion.div
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                transition={{
                  duration: prefersReducedMotion ? 0.12 : DS_DURATION.normal,
                  ease: DS_EASE,
                }}
                className="px-6 py-12 pb-[max(2rem,env(safe-area-inset-bottom))] flex flex-col items-center text-center space-y-3"
              >
                <span className="w-12 h-12 rounded-full bg-[#E86A52] text-white flex items-center justify-center">
                  <Check className="w-6 h-6 stroke-[2.5]" />
                </span>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[#1A6B8A] dark:text-[#2D8FB3]">
                    Versamento registrato
                  </p>
                  <p className="font-display text-4xl font-semibold tabular-nums text-[#122638] dark:text-[#FAF6F0]">
                    +{formatEuro(confirmedDeposit.amount)}
                  </p>
                  <p className="text-sm text-[#5B6B79] dark:text-[#9DB0C0]">
                    Aggiunto da{' '}
                    <span className="font-semibold text-[#122638] dark:text-[#FAF6F0]">
                      {selectedPartnerName}
                    </span>{' '}
                    · {confirmedDeposit.categoryName}
                  </p>
                  {confirmedDeposit.pendingPhysical && (
                    <p className="inline-flex items-center justify-center gap-1.5 pt-1 text-xs font-semibold text-[#85580D] dark:text-[#F7C76E]">
                      <PiggyBank className="w-3.5 h-3.5 shrink-0" />
                      <span>Promemoria salvadanaio fisico attivo</span>
                    </p>
                  )}
                </div>
              </motion.div>
            ) : (
              <form
                onSubmit={handleSubmit}
                noValidate
                className="flex-1 min-h-0 flex flex-col"
              >
                {/* Scrollable Editorial Body */}
                <div className="ds-sheet-body py-4 space-y-5">
                  {errorMsg && (
                    <div
                      role="alert"
                      className="border-b border-[#E86A52]/40 pb-2.5 text-sm font-medium text-[#D1533C] dark:text-[#E86A52]"
                    >
                      {errorMsg}
                    </div>
                  )}

                  {/* 1. Hero Amount & Quick Presets (Cardless Editorial Underline) */}
                  <div className="space-y-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <label
                        htmlFor="deposit-amount-input"
                        className="ds-label"
                      >
                        Importo guadagnato
                      </label>
                      <span className="ds-caption">
                        Es. 2,50 €
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between gap-3 border-b-2 ds-divider focus-within:border-[#E86A52] dark:focus-within:border-[#E86A52] pb-2 transition-colors duration-150">
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
                        className="w-full min-w-0 min-h-[54px] bg-transparent font-display text-5xl font-semibold tabular-nums text-[#122638] dark:text-[#FAF6F0] placeholder:text-[#5B6B79]/35 dark:placeholder:text-[#9DB0C0]/35 focus:outline-none scroll-mb-6"
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

                    <div className="grid grid-cols-4 gap-2 pt-0.5">
                      {QUICK_AMOUNTS.map((val) => {
                        const active = parsedAmount === val;
                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() => handleQuickAdd(val)}
                            aria-pressed={active}
                            className={`min-h-[44px] rounded-xl text-sm font-semibold tabular-nums active:scale-[0.98] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A6B8A] ${
                              active
                                ? 'bg-[#122638] dark:bg-[#E86A52] text-white'
                                : 'bg-[#F2ECE3] dark:bg-[#162D42] text-[#122638] dark:text-[#FAF6F0] hover:bg-[#E6DDD1]/80 dark:hover:bg-[#1E3952]'
                            }`}
                          >
                            +{val} €
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Partner Selector */}
                  <div className="pt-4 border-t ds-divider">
                    <label className="ds-label mb-2.5">
                      Chi sta versando?
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleSelectPartner('A')}
                        aria-pressed={partnerKey === 'A'}
                        className={`min-h-[48px] rounded-xl px-3.5 text-sm font-semibold active:scale-[0.98] transition-all duration-150 flex items-center justify-between gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A6B8A] ${
                          partnerKey === 'A'
                            ? DS_PARTNER_STYLES.A.activeSegment
                            : 'bg-[#F2ECE3]/75 dark:bg-[#162D42] text-[#122638] dark:text-[#FAF6F0] border ds-divider hover:bg-[#F2ECE3] dark:hover:bg-[#1E3952]'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              partnerKey === 'A' ? 'bg-white' : DS_PARTNER_STYLES.A.dot
                            }`}
                          />
                          <span className="truncate">{vault.partnerAName}</span>
                        </span>
                        {partnerKey === 'A' && (
                          <Check className="w-4 h-4 shrink-0 stroke-[2.5]" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectPartner('B')}
                        aria-pressed={partnerKey === 'B'}
                        className={`min-h-[48px] rounded-xl px-3.5 text-sm font-semibold active:scale-[0.98] transition-all duration-150 flex items-center justify-between gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E86A52] ${
                          partnerKey === 'B'
                            ? DS_PARTNER_STYLES.B.activeSegment
                            : 'bg-[#F2ECE3]/75 dark:bg-[#162D42] text-[#122638] dark:text-[#FAF6F0] border ds-divider hover:bg-[#F2ECE3] dark:hover:bg-[#1E3952]'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              partnerKey === 'B' ? 'bg-white' : DS_PARTNER_STYLES.B.dot
                            }`}
                          />
                          <span className="truncate">{vault.partnerBName}</span>
                        </span>
                        {partnerKey === 'B' && (
                          <Check className="w-4 h-4 shrink-0 stroke-[2.5]" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 3. Custom Category Selector (Ordered by Last Used) + Inline Creation */}
                  <div className="pt-4 border-t ds-divider space-y-2.5">
                    <label className="ds-label">
                      Da quale attività esterna arrivano?
                    </label>

                    {!categoriesLoaded && displayedCategories.length === 0 ? (
                      <p className="ds-caption py-2">
                        Caricamento categorie...
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {displayedCategories.map((cat) => {
                          const selected = selectedCategory?.id === cat.id;
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => handleSelectCategory(cat)}
                              aria-pressed={selected}
                              className={`min-h-[44px] max-w-full rounded-xl px-3.5 py-2 text-xs text-left active:scale-[0.98] transition-all duration-150 inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A6B8A] ${
                                selected
                                  ? 'bg-[#122638] dark:bg-[#1A6B8A] text-white font-semibold'
                                  : 'bg-[#F2ECE3]/75 dark:bg-[#162D42] text-[#122638] dark:text-[#FAF6F0] font-medium border ds-divider hover:bg-[#F2ECE3] dark:hover:bg-[#1E3952]'
                              }`}
                            >
                              <span
                                className={`shrink-0 ${
                                  selected
                                    ? 'text-[#F7C76E]'
                                    : 'text-[#1A6B8A] dark:text-[#2D8FB3]'
                                }`}
                              >
                                {getSourceIcon(cat.name)}
                              </span>
                              <span className="truncate leading-tight">{cat.name}</span>
                            </button>
                          );
                        })}

                        <button
                          type="button"
                          onClick={handleOpenNewCategory}
                          aria-expanded={creatingCategory}
                          className={`min-h-[44px] rounded-xl px-3.5 py-2 text-xs font-semibold active:scale-[0.98] transition-all duration-150 inline-flex items-center gap-1.5 border border-dashed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E86A52] ${
                            creatingCategory
                              ? 'border-[#E86A52] bg-[#E86A52]/12 text-[#D1533C] dark:text-[#E86A52]'
                              : 'border-[#E86A52]/65 text-[#D1533C] dark:text-[#E86A52] hover:bg-[#E86A52]/10'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[2.25]" />
                          <span>Nuova categoria</span>
                        </button>
                      </div>
                    )}

                    {creatingCategory && (
                      <div className="pt-2 space-y-2 border-t border-[#E6DDD1]/70 dark:border-[#264561]/70">
                        <div className="flex items-center gap-2">
                          <input
                            ref={newCategoryInputRef}
                            type="text"
                            maxLength={APP_LIMITS.categoryNameMax}
                            value={newCategoryName}
                            onChange={(e) => {
                              setNewCategoryName(e.target.value);
                              if (categoryError) setCategoryError('');
                            }}
                            onFocus={handleInputFocus}
                            onBlur={handleInputBlur}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                e.stopPropagation();
                                void handleCreateCategory();
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                setCreatingCategory(false);
                                setCategoryError('');
                              }
                            }}
                            enterKeyHint="done"
                            placeholder="Es. Ripetizioni, Vinted, Lavoretto..."
                            aria-label="Nome della nuova categoria"
                            className="flex-1 ds-input-underline-coral scroll-mb-6"
                          />

                          <button
                            type="button"
                            onClick={() => void handleCreateCategory()}
                            disabled={creatingCategoryLoading}
                            className="ds-btn-dark shrink-0"
                          >
                            {creatingCategoryLoading ? 'Salvo...' : 'Crea'}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setCreatingCategory(false);
                              setCategoryError('');
                            }}
                            className="ds-btn-ghost px-2.5 shrink-0"
                          >
                            Annulla
                          </button>
                        </div>

                        {categoryError && (
                          <p className="text-xs font-medium text-[#D1533C] dark:text-[#E86A52]">
                            {categoryError}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 4. Optional Note */}
                  <div className="pt-4 border-t ds-divider">
                    <label
                      htmlFor="deposit-note-input"
                      className="ds-label mb-1"
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
                      placeholder="Es. Serata ristorante · Per l’Africa"
                      className="ds-input-underline scroll-mb-6"
                    />
                  </div>

                  {/* 5. Physical Piggy Bank Reminder Toggle */}
                  <div className="pt-4 border-t ds-divider pb-1">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={pendingPhysical}
                      onClick={() => {
                        dismissKeyboard();
                        triggerHaptic('selection');
                        setPendingPhysical((prev) => !prev);
                      }}
                      className="w-full min-h-[48px] flex items-center justify-between gap-3 text-left rounded-xl py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A6B8A]"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <PiggyBank
                          className={`w-4 h-4 shrink-0 mt-0.5 transition-colors duration-150 ${
                            pendingPhysical
                              ? 'text-[#85580D] dark:text-[#F7C76E]'
                              : 'text-[#5B6B79] dark:text-[#9DB0C0]'
                          }`}
                        />
                        <div className="min-w-0 space-y-0.5">
                          <span className="block text-sm font-semibold text-[#122638] dark:text-[#FAF6F0]">
                            Da inserire nel salvadanaio fisico
                          </span>
                          <span className="block ds-caption leading-snug">
                            Contabilizzato subito nell’app, con promemoria finché non lo metti nel salvadanaio a casa
                          </span>
                        </div>
                      </div>

                      <span
                        aria-hidden="true"
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-150 ${
                          pendingPhysical
                            ? 'bg-[#E09F3E] border-[#C9892B]'
                            : 'bg-[#E6DDD1] dark:bg-[#162D42] border-[#D8CEC0] dark:border-[#264561]'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform duration-150 ${
                            pendingPhysical ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </span>
                    </button>
                  </div>
                </div>

                {/* Sticky Footer Save CTA (Always accessible above keyboard & safe area) */}
                <div className="shrink-0 border-t ds-divider bg-[#FAF6F0] dark:bg-[#0E1F2E] px-5 sm:px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                  <button
                    type="submit"
                    disabled={!isAmountValid || !selectedCategory || submitting}
                    className="w-full min-h-[50px] ds-btn-primary px-5 py-3 text-sm"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Salvataggio in corso...</span>
                      </>
                    ) : (
                      <span className="tabular-nums">
                        {isAmountValid
                          ? `Aggiungi ${formatEuro(parsedAmount)} al viaggio`
                          : 'Aggiungi al viaggio'}
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
