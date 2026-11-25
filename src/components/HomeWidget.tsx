import React from 'react';
import { ArrowUpRight, Plus } from 'lucide-react';
import { Vault } from '../types';
import { formatEuro } from '../utils/format';

export interface HomeWidgetProps {
  vault: Vault;
  totalSaved: number;
  variant?: 'compact' | 'preview' | 'standalone';
  onOpenApp?: () => void;
  onOpenDeposit?: () => void;
}

export const HomeWidget: React.FC<HomeWidgetProps> = ({
  vault,
  totalSaved,
  variant = 'compact',
  onOpenApp,
  onOpenDeposit,
}) => {
  const safeTarget = Math.max(1, Number(vault.targetAmount) || 1);
  const safeSaved = Math.max(0, Number(totalSaved) || 0);
  const rawPercent = (safeSaved / safeTarget) * 100;
  const clampedPercent = Math.min(100, Math.max(0, rawPercent));
  const remaining = Math.max(0, safeTarget - safeSaved);

  const formattedPercent =
    clampedPercent === 0
      ? '0%'
      : clampedPercent >= 100
        ? '100%'
        : clampedPercent < 10
          ? `${clampedPercent.toFixed(1).replace('.', ',')}%`
          : `${Math.round(clampedPercent)}%`;

  const ringSize = variant === 'compact' ? 64 : 74;
  const strokeWidth = 5;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clampedPercent / 100) * circumference;

  const widgetCard = (
    <div
      role="region"
      aria-label={`Widget ${vault.title}: saldo ${formatEuro(safeSaved)}, progresso ${formattedPercent}`}
      className={`relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#0F2437] via-[#132C42] to-[#0B1B29] text-[#FAF6F0] border border-[#264561] shadow-[0_14px_34px_-14px_rgba(7,17,26,0.65)] ${
        variant === 'compact' ? 'p-4' : 'p-5 sm:p-6'
      }`}
    >
      {/* Subtle savanna horizon tint */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-12 w-36 h-36 rounded-full bg-[#E86A52]/14 blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-10 -bottom-14 w-36 h-36 rounded-full bg-[#1A6B8A]/18 blur-2xl"
      />

      <div className="relative z-10 space-y-4">
        {/* Clean unboxed widget header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <svg viewBox="0 0 28 28" className="w-5 h-5 shrink-0" aria-hidden="true">
              <circle cx="14" cy="14" r="14" fill="#183650" />
              <circle cx="14" cy="13" r="6" fill="#E86A52" />
              <path d="M2 16 Q8 13.5 14 16 T26 16 L26 28 L2 28 Z" fill="#1A6B8A" />
            </svg>
            <span className="text-[11px] font-semibold tracking-wider uppercase text-[#9DB0C0] truncate">
              SALVAFRICA · {vault.title}
            </span>
          </div>

          {onOpenApp && variant !== 'standalone' && (
            <button
              type="button"
              onClick={onOpenApp}
              aria-label="Apri salvadanaio completo"
              className="min-h-[36px] min-w-[36px] -mr-1.5 -my-1.5 flex items-center justify-center rounded-full text-[#9DB0C0] hover:text-[#FAF6F0] hover:bg-white/10 transition-colors shrink-0"
            >
              <ArrowUpRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Core metrics: Balance + Circular Progress Ring */}
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium text-[#9DB0C0]">Saldo totale</p>
            <p
              className={`font-display font-semibold tabular-nums tracking-tight text-[#FAF6F0] leading-none ${
                variant === 'compact' ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl'
              }`}
            >
              {formatEuro(safeSaved)}
            </p>
            <p className="text-xs text-[#9DB0C0] tabular-nums pt-0.5 truncate">
              su {formatEuro(safeTarget)}
              <span aria-hidden="true" className="mx-1.5 opacity-60">
                ·
              </span>
              {remaining > 0 ? `mancano ${formatEuro(remaining)}` : 'obiettivo raggiunto'}
            </p>
          </div>

          <div
            className="relative shrink-0 flex items-center justify-center"
            style={{ width: ringSize, height: ringSize }}
          >
            <svg
              width={ringSize}
              height={ringSize}
              viewBox={`0 0 ${ringSize} ${ringSize}`}
              className="-rotate-90"
              aria-hidden="true"
            >
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="none"
                stroke="#223E58"
                strokeWidth={strokeWidth}
              />
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="none"
                stroke="#E86A52"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                className="transition-[stroke-dashoffset] duration-500 ease-out"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-display text-sm font-semibold tabular-nums text-[#FAF6F0]">
              {formattedPercent}
            </span>
          </div>
        </div>

        {/* Linear progress bar */}
        <div className="space-y-1.5">
          <div
            className="h-1.5 w-full rounded-full bg-[#223E58] overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.round(clampedPercent)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso salvadanaio"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#E86A52] to-[#F7C76E] transition-all duration-500 ease-out"
              style={{ width: `${clampedPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );

  if (variant === 'standalone') {
    return (
      <div className="min-h-[100dvh] w-full bg-[#FAF6F0] dark:bg-[#0E1F2E] text-[#122638] dark:text-[#FAF6F0] flex flex-col items-center justify-center px-5 py-8 pt-safe pb-safe">
        <div className="w-full max-w-sm space-y-4">
          {widgetCard}

          <div className="flex items-center gap-2.5">
            {onOpenDeposit && (
              <button
                type="button"
                onClick={onOpenDeposit}
                className="flex-1 min-h-[46px] px-4 rounded-full bg-[#E86A52] hover:bg-[#D1533C] text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4 stroke-[2.25]" />
                <span>Versa extra</span>
              </button>
            )}
            {onOpenApp && (
              <button
                type="button"
                onClick={onOpenApp}
                className="flex-1 min-h-[46px] px-4 rounded-full bg-[#F2ECE3] dark:bg-[#162D42] border border-[#E6DDD1] dark:border-[#264561] text-xs font-semibold text-[#122638] dark:text-[#FAF6F0] hover:bg-[#E6DDD1]/80 dark:hover:bg-[#1E3952] inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <span>Apri app completa</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return widgetCard;
};
