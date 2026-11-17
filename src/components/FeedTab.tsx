import React, { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  deleteContribution,
  ReactionField,
  toggleContributionReaction,
} from '../services/vaultService';
import { Contribution, Vault } from '../types';
import { formatDateTime, formatEuro } from '../utils/format';
import { getSourceIcon } from '../utils/sourceIcons';

interface FeedTabProps {
  vault: Vault;
  contributions: Contribution[];
  onOpenDeposit: () => void;
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
  onOpenDeposit,
}) => {
  const [filter, setFilter] = useState<'all' | 'A' | 'B'>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === 'all') return contributions;
    return contributions.filter((c) => c.partnerKey === filter);
  }, [contributions, filter]);

  const filteredTotal = useMemo(
    () => filtered.reduce((acc, c) => acc + (Number(c.amount) || 0), 0),
    [filtered]
  );

  const handleToggleReaction = async (entry: Contribution, field: ReactionField) => {
    await toggleContributionReaction(vault.id, entry, field);
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
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#122638] dark:text-[#FAF6F0] tracking-tight leading-[1.1]">
            Diario dei versamenti
          </h1>
          <p className="text-xs sm:text-sm text-[#5B6B79] dark:text-[#9DB0C0] pt-0.5">
            Solo entrate extra esterne (zero stipendio e zero risparmi), con reazioni di coppia
          </p>
        </div>

        {/* Minimal Underlined Author Filter Tabs */}
        <nav
          aria-label="Filtra versamenti per autore"
          className="flex items-center gap-6 sm:gap-8 border-b border-[#E6DDD1] dark:border-[#264561] overflow-x-auto"
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
        </nav>
      </header>

      {/* Journal Feed Directly on Canvas */}
      {filtered.length === 0 ? (
        <div className="py-10 sm:py-14 text-center space-y-4">
          <p className="font-display text-xl sm:text-2xl font-semibold text-[#122638] dark:text-[#FAF6F0]">
            Nessun versamento qui per ora
          </p>
          <p className="text-sm text-[#5B6B79] dark:text-[#9DB0C0] max-w-md mx-auto leading-relaxed">
            Aggiungete un’entrata da una vendita, un lavoretto, una scommessa o monetine trovate.
          </p>
          <button
            type="button"
            onClick={onOpenDeposit}
            className="min-h-[44px] px-5 py-2.5 rounded-full bg-[#E86A52] text-sm font-semibold text-white hover:bg-[#D1533C] active:scale-[0.98] transition-all inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4 stroke-[2.25]" />
            <span>Nuovo versamento extra</span>
          </button>
        </div>
      ) : (
        <div className="divide-y divide-[#E6DDD1] dark:divide-[#264561] border-b border-[#E6DDD1] dark:border-[#264561]">
          {filtered.map((entry) => {
            const isConfirming = confirmDeleteId === entry.id;
            return (
              <article
                key={entry.id}
                className="py-4 sm:py-5 space-y-2 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 sm:gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        entry.partnerKey === 'A'
                          ? 'bg-[#E86A52]/12 dark:bg-[#E86A52]/20 text-[#D1533C] dark:text-[#E86A52]'
                          : 'bg-[#1A6B8A]/12 dark:bg-[#2D8FB3]/20 text-[#1A6B8A] dark:text-[#2D8FB3]'
                      }`}
                    >
                      {getSourceIcon(entry.sourceTag)}
                    </span>

                    <div className="min-w-0 space-y-1">
                      <p className="text-[15px] sm:text-base font-semibold text-[#122638] dark:text-[#FAF6F0] leading-snug break-words">
                        {entry.note || entry.sourceTag}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-[#5B6B79] dark:text-[#9DB0C0]">
                        <span
                          className={`font-semibold ${
                            entry.partnerKey === 'A'
                              ? 'text-[#D1533C] dark:text-[#E86A52]'
                              : 'text-[#1A6B8A] dark:text-[#2D8FB3]'
                          }`}
                        >
                          {entry.partnerName}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{entry.sourceTag}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatDateTime(entry.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 pl-2">
                    <span className="font-display text-xl sm:text-2xl font-semibold tabular-nums tracking-tight text-[#122638] dark:text-[#FAF6F0]">
                      +{formatEuro(entry.amount)}
                    </span>
                  </div>
                </div>

                {/* Partner Reactions & Delete Controls (Visually Subordinate, 44px Hit Targets) */}
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
                        className="min-h-[44px] px-3 rounded-full bg-[#D1533C] text-xs font-semibold text-white hover:bg-[#B8432E] transition-colors"
                      >
                        Conferma elimina
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="min-h-[44px] px-2.5 text-xs font-semibold text-[#5B6B79] dark:text-[#9DB0C0] hover:text-[#122638] dark:hover:text-[#FAF6F0] transition-colors"
                      >
                        Annulla
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(entry.id)}
                      aria-label="Elimina versamento"
                      className="min-h-[44px] min-w-[44px] -mr-2.5 flex items-center justify-center rounded-full text-[#5B6B79]/75 dark:text-[#9DB0C0]/75 hover:text-[#D1533C] dark:hover:text-[#E86A52] hover:bg-[#E86A52]/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
