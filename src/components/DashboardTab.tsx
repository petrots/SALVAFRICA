import React, { useState } from 'react';
import { ArrowRight, Pencil } from 'lucide-react';
import { updateLoveNote } from '../services/vaultService';
import { DS_PARTNER_STYLES } from '../styles/designSystem';
import { APP_LIMITS, Category, Contribution, Vault } from '../types';
import { resolveContributionCategoryLabel } from '../utils/categories';
import { formatDateTime, formatEuro } from '../utils/format';
import { getSourceIcon } from '../utils/sourceIcons';
import { JourneyPath } from './JourneyPath';

interface DashboardTabProps {
  vault: Vault;
  contributions: Contribution[];
  categoriesById: Map<string, Category>;
  totalSaved: number;
  partnerATotal: number;
  partnerBTotal: number;
  partnerACount: number;
  partnerBCount: number;
  justDepositedKey: number;
  celebratedMilestoneEvent: { key: number; index: number } | null;
  onOpenDeposit: () => void;
  onNavigateFeed: () => void;
  onLoveNoteUpdated?: (newNote: string) => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  vault,
  contributions,
  categoriesById,
  totalSaved,
  partnerATotal,
  partnerBTotal,
  partnerACount,
  partnerBCount,
  justDepositedKey,
  celebratedMilestoneEvent,
  onOpenDeposit,
  onNavigateFeed,
  onLoveNoteUpdated,
}) => {
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(vault.loveNote);
  const [savingNote, setSavingNote] = useState(false);

  const shareA =
    totalSaved > 0 ? Math.round((partnerATotal / totalSaved) * 100) : 50;
  const shareB = totalSaved > 0 ? 100 - shareA : 50;

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = noteDraft.trim();
    const changed = cleaned !== (vault.loveNote || '').trim();
    setSavingNote(true);
    try {
      await updateLoveNote(vault.id, noteDraft);
      setEditingNote(false);
      if (changed && cleaned) {
        onLoveNoteUpdated?.(cleaned);
      }
    } finally {
      setSavingNote(false);
    }
  };

  const recentEntries = contributions.slice(0, 4);

  return (
    <div className="space-y-5 sm:space-y-7">
      {/* Protagonist Editorial Travel-Journal & Savannah Path */}
      <JourneyPath
        vault={vault}
        totalSaved={totalSaved}
        justDepositedKey={justDepositedKey}
        celebratedMilestoneEvent={celebratedMilestoneEvent}
        onOpenDeposit={onOpenDeposit}
      />

      {/* Editorial Pull-Quote Note (Hairline Dividers, Zero Card) */}
      <section
        aria-label="Nota di viaggio"
        className="border-y ds-divider py-3.5 sm:py-4"
      >
        {editingNote ? (
          <form
            onSubmit={handleSaveNote}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
          >
            <input
              type="text"
              maxLength={APP_LIMITS.loveNoteMax}
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Scrivi un pensiero o motto per il viaggio..."
              className="flex-1 ds-input-underline px-1"
              autoFocus
            />
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="submit"
                disabled={savingNote}
                className="ds-btn-dark"
              >
                {savingNote ? 'Salvo...' : 'Salva'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingNote(false);
                  setNoteDraft(vault.loveNote);
                }}
                className="ds-btn-ghost"
              >
                Annulla
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="font-display text-sm sm:text-base italic text-[#5B6B79] dark:text-[#9DB0C0] leading-relaxed">
              “
              {vault.loveNote ||
                'Zero risparmi o stipendio: ogni piccola entrata extra ci porta in Africa.'}
              ”
            </p>
            <button
              type="button"
              onClick={() => {
                setNoteDraft(vault.loveNote);
                setEditingNote(true);
              }}
              aria-label="Modifica bigliettino"
              className="ds-btn-icon -mr-2 shrink-0"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>
        )}
      </section>

      {/* Editorial Lower Chapters: Couple Contributions & Recent Entries */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* 1. Contributo di coppia (Clean Typography & Slim Split Bar) */}
        <section className="lg:col-span-5 space-y-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="ds-heading-section">
              Contributo di coppia
            </h2>
            <span className="ds-caption tabular-nums">
              {contributions.length}{' '}
              {contributions.length === 1 ? 'entrata' : 'entrate'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-6 pt-1">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${DS_PARTNER_STYLES.A.dot}`} />
                <span className="text-sm font-semibold text-[#122638] dark:text-[#FAF6F0] truncate">
                  {vault.partnerAName}
                </span>
              </div>
              <p className="font-display text-2xl sm:text-3xl font-semibold tabular-nums text-[#122638] dark:text-[#FAF6F0]">
                {formatEuro(partnerATotal)}
              </p>
              <p className="text-xs text-[#5B6B79] dark:text-[#9DB0C0] tabular-nums">
                {shareA}% · {partnerACount} extra
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${DS_PARTNER_STYLES.B.dot}`} />
                <span className="text-sm font-semibold text-[#122638] dark:text-[#FAF6F0] truncate">
                  {vault.partnerBName}
                </span>
              </div>
              <p className="font-display text-2xl sm:text-3xl font-semibold tabular-nums text-[#122638] dark:text-[#FAF6F0]">
                {formatEuro(partnerBTotal)}
              </p>
              <p className="ds-caption tabular-nums">
                {shareB}% · {partnerBCount} extra
              </p>
            </div>
          </div>

          <div className="h-1.5 w-full rounded-full bg-[#E6DDD1] dark:bg-[#1E3952] overflow-hidden flex gap-0.5">
            <div
              className="h-full bg-[#E86A52] rounded-l-full transition-all duration-300"
              style={{ width: `${shareA}%` }}
            />
            <div
              className="h-full bg-[#1A6B8A] dark:bg-[#2D8FB3] rounded-r-full transition-all duration-300"
              style={{ width: `${shareB}%` }}
            />
          </div>
        </section>

        {/* 2. Ultime entrate extra (Borderless Hairline Ledger) */}
        <section className="lg:col-span-7 space-y-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="ds-heading-section">
              Ultime entrate extra
            </h2>
            {contributions.length > 0 && (
              <button
                type="button"
                onClick={onNavigateFeed}
                className="min-h-[44px] inline-flex items-center gap-1.5 text-xs font-semibold text-[#1A6B8A] dark:text-[#2D8FB3] hover:text-[#122638] dark:hover:text-[#FAF6F0] transition-colors duration-150 whitespace-nowrap focus:outline-none focus-visible:underline"
              >
                <span>Vedi tutte</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {recentEntries.length === 0 ? (
            <div className="border-t ds-divider pt-4 space-y-1.5">
              <p className="text-sm font-medium text-[#122638] dark:text-[#FAF6F0]">
                SALVAFRICA è pronto per la prima entrata extra
              </p>
              <p className="ds-caption leading-relaxed">
                Vendite dell’usato, lavoretti, cashback, scommesse o monetine
                trovate: registrate qui solo guadagni ed entrate esterne.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#E6DDD1] dark:divide-[#264561] border-t ds-divider">
              {recentEntries.map((entry) => {
                const categoryLabel = resolveContributionCategoryLabel(
                  entry,
                  categoriesById
                );
                return (
                  <div
                    key={entry.id}
                    className="py-3.5 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span
                        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                          DS_PARTNER_STYLES[entry.partnerKey].iconBadge
                        }`}
                      >
                        {getSourceIcon(categoryLabel)}
                      </span>

                      <div className="min-w-0 space-y-0.5">
                        <p className="text-sm font-semibold text-[#122638] dark:text-[#FAF6F0] truncate">
                          {entry.note || categoryLabel}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-[#5B6B79] dark:text-[#9DB0C0] truncate">
                          <span className="font-medium text-[#122638] dark:text-[#FAF6F0]">
                            {entry.partnerName}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{categoryLabel}</span>
                          <span aria-hidden="true" className="hidden sm:inline">
                            ·
                          </span>
                          <span className="hidden sm:inline shrink-0">
                            {formatDateTime(entry.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span className="font-display text-lg font-semibold tabular-nums text-[#122638] dark:text-[#FAF6F0] shrink-0">
                      +{formatEuro(entry.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
