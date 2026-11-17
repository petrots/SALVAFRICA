import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Compass,
  Flag,
  Pencil,
  Plus,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { updateLoveNote } from '../services/vaultService';
import { APP_LIMITS, Contribution, MILESTONES, Vault } from '../types';
import { formatDateTime, formatEuro } from '../utils/format';
import { getSourceIcon } from '../utils/sourceIcons';
import { CoastalJar } from './CoastalJar';

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
  const [milestonesExpanded, setMilestonesExpanded] = useState(false);

  const target = Math.max(1, vault.targetAmount);
  const rawPct = (totalSaved / target) * 100;
  const percentage = Math.min(100, Math.max(0, rawPct));
  const remaining = Math.max(0, target - totalSaved);

  const shareA = totalSaved > 0 ? Math.round((partnerATotal / totalSaved) * 100) : 50;
  const shareB = totalSaved > 0 ? 100 - shareA : 50;

  const initialA = (vault.partnerAName || 'A').trim().charAt(0).toUpperCase();
  const initialB = (vault.partnerBName || 'B').trim().charAt(0).toUpperCase();

  const nextMilestone = MILESTONES.find((m) => percentage < m.percent) || null;
  const unlockedCount = MILESTONES.filter((m) => percentage >= m.percent).length;

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

      {/* Flagship Fintech Hero Vault Card — Deep Ocean & Sunset Horizon */}
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#122638] via-[#17435E] to-[#1A6B8A] dark:border dark:border-[#264561] text-[#FAF6F0] p-6 sm:p-9 shadow-lg shadow-[#122638]/10 dark:shadow-black/30">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-16 w-80 h-80 rounded-full bg-[#E86A52]/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 left-10 w-72 h-72 rounded-full bg-[#E09F3E]/15 blur-3xl"
        />

        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 md:gap-10">
          <div className="flex flex-col items-center">
            <CoastalJar
              percentage={percentage}
              justDepositedKey={justDepositedKey}
              darkBackdrop={true}
            />
          </div>

          <div className="flex-1 w-full space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-center md:text-left">
              <div>
                <p className="text-xs font-medium text-[#F7C76E] inline-flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5" />
                  <span>{vault.destination} · Obiettivo a completamento</span>
                </p>
                <h1 className="font-display text-2xl sm:text-3xl font-semibold text-white mt-0.5">
                  {vault.title}
                </h1>
              </div>
              <div className="hidden sm:block text-right">
                <span className="font-mono text-xs text-[#FAF6F0]/60">
                  {vault.partnerAName} & {vault.partnerBName}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 text-center md:text-left">
              <div>
                <p className="text-xs text-[#FAF6F0]/70">Fondo raccolto finora</p>
                <p className="font-display text-4xl sm:text-5xl font-semibold tabular-nums text-white tracking-tight mt-0.5">
                  {formatEuro(totalSaved)}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-xs text-[#FAF6F0]/70">Meta finale</p>
                <p className="text-lg sm:text-xl font-semibold tabular-nums text-[#FAF6F0]">
                  {formatEuro(target)}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="relative h-3.5 w-full rounded-full bg-white/15 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#2D8FB3] via-[#E09F3E] to-[#E86A52] transition-all duration-700 ease-out"
                  style={{ width: `${percentage}%` }}
                />
                {[10, 20, 30, 40, 50, 60, 75, 90].map((mark) => (
                  <span
                    key={mark}
                    className="absolute top-0 bottom-0 w-px bg-[#122638]/35"
                    style={{ left: `${mark}%` }}
                    aria-hidden="true"
                  />
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-[#FAF6F0]/80 tabular-nums">
                <span className="font-semibold text-white">
                  {percentage.toFixed(0)}% completato
                </span>
                <span>
                  {remaining > 0
                    ? `Mancano ${formatEuro(remaining)}`
                    : 'Obiettivo 100% raggiunto'}
                </span>
              </div>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={onOpenDeposit}
                className="w-full sm:w-auto min-h-[48px] rounded-2xl bg-[#E86A52] px-6 py-3 text-sm font-semibold text-white hover:bg-[#D1533C] active:scale-[0.99] transition-all inline-flex items-center justify-center gap-2 whitespace-nowrap shadow-md shadow-[#E86A52]/25"
              >
                <Plus className="w-4 h-4" />
                Registra entrata extra
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Subtle Editable Couple Note Strip */}
      <div className="rounded-2xl bg-white dark:bg-[#162D42] border border-[#E6DDD1] dark:border-[#264561] px-5 py-3.5 transition-colors">
        {editingNote ? (
          <form onSubmit={handleSaveNote} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
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
              “{vault.loveNote || 'Zero risparmi o stipendio: ogni piccola entrata extra ci porta in Africa.'}”
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

      {/* Duo Contributions & Smaller Milestones */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Duo Contribution Card */}
        <section className="lg:col-span-5 rounded-[24px] bg-white dark:bg-[#162D42] border border-[#E6DDD1] dark:border-[#264561] p-6 space-y-5 transition-colors">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-xl font-semibold text-[#122638] dark:text-[#FAF6F0]">
              Contributo di coppia
            </h2>
            <span className="text-xs text-[#5B6B79] dark:text-[#9DB0C0] tabular-nums">
              {contributions.length} {contributions.length === 1 ? 'entrata' : 'entrate'}
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

        {/* Smaller Step Milestones Accordion (5% -> 100%) */}
        <section className="lg:col-span-7 rounded-[24px] bg-white dark:bg-[#162D42] border border-[#E6DDD1] dark:border-[#264561] overflow-hidden transition-colors">
          <button
            type="button"
            onClick={() => setMilestonesExpanded((prev) => !prev)}
            aria-expanded={milestonesExpanded}
            aria-controls="milestones-accordion-panel"
            className="w-full text-left p-6 space-y-4 hover:bg-[#FAF6F0]/60 dark:hover:bg-[#1E3952]/50 active:bg-[#F2ECE3]/60 dark:active:bg-[#1E3952] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A6B8A]/50"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-xl font-semibold text-[#122638] dark:text-[#FAF6F0]">
                Traguardi
              </h2>
              <div className="flex items-center gap-2.5 shrink-0">
                <span className="text-xs text-[#5B6B79] dark:text-[#9DB0C0] tabular-nums">
                  {unlockedCount} / {MILESTONES.length} tappe
                </span>
                <span
                  aria-hidden="true"
                  className="w-8 h-8 rounded-full bg-[#F2ECE3] dark:bg-[#1E3952] text-[#122638] dark:text-[#FAF6F0] flex items-center justify-center"
                >
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      milestonesExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </span>
              </div>
            </div>

            {nextMilestone ? (
              <div className="rounded-2xl bg-[#F2ECE3] dark:bg-[#1E3952] px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#1A6B8A] dark:text-[#2D8FB3]">
                    Prossimo traguardo
                  </p>
                  <p className="text-sm font-semibold text-[#122638] dark:text-[#FAF6F0] truncate">
                    {nextMilestone.label}
                  </p>
                </div>
                <span className="text-xs font-semibold tabular-nums text-[#122638] dark:text-[#FAF6F0] shrink-0">
                  Mancano {formatEuro(Math.max(0, (target * nextMilestone.percent) / 100 - totalSaved))}
                </span>
              </div>
            ) : (
              <div className="rounded-2xl bg-[#E09F3E]/12 dark:bg-[#E09F3E]/15 border border-[#E09F3E]/35 px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-7 h-7 rounded-full bg-[#E09F3E] text-white flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#9B6B16] dark:text-[#F7C76E]">
                      Tutti i traguardi raggiunti
                    </p>
                    <p className="text-sm font-semibold text-[#122638] dark:text-[#FAF6F0] truncate">
                      Obiettivo 100% completato insieme!
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold tabular-nums text-[#9B6B16] dark:text-[#F7C76E] shrink-0">
                  100%
                </span>
              </div>
            )}
          </button>

          <AnimatePresence initial={false}>
            {milestonesExpanded && (
              <motion.div
                id="milestones-accordion-panel"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-6 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {MILESTONES.map((milestone) => {
                    const unlocked = percentage >= milestone.percent;
                    const isNext = nextMilestone?.percent === milestone.percent;
                    const euroThreshold = (target * milestone.percent) / 100;
                    return (
                      <div
                        key={milestone.percent}
                        className={`flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 border transition-colors ${
                          unlocked
                            ? 'bg-[#E09F3E]/12 dark:bg-[#E09F3E]/15 border-[#E09F3E]/35'
                            : isNext
                              ? 'bg-white dark:bg-[#1E3952] border-[#1A6B8A]/45 dark:border-[#2D8FB3]/55'
                              : 'bg-[#FAF6F0] dark:bg-[#112436] border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              unlocked
                                ? 'bg-[#E09F3E] text-white'
                                : isNext
                                  ? 'bg-[#1A6B8A]/15 dark:bg-[#2D8FB3]/20 text-[#1A6B8A] dark:text-[#2D8FB3]'
                                  : 'bg-[#E6DDD1] dark:bg-[#264561] text-[#5B6B79] dark:text-[#9DB0C0]'
                            }`}
                          >
                            {unlocked ? <Check className="w-3.5 h-3.5" /> : <Flag className="w-3 h-3" />}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-[#122638] dark:text-[#FAF6F0] truncate">
                              {milestone.label}
                            </p>
                            <p className="text-[11px] text-[#5B6B79] dark:text-[#9DB0C0] truncate">
                              {milestone.subtitle}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`text-xs font-semibold tabular-nums shrink-0 ${
                            unlocked
                              ? 'text-[#9B6B16] dark:text-[#F7C76E]'
                              : 'text-[#5B6B79] dark:text-[#9DB0C0]'
                          }`}
                        >
                          {formatEuro(euroThreshold)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>

      {/* Fintech Ledger Recent Entries */}
      <section className="rounded-[24px] bg-white dark:bg-[#162D42] border border-[#E6DDD1] dark:border-[#264561] p-6 space-y-4 transition-colors">
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
              Vendite dell’usato, lavoretti, cashback, scommesse o monetine trovate: registrate
              qui solo guadagni ed entrate esterne.
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
  );
};
