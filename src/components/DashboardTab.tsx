import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  Compass,
  Copy,
  Flag,
  Pencil,
  Plus,
} from 'lucide-react';
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
  const [copiedLink, setCopiedLink] = useState(false);

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

  const handleCopyInvite = async () => {
    const url = `${window.location.origin}/?code=${vault.inviteCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Clipboard blocked fallback ignored
    }
  };

  const recentEntries = contributions.slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Waiting for second partner invite strip */}
      {vault.memberUids.length < 2 && (
        <div className="rounded-2xl bg-[#F2ECE3] border border-[#E6DDD1] p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-sm text-[#122638]">
            <span className="font-semibold">Invita {vault.partnerBName}:</span>{' '}
            <span className="text-[#5B6B79]">
              condividi il link privato per sincronizzare entrambi i telefoni.
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyInvite}
            className="min-h-[44px] px-4 rounded-xl bg-white border border-[#E6DDD1] text-xs font-semibold text-[#122638] hover:bg-[#FAF6F0] transition-colors inline-flex items-center justify-center gap-2 shrink-0 whitespace-nowrap"
          >
            {copiedLink ? <Check className="w-4 h-4 text-[#1A6B8A]" /> : <Copy className="w-4 h-4" />}
            {copiedLink ? 'Link copiato' : `Copia link (${vault.inviteCode})`}
          </button>
        </div>
      )}

      {/* Flagship Fintech Hero Vault Card — Deep Ocean & Sunset Horizon */}
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#122638] via-[#17435E] to-[#1A6B8A] text-[#FAF6F0] p-6 sm:p-9 shadow-lg shadow-[#122638]/10">
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
      <div className="rounded-2xl bg-white border border-[#E6DDD1] px-5 py-3.5">
        {editingNote ? (
          <form onSubmit={handleSaveNote} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <input
              type="text"
              maxLength={APP_LIMITS.loveNoteMax}
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Scrivi un pensiero o motto per il viaggio..."
              className="flex-1 min-h-[44px] rounded-xl border border-[#E6DDD1] bg-[#FAF6F0] px-3.5 text-sm text-[#122638] focus:outline-none focus:border-[#E86A52]"
              autoFocus
            />
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="submit"
                disabled={savingNote}
                className="min-h-[44px] px-4 rounded-xl bg-[#122638] text-xs font-semibold text-white hover:bg-[#1C3952]"
              >
                {savingNote ? 'Salvo...' : 'Salva'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingNote(false);
                  setNoteDraft(vault.loveNote);
                }}
                className="min-h-[44px] px-3 rounded-xl text-xs font-semibold text-[#5B6B79] hover:bg-[#F2ECE3]"
              >
                Annulla
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-[#5B6B79] italic leading-relaxed">
              “{vault.loveNote || 'Zero risparmi o stipendio: ogni piccola entrata extra ci porta in Africa.'}”
            </p>
            <button
              type="button"
              onClick={() => {
                setNoteDraft(vault.loveNote);
                setEditingNote(true);
              }}
              aria-label="Modifica bigliettino"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#5B6B79] hover:text-[#122638] hover:bg-[#F2ECE3] transition-colors shrink-0"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Duo Contributions & Smaller Milestones */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Duo Contribution Card */}
        <section className="lg:col-span-5 rounded-[24px] bg-white border border-[#E6DDD1] p-6 space-y-5">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-xl font-semibold text-[#122638]">
              Contributo di coppia
            </h2>
            <span className="text-xs text-[#5B6B79] tabular-nums">
              {contributions.length} {contributions.length === 1 ? 'entrata' : 'entrate'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-[#FAF6F0] p-4 space-y-2.5">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-full bg-[#E86A52] text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {initialA}
                </span>
                <span className="text-sm font-semibold text-[#122638] truncate">
                  {vault.partnerAName}
                </span>
              </div>
              <div>
                <p className="font-display text-2xl font-semibold tabular-nums text-[#122638]">
                  {formatEuro(partnerATotal)}
                </p>
                <p className="text-xs text-[#5B6B79] tabular-nums mt-0.5">
                  {shareA}% del totale · {partnerACount} extra
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-[#FAF6F0] p-4 space-y-2.5">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-full bg-[#1A6B8A] text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {initialB}
                </span>
                <span className="text-sm font-semibold text-[#122638] truncate">
                  {vault.partnerBName}
                </span>
              </div>
              <div>
                <p className="font-display text-2xl font-semibold tabular-nums text-[#122638]">
                  {formatEuro(partnerBTotal)}
                </p>
                <p className="text-xs text-[#5B6B79] tabular-nums mt-0.5">
                  {shareB}% del totale · {partnerBCount} extra
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="h-2.5 w-full rounded-full bg-[#F2ECE3] overflow-hidden flex gap-0.5">
              <div
                className="h-full bg-[#E86A52] rounded-l-full transition-all duration-500"
                style={{ width: `${shareA}%` }}
              />
              <div
                className="h-full bg-[#1A6B8A] rounded-r-full transition-all duration-500"
                style={{ width: `${shareB}%` }}
              />
            </div>
          </div>
        </section>

        {/* Smaller Step Milestones (5% -> 100%) */}
        <section className="lg:col-span-7 rounded-[24px] bg-white border border-[#E6DDD1] p-6 space-y-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-xl font-semibold text-[#122638]">
              Piccoli traguardi verso l’Africa
            </h2>
            <span className="text-xs text-[#5B6B79] tabular-nums">
              {unlockedCount} / {MILESTONES.length} tappe
            </span>
          </div>

          {nextMilestone && (
            <div className="rounded-2xl bg-[#F2ECE3] px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#1A6B8A]">Prossimo passo</p>
                <p className="text-sm font-semibold text-[#122638] truncate">
                  {nextMilestone.label}
                </p>
              </div>
              <span className="text-xs font-semibold tabular-nums text-[#122638] shrink-0">
                Mancano {formatEuro(Math.max(0, (target * nextMilestone.percent) / 100 - totalSaved))}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {MILESTONES.map((milestone) => {
              const unlocked = percentage >= milestone.percent;
              const isNext = nextMilestone?.percent === milestone.percent;
              const euroThreshold = (target * milestone.percent) / 100;
              return (
                <div
                  key={milestone.percent}
                  className={`flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 border transition-colors ${
                    unlocked
                      ? 'bg-[#E09F3E]/12 border-[#E09F3E]/35'
                      : isNext
                        ? 'bg-white border-[#1A6B8A]/45'
                        : 'bg-[#FAF6F0] border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        unlocked
                          ? 'bg-[#E09F3E] text-white'
                          : isNext
                            ? 'bg-[#1A6B8A]/15 text-[#1A6B8A]'
                            : 'bg-[#E6DDD1] text-[#5B6B79]'
                      }`}
                    >
                      {unlocked ? <Check className="w-3.5 h-3.5" /> : <Flag className="w-3 h-3" />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#122638] truncate">
                        {milestone.label}
                      </p>
                      <p className="text-[11px] text-[#5B6B79] truncate">
                        {milestone.subtitle}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-xs font-semibold tabular-nums shrink-0 ${
                      unlocked ? 'text-[#9B6B16]' : 'text-[#5B6B79]'
                    }`}
                  >
                    {formatEuro(euroThreshold)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Fintech Ledger Recent Entries */}
      <section className="rounded-[24px] bg-white border border-[#E6DDD1] p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-xl font-semibold text-[#122638]">
            Ultime entrate extra
          </h2>
          {contributions.length > 0 && (
            <button
              type="button"
              onClick={onNavigateFeed}
              className="min-h-[44px] px-3 rounded-xl text-xs font-semibold text-[#1A6B8A] hover:bg-[#F2ECE3] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              Vedi tutte
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {recentEntries.length === 0 ? (
          <div className="rounded-2xl bg-[#FAF6F0] p-6 text-center space-y-2">
            <p className="text-sm font-medium text-[#122638]">
              SALVAFRICA è pronto per la prima entrata extra
            </p>
            <p className="text-xs text-[#5B6B79]">
              Vendite dell’usato, lavoretti, cashback, scommesse o monetine trovate: registrate
              qui solo guadagni ed entrate esterne.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E6DDD1]">
            {recentEntries.map((entry) => (
              <div
                key={entry.id}
                className="py-3.5 first:pt-1 last:pb-1 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      entry.partnerKey === 'A'
                        ? 'bg-[#E86A52]/12 text-[#D1533C]'
                        : 'bg-[#1A6B8A]/12 text-[#1A6B8A]'
                    }`}
                  >
                    {getSourceIcon(entry.sourceTag)}
                  </span>

                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-semibold text-[#122638] truncate">
                      {entry.note || entry.sourceTag}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-[#5B6B79] truncate">
                      <span className="font-medium text-[#122638]">{entry.partnerName}</span>
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

                <span className="font-display text-lg font-semibold tabular-nums text-[#122638] shrink-0">
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
