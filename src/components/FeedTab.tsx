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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#1A6B8A]">
            {filtered.length} {filtered.length === 1 ? 'movimento' : 'movimenti'} ·{' '}
            <span className="tabular-nums">{formatEuro(filteredTotal)}</span>
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#122638] mt-0.5">
            Diario dei versamenti
          </h1>
          <p className="text-xs text-[#5B6B79] mt-1">
            Solo entrate extra esterne (zero stipendio e zero risparmi), con reazioni di coppia
          </p>
        </div>

        {/* Segmented Filter Tabs */}
        <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-[#F2ECE3] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`min-h-[40px] px-3.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
              filter === 'all'
                ? 'bg-white text-[#122638] shadow-xs'
                : 'text-[#5B6B79] hover:text-[#122638]'
            }`}
          >
            Tutti
          </button>
          <button
            type="button"
            onClick={() => setFilter('A')}
            className={`min-h-[40px] px-3.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
              filter === 'A'
                ? 'bg-white text-[#122638] shadow-xs'
                : 'text-[#5B6B79] hover:text-[#122638]'
            }`}
          >
            {vault.partnerAName}
          </button>
          <button
            type="button"
            onClick={() => setFilter('B')}
            className={`min-h-[40px] px-3.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
              filter === 'B'
                ? 'bg-white text-[#122638] shadow-xs'
                : 'text-[#5B6B79] hover:text-[#122638]'
            }`}
          >
            {vault.partnerBName}
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[24px] bg-white border border-[#E6DDD1] p-8 text-center space-y-4">
          <p className="font-display text-xl font-semibold text-[#122638]">
            Nessun versamento qui per ora
          </p>
          <p className="text-sm text-[#5B6B79] max-w-md mx-auto">
            Aggiungete un’entrata da una vendita, un lavoretto, una scommessa o monetine trovate.
          </p>
          <button
            type="button"
            onClick={onOpenDeposit}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#E86A52] text-sm font-semibold text-white hover:bg-[#D1533C] inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nuovo versamento extra
          </button>
        </div>
      ) : (
        <div className="rounded-[24px] bg-white border border-[#E6DDD1] divide-y divide-[#E6DDD1] overflow-hidden">
          {filtered.map((entry) => {
            const isConfirming = confirmDeleteId === entry.id;
            return (
              <article key={entry.id} className="p-4 sm:p-5 space-y-3 hover:bg-[#FAF6F0]/60 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <span
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        entry.partnerKey === 'A'
                          ? 'bg-[#E86A52]/12 text-[#D1533C]'
                          : 'bg-[#1A6B8A]/12 text-[#1A6B8A]'
                      }`}
                    >
                      {getSourceIcon(entry.sourceTag)}
                    </span>

                    <div className="min-w-0 space-y-1">
                      <p className="text-sm sm:text-base font-semibold text-[#122638] leading-snug">
                        {entry.note || entry.sourceTag}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#5B6B79]">
                        <span className="font-semibold text-[#122638]">
                          {entry.partnerName}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{entry.sourceTag}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatDateTime(entry.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-display text-xl sm:text-2xl font-semibold tabular-nums text-[#122638]">
                      +{formatEuro(entry.amount)}
                    </span>
                  </div>
                </div>

                {/* Partner Reactions & Delete Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2 pl-[54px]">
                  <div className="flex items-center gap-1.5">
                    {REACTIONS.map((reaction) => {
                      const active = entry[reaction.field];
                      return (
                        <button
                          key={reaction.field}
                          type="button"
                          onClick={() => handleToggleReaction(entry, reaction.field)}
                          aria-label={`${reaction.label} per il versamento di ${entry.partnerName}`}
                          aria-pressed={active}
                          className={`min-h-[38px] min-w-[40px] px-2.5 rounded-xl text-sm transition-all border inline-flex items-center justify-center ${
                            active
                              ? 'bg-[#E86A52]/12 border-[#E86A52]/40 scale-105'
                              : 'bg-[#FAF6F0] border-[#E6DDD1] opacity-75 hover:opacity-100'
                          }`}
                        >
                          <span>{reaction.emoji}</span>
                        </button>
                      );
                    })}
                  </div>

                  {isConfirming ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDelete(entry.id)}
                        className="min-h-[38px] px-3 rounded-xl bg-[#D1533C] text-xs font-semibold text-white hover:bg-[#B8432E]"
                      >
                        Conferma elimina
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="min-h-[38px] px-3 rounded-xl text-xs font-semibold text-[#5B6B79] hover:bg-[#F2ECE3]"
                      >
                        Annulla
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(entry.id)}
                      aria-label="Elimina versamento"
                      className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-[#5B6B79] hover:text-[#D1533C] hover:bg-[#E86A52]/10 transition-colors"
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
