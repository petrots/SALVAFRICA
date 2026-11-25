import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, PiggyBank, Plus, Trash2 } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  deleteContribution,
  ReactionField,
  setContributionPendingPhysical,
  toggleContributionReaction,
} from '../services/vaultService';
import { DS_DURATION, DS_EASE, DS_PARTNER_STYLES } from '../styles/designSystem';
import { Category, Contribution, PartnerKey, Vault } from '../types';
import { resolveContributionCategoryLabel } from '../utils/categories';
import { formatDateTime, formatEuro } from '../utils/format';
import { triggerHaptic } from '../utils/haptics';
import { getSourceIcon } from '../utils/sourceIcons';

interface FeedTabProps {
  vault: Vault;
  contributions: Contribution[];
  categoriesById: Map<string, Category>;
  currentPartnerKey: PartnerKey;
  onOpenDeposit: () => void;
  onReactionAdded?: (
    entry: Contribution,
    reactionEmoji: string,
    categoryLabel: string
  ) => void;
}

const REACTIONS: Array<{ field: ReactionField; emoji: string; label: string }> = [
  { field: 'reactionHeart', emoji: '❤️', label: 'Cuore' },
  { field: 'reactionToast', emoji: '🥂', label: 'Brindisi' },
  { field: 'reactionPlane', emoji: '✈️', label: 'Decollo' },
  { field: 'reactionFire', emoji: '🔥', label: 'Grande!' },
];

export const FeedTab: React.FC<FeedTabProps> = ({
  vault,
  contributions,
  categoriesById,
  currentPartnerKey,
  onOpenDeposit,
  onReactionAdded,
}) => {
  const [filter, setFilter] = useState<'all' | 'A' | 'B' | 'pending'>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyPhysicalId, setBusyPhysicalId] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();

  // Track known contribution IDs so only genuinely new items trigger the slide-in entrance
  const seenIdsRef = useRef<Set<string> | null>(null);
  const hadContributionsRef = useRef(contributions.length > 0);
  if (seenIdsRef.current === null) {
    seenIdsRef.current = new Set(contributions.map((c) => c.id));
  } else if (!hadContributionsRef.current && contributions.length > 1) {
    for (const c of contributions) {
      seenIdsRef.current.add(c.id);
    }
    hadContributionsRef.current = true;
  }

  useEffect(() => {
    if (contributions.length > 0) {
      hadContributionsRef.current = true;
    }
    if (!seenIdsRef.current) {
      seenIdsRef.current = new Set();
    }
    for (const c of contributions) {
      seenIdsRef.current.add(c.id);
    }
  }, [contributions]);

  const pendingPhysicalCount = useMemo(
    () => contributions.filter((c) => Boolean(c.pendingPhysical)).length,
    [contributions]
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return contributions;
    if (filter === 'pending') {
      return contributions.filter((c) => Boolean(c.pendingPhysical));
    }
    return contributions.filter((c) => c.partnerKey === filter);
  }, [contributions, filter]);

  const filteredTotal = useMemo(
    () => filtered.reduce((acc, c) => acc + (Number(c.amount) || 0), 0),
    [filtered]
  );

  const handleToggleReaction = async (entry: Contribution, field: ReactionField) => {
    const turningOn = !entry[field];
    await toggleContributionReaction(vault.id, entry, field);
    if (turningOn && entry.partnerKey !== currentPartnerKey) {
      const reaction = REACTIONS.find((r) => r.field === field);
      const categoryLabel = resolveContributionCategoryLabel(entry, categoriesById);
      onReactionAdded?.(entry, reaction?.emoji || '❤️', categoryLabel);
    }
  };

  const handleTogglePendingPhysical = async (entry: Contribution) => {
    if (busyPhysicalId) return;
    const nextPending = !Boolean(entry.pendingPhysical);
    setBusyPhysicalId(entry.id);
    try {
      await setContributionPendingPhysical(vault.id, entry.id, nextPending);
      triggerHaptic(nextPending ? 'selection' : 'success');
    } finally {
      setBusyPhysicalId(null);
    }
  };

  const handleDelete = async (entryId: string) => {
    await deleteContribution(vault.id, entryId);
    setConfirmDeleteId(null);
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Editorial Header & Essential Tab Navigation */}
      <header className="space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-[#1A6B8A] dark:text-[#2D8FB3]">
            {filtered.length} {filtered.length === 1 ? 'movimento' : 'movimenti'}
            <span aria-hidden="true" className="mx-1.5 opacity-50">
              ·
            </span>
            <span className="tabular-nums">{formatEuro(filteredTotal)}</span>
          </p>
          <h1 className="ds-heading-page">
            Diario dei versamenti
          </h1>
          <p className="text-xs sm:text-sm text-[#5B6B79] dark:text-[#9DB0C0] pt-0.5">
            Solo entrate extra esterne (zero stipendio e zero risparmi), con reazioni di coppia
          </p>
        </div>

        {/* Minimal Underlined Author Filter Tabs */}
        <nav
          aria-label="Filtra versamenti per autore"
          className="flex items-center gap-6 sm:gap-8 border-b ds-divider overflow-x-auto"
        >
          <button
            type="button"
            onClick={() => setFilter('all')}
            aria-current={filter === 'all' ? 'page' : undefined}
            className={`relative min-h-[44px] inline-flex items-center text-sm transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:text-[#1A6B8A] ${
              filter === 'all'
                ? 'font-semibold text-[#122638] dark:text-[#FAF6F0]'
                : 'font-medium text-[#5B6B79] dark:text-[#9DB0C0] hover:text-[#122638] dark:hover:text-[#FAF6F0]'
            }`}
          >
            <span>Tutti</span>
            {filter === 'all' && (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-[2px] bg-[#E86A52]"
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => setFilter('A')}
            aria-current={filter === 'A' ? 'page' : undefined}
            className={`relative min-h-[44px] inline-flex items-center text-sm transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:text-[#1A6B8A] ${
              filter === 'A'
                ? 'font-semibold text-[#122638] dark:text-[#FAF6F0]'
                : 'font-medium text-[#5B6B79] dark:text-[#9DB0C0] hover:text-[#122638] dark:hover:text-[#FAF6F0]'
            }`}
          >
            <span>{vault.partnerAName}</span>
            {filter === 'A' && (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-[2px] bg-[#E86A52]"
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => setFilter('B')}
            aria-current={filter === 'B' ? 'page' : undefined}
            className={`relative min-h-[44px] inline-flex items-center text-sm transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:text-[#1A6B8A] ${
              filter === 'B'
                ? 'font-semibold text-[#122638] dark:text-[#FAF6F0]'
                : 'font-medium text-[#5B6B79] dark:text-[#9DB0C0] hover:text-[#122638] dark:hover:text-[#FAF6F0]'
            }`}
          >
            <span>{vault.partnerBName}</span>
            {filter === 'B' && (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-[2px] bg-[#E86A52]"
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => setFilter('pending')}
            aria-current={filter === 'pending' ? 'page' : undefined}
            className={`relative min-h-[44px] inline-flex items-center gap-1.5 text-sm transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:text-[#1A6B8A] ${
              filter === 'pending'
                ? 'font-semibold text-[#122638] dark:text-[#FAF6F0]'
                : 'font-medium text-[#5B6B79] dark:text-[#9DB0C0] hover:text-[#122638] dark:hover:text-[#FAF6F0]'
            }`}
          >
            <span>Da inserire</span>
            {pendingPhysicalCount > 0 && (
              <span className="text-xs font-semibold tabular-nums text-[#85580D] dark:text-[#F7C76E]">
                ({pendingPhysicalCount})
              </span>
            )}
            {filter === 'pending' && (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-[2px] bg-[#E09F3E]"
              />
            )}
          </button>
        </nav>
      </header>

      {/* Journal Feed Directly on Canvas */}
      {filtered.length === 0 ? (
        <div className="py-10 sm:py-14 text-center space-y-4">
          <p className="font-display text-xl sm:text-2xl font-semibold text-[#122638] dark:text-[#FAF6F0]">
            {filter === 'pending'
              ? 'Nessun importo da inserire'
              : 'Nessun versamento qui per ora'}
          </p>
          <p className="text-sm text-[#5B6B79] dark:text-[#9DB0C0] max-w-md mx-auto leading-relaxed">
            {filter === 'pending'
              ? 'Tutti i versamenti registrati risultano già messi nel salvadanaio fisico a casa.'
              : 'Aggiungete un’entrata da una vendita, un lavoretto, una scommessa o monetine trovate.'}
          </p>
          {filter === 'pending' ? (
            <button
              type="button"
              onClick={() => setFilter('all')}
              className="ds-btn-secondary px-5 py-2.5 text-sm"
            >
              Vedi tutti i movimenti
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenDeposit}
              className="ds-btn-primary px-5 py-2.5 text-sm"
            >
              <Plus className="w-4 h-4 stroke-[2.25]" />
              <span>Nuovo versamento extra</span>
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-[#E6DDD1] dark:divide-[#264561] border-b ds-divider overflow-hidden">
          <AnimatePresence initial={false}>
            {filtered.map((entry) => {
              const isConfirming = confirmDeleteId === entry.id;
              const isNewEntry = !seenIdsRef.current?.has(entry.id);
              const categoryLabel = resolveContributionCategoryLabel(
                entry,
                categoriesById
              );
              return (
                <motion.article
                  key={entry.id}
                  layout={prefersReducedMotion ? false : 'position'}
                  initial={
                    isNewEntry
                      ? prefersReducedMotion
                        ? { opacity: 0 }
                        : { opacity: 0, x: -12, y: -8 }
                      : false
                  }
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  exit={
                    prefersReducedMotion
                      ? { opacity: 0, transition: { duration: 0.12 } }
                      : { opacity: 0, x: 12, transition: { duration: 0.18 } }
                  }
                  transition={{
                    duration: prefersReducedMotion ? 0.12 : DS_DURATION.smooth,
                    ease: DS_EASE,
                  }}
                  className="py-4 sm:py-5 space-y-2 transition-colors duration-150"
                >
                <div className="flex items-start justify-between gap-3 sm:gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        DS_PARTNER_STYLES[entry.partnerKey].iconBadge
                      }`}
                    >
                      {getSourceIcon(categoryLabel)}
                    </span>

                    <div className="min-w-0 space-y-1">
                      <p className="text-[15px] sm:text-base font-semibold text-[#122638] dark:text-[#FAF6F0] leading-snug break-words">
                        {entry.note || categoryLabel}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-[#5B6B79] dark:text-[#9DB0C0]">
                        <span
                          className={`font-semibold ${
                            DS_PARTNER_STYLES[entry.partnerKey].textAccent
                          }`}
                        >
                          {entry.partnerName}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{categoryLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatDateTime(entry.createdAt)}</span>
                      </div>
                      {entry.pendingPhysical && (
                        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#85580D] dark:text-[#F7C76E] pt-0.5">
                          <PiggyBank className="w-3.5 h-3.5 shrink-0" />
                          <span>Da inserire nel salvadanaio fisico</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0 pl-2">
                    <span className="font-display text-xl sm:text-2xl font-semibold tabular-nums tracking-tight text-[#122638] dark:text-[#FAF6F0]">
                      +{formatEuro(entry.amount)}
                    </span>
                  </div>
                </div>

                {/* Partner Reactions, Physical Jar Status & Delete Controls (44px Hit Targets) */}
                <div className="flex flex-wrap items-center justify-between gap-2 pl-11">
                  <div className="flex items-center gap-0.5 sm:gap-1 -ml-1.5">
                    {REACTIONS.map((reaction) => {
                      const active = entry[reaction.field];
                      return (
                        <button
                          key={reaction.field}
                          type="button"
                          onClick={() => handleToggleReaction(entry, reaction.field)}
                          aria-label={`${reaction.label} per il versamento di ${entry.partnerName}`}
                          aria-pressed={active}
                          className="min-h-[44px] min-w-[40px] inline-flex items-center justify-center group focus:outline-none"
                        >
                          <span
                            className={`h-7 px-2 rounded-full text-[13px] inline-flex items-center justify-center transition-all ${
                              active
                                ? 'bg-[#E86A52]/15 dark:bg-[#E86A52]/22 ring-1 ring-[#E86A52]/45 opacity-100 scale-105'
                                : 'opacity-50 group-hover:opacity-90 group-hover:bg-[#F2ECE3] dark:group-hover:bg-[#162D42] group-focus-visible:ring-2 group-focus-visible:ring-[#1A6B8A]'
                            }`}
                          >
                            {reaction.emoji}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {isConfirming ? (
                    <div className="flex items-center gap-1.5 -mr-2">
                      <button
                        type="button"
                        onClick={() => handleDelete(entry.id)}
                        className="min-h-[44px] px-3 rounded-full bg-[#D1533C] text-xs font-semibold text-white hover:bg-[#B8432E] active:scale-[0.98] transition-all duration-150"
                      >
                        Conferma elimina
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="ds-btn-ghost px-2.5"
                      >
                        Annulla
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 -mr-2.5">
                      {entry.pendingPhysical ? (
                        <button
                          type="button"
                          disabled={busyPhysicalId === entry.id}
                          onClick={() => void handleTogglePendingPhysical(entry)}
                          className="min-h-[44px] px-3 rounded-full bg-[#E09F3E]/15 border border-[#E09F3E]/40 hover:bg-[#E09F3E]/25 active:scale-[0.98] text-xs font-semibold text-[#85580D] dark:text-[#F7C76E] inline-flex items-center gap-1.5 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A6B8A] whitespace-nowrap disabled:opacity-45"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>
                            {busyPhysicalId === entry.id ? 'Salvo...' : 'Inserito'}
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busyPhysicalId === entry.id}
                          onClick={() => void handleTogglePendingPhysical(entry)}
                          aria-label="Segna da inserire nel salvadanaio fisico"
                          className="ds-btn-ghost px-2.5 text-xs"
                        >
                          <PiggyBank className="w-3.5 h-3.5" />
                          <span>Da inserire</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(entry.id)}
                        aria-label="Elimina versamento"
                        className="ds-btn-icon hover:text-[#D1533C] dark:hover:text-[#E86A52] hover:bg-[#E86A52]/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
