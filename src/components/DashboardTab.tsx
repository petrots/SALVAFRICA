import React, { useState } from 'react';
import { ArrowRight, Pencil } from 'lucide-react';
import { updateLoveNote } from '../services/vaultService';
import { APP_LIMITS, Contribution, Vault } from '../types';
import { formatDateTime, formatEuro } from '../utils/format';
import { getSourceIcon } from '../utils/sourceIcons';
import { JourneyPath } from './JourneyPath';

interface DashboardTabProps {
  vault: Vault;
  contributions: Contribution[];
  totalSaved: number;
  partnerATotal: number;
  partnerBTotal: number;
  partnerACount: number;
  partnerBCount: number;
  justDepositedKey: number;
  onOpenDeposit: () => void;
  onNavigateFeed: () => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  vault,
  contributions,
  totalSaved,
  partnerATotal,
  partnerBTotal,
  partnerACount,
  partnerBCount,
  justDepositedKey,
  onOpenDeposit,
  onNavigateFeed,
}) => {
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(vault.loveNote);
  const [savingNote, setSavingNote] = useState(false);

  const shareA =
    totalSaved > 0 ? Math.round((partnerATotal / totalSaved) * 100) : 50;
  const shareB = totalSaved > 0 ? 100 - shareA : 50;

  const initialA = (vault.partnerAName || 'A').trim().charAt(0).toUpperCase();
  const initialB = (vault.partnerBName || 'B').trim().charAt(0).toUpperCase();

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingNote(true);
    try {
      await updateLoveNote(vault.id, noteDraft);
      setEditingNote(false);
    } finally {
      setSavingNote(false);
    }
  };

  const recentEntries = contributions.slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Protagonist Interactive 2D Journey & Milestones */}
      <JourneyPath
        vault={vault}
        totalSaved={totalSaved}
        justDepositedKey={justDepositedKey}
        onOpenDeposit={onOpenDeposit}
      />

      {/* Subtle Editable Couple Note Strip */}
      <div className="rounded-2xl bg-white dark:bg-[#162D42] border border-[#E6DDD1] dark:border-[#264561] px-5 py-3.5 transition-colors">
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
              className="flex-1 min-h-[44px] rounded-xl border border-[#E6DDD1] dark:border-[#264561] bg-[#FAF6F0] dark:bg-[#112436] px-3.5 text-base text-[#122638] dark:text-[#FAF6F0] focus:outline-none focus:border-[#E86A52]"
              autoFocus
            />
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="submit"
                disabled={savingNote}
                className="min-h-[44px] px-4 rounded-xl bg-[#122638] dark:bg-[#E86A52] text-xs font-semibold text-white hover:bg-[#1C3952] dark:hover:bg-[#D1533C]"
              >
                {savingNote ? 'Salvo...' : 'Salva'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingNote(false);
                  setNoteDraft(vault.loveNote);
                }}
                className="min-h-[44px] px-3 rounded-xl text-xs font-semibold text-[#5B6B79] dark:text-[#9DB0C0] hover:bg-[#F2ECE3] dark:hover:bg-[#1E3952]"
              >
                Annulla
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-[#5B6B79] dark:text-[#9DB0C0] italic leading-relaxed">
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
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#5B6B79] dark:text-[#9DB0C0] hover:text-[#122638] dark:hover:text-[#FAF6F0] hover:bg-[#F2ECE3] dark:hover:bg-[#1E3952] transition-colors shrink-0"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Duo Contributions & Recent Entries */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Duo Contribution Card */}
        <section className="lg:col-span-5 rounded-[24px] bg-white dark:bg-[#162D42] border border-[#E6DDD1] dark:border-[#264561] p-6 space-y-5 transition-colors">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-xl font-semibold text-[#122638] dark:text-[#FAF6F0]">
              Contributo di coppia
            </h2>
            <span className="text-xs text-[#5B6B79] dark:text-[#9DB0C0] tabular-nums">
              {contributions.length}{' '}
              {contributions.length === 1 ? 'entrata' : 'entrate'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-[#FAF6F0] dark:bg-[#112436] p-4 space-y-2.5">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-full bg-[#E86A52] text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {initialA}
                </span>
                <span className="text-sm font-semibold text-[#122638] dark:text-[#FAF6F0] truncate">
                  {vault.partnerAName}
                </span>
              </div>
              <div>
                <p className="font-display text-2xl font-semibold tabular-nums text-[#122638] dark:text-[#FAF6F0]">
                  {formatEuro(partnerATotal)}
                </p>
                <p className="text-xs text-[#5B6B79] dark:text-[#9DB0C0] tabular-nums mt-0.5">
                  {shareA}% del totale · {partnerACount} extra
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-[#FAF6F0] dark:bg-[#112436] p-4 space-y-2.5">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-full bg-[#1A6B8A] text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {initialB}
                </span>
                <span className="text-sm font-semibold text-[#122638] dark:text-[#FAF6F0] truncate">
                  {vault.partnerBName}
                </span>
              </div>
              <div>
                <p className="font-display text-2xl font-semibold tabular-nums text-[#122638] dark:text-[#FAF6F0]">
                  {formatEuro(partnerBTotal)}
                </p>
                <p className="text-xs text-[#5B6B79] dark:text-[#9DB0C0] tabular-nums mt-0.5">
                  {shareB}% del totale · {partnerBCount} extra
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="h-2.5 w-full rounded-full bg-[#F2ECE3] dark:bg-[#1E3952] overflow-hidden flex gap-0.5">
              <div
                className="h-full bg-[#E86A52] rounded-l-full transition-all duration-500"
                style={{ width: `${shareA}%` }}
              />
              <div
                className="h-full bg-[#1A6B8A] dark:bg-[#2D8FB3] rounded-r-full transition-all duration-500"
                style={{ width: `${shareB}%` }}
              />
            </div>
          </div>
        </section>

        {/* Fintech Ledger Recent Entries */}
        <section className="lg:col-span-7 rounded-[24px] bg-white dark:bg-[#162D42] border border-[#E6DDD1] dark:border-[#264561] p-6 space-y-4 transition-colors">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-xl font-semibold text-[#122638] dark:text-[#FAF6F0]">
              Ultime entrate extra
            </h2>
            {contributions.length > 0 && (
              <button
                type="button"
                onClick={onNavigateFeed}
                className="min-h-[44px] px-3 rounded-xl text-xs font-semibold text-[#1A6B8A] dark:text-[#2D8FB3] hover:bg-[#F2ECE3] dark:hover:bg-[#1E3952] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                Vedi tutte
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {recentEntries.length === 0 ? (
            <div className="rounded-2xl bg-[#FAF6F0] dark:bg-[#112436] p-6 text-center space-y-2">
              <p className="text-sm font-medium text-[#122638] dark:text-[#FAF6F0]">
                SALVAFRICA è pronto per la prima entrata extra
              </p>
              <p className="text-xs text-[#5B6B79] dark:text-[#9DB0C0]">
                Vendite dell’usato, lavoretti, cashback, scommesse o monetine
                trovate: registrate qui solo guadagni ed entrate esterne.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#E6DDD1] dark:divide-[#264561]">
              {recentEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="py-3.5 first:pt-1 last:pb-1 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        entry.partnerKey === 'A'
                          ? 'bg-[#E86A52]/12 dark:bg-[#E86A52]/20 text-[#D1533C] dark:text-[#E86A52]'
                          : 'bg-[#1A6B8A]/12 dark:bg-[#2D8FB3]/20 text-[#1A6B8A] dark:text-[#2D8FB3]'
                      }`}
                    >
                      {getSourceIcon(entry.sourceTag)}
                    </span>

                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-semibold text-[#122638] dark:text-[#FAF6F0] truncate">
                        {entry.note || entry.sourceTag}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-[#5B6B79] dark:text-[#9DB0C0] truncate">
                        <span className="font-medium text-[#122638] dark:text-[#FAF6F0]">
                          {entry.partnerName}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{entry.sourceTag}</span>
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
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
