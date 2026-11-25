import React, { useMemo, useState } from 'react';
import { ArrowRight, Check, Pencil, PiggyBank, Plus } from 'lucide-react';
import {
  markAllPendingPhysicalInserted,
  setContributionPendingPhysical,
  updateLoveNote,
} from '../services/vaultService';
import { DS_PARTNER_STYLES } from '../styles/designSystem';
import { APP_LIMITS, Category, Contribution, Vault } from '../types';
import { resolveContributionCategoryLabel } from '../utils/categories';
import { formatDateTime, formatEuro } from '../utils/format';
import { triggerHaptic } from '../utils/haptics';
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
  onOpenPhysicalReminder: () => void;
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
  onOpenPhysicalReminder,
  onNavigateFeed,
  onLoveNoteUpdated,
}) => {
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(vault.loveNote);
  const [savingNote, setSavingNote] = useState(false);
  const [busyPhysicalId, setBusyPhysicalId] = useState<string | null>(null);
  const [clearingAllPhysical, setClearingAllPhysical] = useState(false);

  const shareA =
    totalSaved > 0 ? Math.round((partnerATotal / totalSaved) * 100) : 50;
  const shareB = totalSaved > 0 ? 100 - shareA : 50;

  const pendingPhysicalEntries = useMemo(
    () => contributions.filter((c) => Boolean(c.pendingPhysical)),
    [contributions]
  );

  const pendingPhysicalTotal = useMemo(
    () =>
      pendingPhysicalEntries.reduce(
        (acc, c) => acc + (Number(c.amount) || 0),
        0
      ),
    [pendingPhysicalEntries]
  );

  const handleMarkInserted = async (entryId: string) => {
    if (busyPhysicalId || clearingAllPhysical) return;
    setBusyPhysicalId(entryId);
    try {
      await setContributionPendingPhysical(vault.id, entryId, false);
      triggerHaptic('success');
    } finally {
      setBusyPhysicalId(null);
    }
  };

  const handleMarkAllInserted = async () => {
    if (clearingAllPhysical || pendingPhysicalEntries.length === 0) return;
    setClearingAllPhysical(true);
    try {
      await markAllPendingPhysicalInserted(
        vault.id,
        pendingPhysicalEntries.map((e) => e.id)
      );
      triggerHaptic('success');
    } finally {
      setClearingAllPhysical(false);
    }
  };

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

      {/* Physical Piggy Bank Reminder (Cardless Editorial Hairline Section) */}
      <section
        aria-label="Promemoria salvadanaio fisico"
        className="border-b ds-divider pb-4 sm:pb-5"
      >
        {pendingPhysicalEntries.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-4">
              <div className="flex items-start gap-2.5 min-w-0">
                <PiggyBank className="w-4 h-4 text-[#85580D] dark:text-[#F7C76E] shrink-0 mt-1" />
                <div className="min-w-0">
                  <h2 className="ds-heading-section">
                    Da inserire nel salvadanaio fisico
                  </h2>
                  <p className="ds-caption">
                    Già contati nel totale ·{' '}
                    {pendingPhysicalEntries.length}{' '}
                    {pendingPhysicalEntries.length === 1 ? 'importo' : 'importi'} da
                    mettere a casa
                  </p>
                </div>
              </div>

              <span className="font-display text-2xl font-semibold tabular-nums text-[#85580D] dark:text-[#F7C76E] shrink-0">
                {formatEuro(pendingPhysicalTotal)}
              </span>
            </div>

            <div className="divide-y divide-[#E6DDD1] dark:divide-[#264561] border-t ds-divider">
              {pendingPhysicalEntries.map((entry) => {
                const categoryLabel = resolveContributionCategoryLabel(
                  entry,
                  categoriesById
                );
                const isBusy = busyPhysicalId === entry.id || clearingAllPhysical;
                return (
                  <div
                    key={entry.id}
                    className="py-2.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span className="font-display text-base font-semibold tabular-nums text-[#122638] dark:text-[#FAF6F0] shrink-0">
                          {formatEuro(entry.amount)}
                        </span>
                        <span className="text-sm font-medium text-[#122638] dark:text-[#FAF6F0] truncate">
                          {entry.note || categoryLabel}
                        </span>
                      </div>
                      <p className="ds-caption truncate">
                        {entry.partnerName} · {categoryLabel} ·{' '}
                        {formatDateTime(entry.createdAt)}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleMarkInserted(entry.id)}
                      aria-label={`Segna ${formatEuro(entry.amount)} come inserito nel salvadanaio fisico`}
                      className="ds-btn-secondary px-3.5 shrink-0"
                    >
                      <Check className="w-3.5 h-3.5 text-[#1A6B8A] dark:text-[#2D8FB3] stroke-[2.5]" />
                      <span>{busyPhysicalId === entry.id ? 'Salvo...' : 'Inserito'}</span>
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              <button
                type="button"
                onClick={onOpenPhysicalReminder}
                className="min-h-[44px] -ml-2 px-2 rounded-full inline-flex items-center gap-1.5 text-xs font-semibold text-[#1A6B8A] dark:text-[#2D8FB3] hover:text-[#122638] dark:hover:text-[#FAF6F0] transition-colors duration-150 focus:outline-none focus-visible:underline"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.25]" />
                <span>Nuovo promemoria da inserire</span>
              </button>

              {pendingPhysicalEntries.length > 1 && (
                <button
                  type="button"
                  disabled={clearingAllPhysical}
                  onClick={() => void handleMarkAllInserted()}
                  className="ds-btn-ghost -mr-2 text-[#85580D] dark:text-[#F7C76E]"
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>
                    {clearingAllPhysical
                      ? 'Aggiorno...'
                      : 'Segna tutti inseriti'}
                  </span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <PiggyBank className="w-4 h-4 text-[#5B6B79] dark:text-[#9DB0C0] shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#122638] dark:text-[#FAF6F0] truncate">
                  Salvadanaio fisico a casa allineato
                </p>
                <p className="ds-caption truncate">
                  Nessun importo già contato in attesa di inserimento
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenPhysicalReminder}
              className="ds-btn-ghost -mr-2 shrink-0 text-[#1A6B8A] dark:text-[#2D8FB3]"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.25]" />
              <span>Promemoria</span>
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
