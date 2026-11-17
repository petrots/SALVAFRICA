import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Compass, Flag, Plus } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { MILESTONES, Milestone, Vault } from '../types';
import { formatEuro } from '../utils/format';
import { triggerHaptic } from '../utils/haptics';

interface JourneyPathProps {
  vault: Vault;
  totalSaved: number;
  justDepositedKey: number;
  celebratedMilestoneEvent?: { key: number; index: number } | null;
  onOpenDeposit: () => void;
}

interface Point2D {
  x: number;
  y: number;
}

interface CubicSegment {
  p0: Point2D;
  c1: Point2D;
  c2: Point2D;
  p1: Point2D;
}

interface CurveSample {
  s: number;
  x: number;
  y: number;
}

interface SampledCurve {
  samples: CurveSample[];
  segmentRanges: Array<{ start: number; end: number }>;
}

function evalCubic(seg: CubicSegment, t: number): Point2D {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  const a = mt2 * mt;
  const b = 3 * mt2 * t;
  const c = 3 * mt * t2;
  const d = t2 * t;
  return {
    x: a * seg.p0.x + b * seg.c1.x + c * seg.c2.x + d * seg.p1.x,
    y: a * seg.p0.y + b * seg.c1.y + c * seg.c2.y + d * seg.p1.y,
  };
}

function buildSampledCurve(
  segments: CubicSegment[],
  stepsPerSegment = 48
): SampledCurve {
  const rawPoints: Array<{ x: number; y: number }> = [];
  segments.forEach((seg, segIdx) => {
    for (let i = 0; i <= stepsPerSegment; i++) {
      if (segIdx > 0 && i === 0) continue;
      const pt = evalCubic(seg, i / stepsPerSegment);
      rawPoints.push({ x: pt.x, y: pt.y });
    }
  });

  const cumLengths: number[] = [0];
  for (let i = 1; i < rawPoints.length; i++) {
    const dx = rawPoints[i].x - rawPoints[i - 1].x;
    const dy = rawPoints[i].y - rawPoints[i - 1].y;
    cumLengths.push(cumLengths[i - 1] + Math.hypot(dx, dy));
  }

  const totalLen = Math.max(1e-6, cumLengths[cumLengths.length - 1]);
  const samples: CurveSample[] = rawPoints.map((pt, i) => ({
    s: cumLengths[i] / totalLen,
    x: pt.x,
    y: pt.y,
  }));

  const segmentRanges: Array<{ start: number; end: number }> = [];
  for (let segIdx = 0; segIdx < segments.length; segIdx++) {
    const startIdx = segIdx * stepsPerSegment;
    const endIdx = (segIdx + 1) * stepsPerSegment;
    segmentRanges.push({
      start: samples[startIdx]?.s ?? 0,
      end: samples[endIdx]?.s ?? 1,
    });
  }

  return { samples, segmentRanges };
}

function getPointAtArcProgress(curve: SampledCurve, progress: number): Point2D {
  const clamped = Math.min(1, Math.max(0, progress));
  const { samples } = curve;
  if (samples.length === 0) return { x: 0, y: 0 };
  if (clamped <= 0) return { x: samples[0].x, y: samples[0].y };
  if (clamped >= 1) {
    const last = samples[samples.length - 1];
    return { x: last.x, y: last.y };
  }

  for (let i = 1; i < samples.length; i++) {
    if (samples[i].s >= clamped) {
      const prev = samples[i - 1];
      const curr = samples[i];
      const span = Math.max(1e-6, curr.s - prev.s);
      const localT = (clamped - prev.s) / span;
      return {
        x: prev.x + (curr.x - prev.x) * localT,
        y: prev.y + (curr.y - prev.y) * localT,
      };
    }
  }

  const last = samples[samples.length - 1];
  return { x: last.x, y: last.y };
}

function buildTraveledPathD(curve: SampledCurve, progress: number): string {
  const clamped = Math.min(1, Math.max(0, progress));
  if (clamped <= 0.00001 || curve.samples.length === 0) return '';

  const pts: Point2D[] = [{ x: curve.samples[0].x, y: curve.samples[0].y }];
  for (let i = 1; i < curve.samples.length; i++) {
    const sample = curve.samples[i];
    if (sample.s <= clamped) {
      pts.push({ x: sample.x, y: sample.y });
    } else {
      const endPt = getPointAtArcProgress(curve, clamped);
      pts.push({ x: endPt.x, y: endPt.y });
      break;
    }
  }

  if (pts.length < 2) return '';
  return pts
    .map(
      (pt, idx) =>
        `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`
    )
    .join(' ');
}

function formatPrecisePercent(pct: number): string {
  if (pct <= 0) return '0%';
  if (pct >= 100) return '100%';
  if (pct < 0.1) {
    return pct < 0.01 ? '< 0,01%' : `${pct.toFixed(2).replace('.', ',')}%`;
  }
  if (pct < 1) {
    return `${pct.toFixed(1).replace('.', ',')}%`;
  }
  const capped = Math.min(99.9, pct);
  const rounded = Math.round(capped * 10) / 10;
  return `${rounded.toString().replace('.', ',')}%`;
}

// Compact Savannah Trail (viewBox 0 0 420 220)
const COMPACT_SEGMENTS: CubicSegment[] = [
  {
    p0: { x: 46, y: 174 },
    c1: { x: 118, y: 188 },
    c2: { x: 148, y: 146 },
    p1: { x: 214, y: 134 },
  },
  {
    p0: { x: 214, y: 134 },
    c1: { x: 280, y: 122 },
    c2: { x: 308, y: 94 },
    p1: { x: 372, y: 92 },
  },
];

const COMPACT_PATH_D =
  'M 46 174 C 118 188, 148 146, 214 134 C 280 122, 308 94, 372 92';

const COMPACT_CURVE = buildSampledCurve(COMPACT_SEGMENTS, 72);

// Expanded Savannah Journey (uniform 1:1 viewBox 0 0 360 692)
const EXPANDED_VIEW_W = 360;
const EXPANDED_VIEW_H = 692;
const EXPANDED_START_NODE: Point2D = { x: 180, y: 28 };
const EXPANDED_MILESTONE_NODES: Point2D[] = [
  { x: 74, y: 88 },
  { x: 286, y: 150 },
  { x: 74, y: 212 },
  { x: 286, y: 274 },
  { x: 74, y: 336 },
  { x: 286, y: 398 },
  { x: 74, y: 460 },
  { x: 286, y: 522 },
  { x: 74, y: 584 },
  { x: 286, y: 646 },
];

const EXPANDED_ALL_NODES: Point2D[] = [
  EXPANDED_START_NODE,
  ...EXPANDED_MILESTONE_NODES,
];

const EXPANDED_SEGMENTS: CubicSegment[] = EXPANDED_ALL_NODES.slice(0, -1).map(
  (p0, idx) => {
    const p1 = EXPANDED_ALL_NODES[idx + 1];
    const dy = p1.y - p0.y;
    return {
      p0,
      c1: { x: p0.x, y: p0.y + dy * 0.56 },
      c2: { x: p1.x, y: p1.y - dy * 0.56 },
      p1,
    };
  }
);

const EXPANDED_PATH_D = EXPANDED_SEGMENTS.reduce((acc, seg, idx) => {
  const prefix = idx === 0 ? `M ${seg.p0.x} ${seg.p0.y}` : '';
  return `${acc} ${prefix} C ${seg.c1.x} ${seg.c1.y}, ${seg.c2.x} ${seg.c2.y}, ${seg.p1.x} ${seg.p1.y}`.trim();
}, '');

const EXPANDED_CURVE = buildSampledCurve(EXPANDED_SEGMENTS, 44);

// Stylized flat-top African acacia vector silhouette
const AcaciaTree: React.FC<{
  x: number;
  y: number;
  scale?: number;
  opacity?: number;
}> = ({ x, y, scale = 1, opacity = 1 }) => (
  <g transform={`translate(${x}, ${y}) scale(${scale})`} opacity={opacity}>
    <ellipse
      cx="0"
      cy="2"
      rx="20"
      ry="3"
      className="fill-[#B7A180]/40 dark:fill-[#07111A]/55"
    />
    <path
      d="M -1.5 1 Q -2 -14 0 -26 M 0 -16 Q -11 -23 -15 -29 M 0 -19 Q 12 -24 16 -30"
      fill="none"
      strokeWidth="2.6"
      strokeLinecap="round"
      className="stroke-[#5D5348] dark:stroke-[#56768E]"
    />
    <path
      d="M -28 -29 Q -16 -38 0 -35 Q 17 -39 27 -29 Q 15 -26 0 -27 Q -16 -26 -28 -29 Z"
      className="fill-[#5A7865] dark:fill-[#3F6B5E]"
    />
    <path
      d="M -21 -34 Q -6 -43 12 -39 Q 22 -36 24 -32 Q 8 -31 -21 -34 Z"
      className="fill-[#6D8C77] dark:fill-[#518273]"
    />
  </g>
);

// Discrete savannah grass tuft
const GrassTuft: React.FC<{
  x: number;
  y: number;
  scale?: number;
  opacity?: number;
}> = ({ x, y, scale = 1, opacity = 0.9 }) => (
  <g transform={`translate(${x}, ${y}) scale(${scale})`} opacity={opacity}>
    <path
      d="M 0 0 Q -4 -7 -7 -10 M 0 0 Q 0 -9 1 -12 M 0 0 Q 5 -7 8 -9"
      fill="none"
      strokeWidth="1.6"
      strokeLinecap="round"
      className="stroke-[#6D8C77] dark:stroke-[#558574]"
    />
  </g>
);

// Smooth stylized savannah rocks
const SavannahRocks: React.FC<{
  x: number;
  y: number;
  scale?: number;
  opacity?: number;
}> = ({ x, y, scale = 1, opacity = 0.85 }) => (
  <g transform={`translate(${x}, ${y}) scale(${scale})`} opacity={opacity}>
    <path
      d="M -11 2 Q -10 -6 -3 -6 Q 3 -6 5 2 Z"
      className="fill-[#CBB493] dark:fill-[#2D516F]"
    />
    <path
      d="M 1 2 Q 2 -4 7 -4 Q 12 -4 13 2 Z"
      className="fill-[#B99E7B] dark:fill-[#24435E]"
    />
  </g>
);

// Minimalist illustrated position beacon directly integrated into the path
const MinimalPositionMarker: React.FC<{
  x: number;
  y: number;
  size?: 'sm' | 'md';
}> = ({ x, y, size = 'md' }) => {
  const outer = size === 'sm' ? 12 : 14;
  const ring = size === 'sm' ? 6.8 : 7.8;
  const core = size === 'sm' ? 2.8 : 3.4;
  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle r={outer} className="fill-[#E86A52]/20 dark:fill-[#E86A52]/28" />
      <circle
        r={ring}
        className="fill-[#FAF6F0] dark:fill-[#0E1F2E] stroke-[#E86A52]"
        strokeWidth="2.5"
      />
      <circle r={core} className="fill-[#E86A52]" />
    </g>
  );
};

export const JourneyPath: React.FC<JourneyPathProps> = ({
  vault,
  totalSaved,
  celebratedMilestoneEvent,
  onOpenDeposit,
}) => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [expanded, setExpanded] = useState(false);
  const [inspectedMilestoneIndex, setInspectedMilestoneIndex] = useState<
    number | null
  >(null);
  const [celebratingIdx, setCelebratingIdx] = useState<number | null>(null);

  const target = Math.max(1, vault.targetAmount);
  const safeSaved = Math.round(Math.max(0, totalSaved) * 100) / 100;
  const rawPct = (safeSaved / target) * 100;
  const overallPct = Math.min(100, Math.max(0, rawPct));
  const overallPctLabel = formatPrecisePercent(overallPct);
  const remainingTotal = Math.max(0, target - safeSaved);

  const nextIndex = MILESTONES.findIndex((m) => overallPct < m.percent);
  const allReached = nextIndex === -1;
  const unlockedCount = allReached ? MILESTONES.length : nextIndex;

  // Brief celebratory micro-animation strictly once per unique milestone event
  const lastCelebratedEventKeyRef = useRef(0);
  useEffect(() => {
    if (
      !celebratedMilestoneEvent ||
      celebratedMilestoneEvent.key <= lastCelebratedEventKeyRef.current ||
      prefersReducedMotion
    ) {
      return;
    }

    lastCelebratedEventKeyRef.current = celebratedMilestoneEvent.key;
    setCelebratingIdx(celebratedMilestoneEvent.index);
    const timer = window.setTimeout(() => {
      setCelebratingIdx(null);
    }, 1700);
    return () => window.clearTimeout(timer);
  }, [celebratedMilestoneEvent, prefersReducedMotion]);

  // Segment math strictly between previous milestone threshold and next milestone threshold
  const activeSegmentIndex = allReached ? MILESTONES.length - 1 : nextIndex;
  const prevMilestone: Milestone | null =
    activeSegmentIndex > 0 ? MILESTONES[activeSegmentIndex - 1] : null;
  const targetMilestone: Milestone = MILESTONES[activeSegmentIndex];

  const prevThreshold = prevMilestone
    ? (target * prevMilestone.percent) / 100
    : 0;
  const nextThreshold = (target * targetMilestone.percent) / 100;
  const segmentSpan = Math.max(0.01, nextThreshold - prevThreshold);
  const segmentProgress = allReached
    ? 1
    : Math.min(1, Math.max(0, (safeSaved - prevThreshold) / segmentSpan));
  const missingToNext = allReached
    ? 0
    : Math.max(0, nextThreshold - safeSaved);

  const expandedTargetProgress = useMemo(() => {
    if (allReached) return 1;
    const segRange = EXPANDED_CURVE.segmentRanges[nextIndex];
    if (!segRange) return 0;
    return segRange.start + (segRange.end - segRange.start) * segmentProgress;
  }, [allReached, nextIndex, segmentProgress]);

  // Smooth along-curve progression when savings change (never plays on mount)
  const [animatedCompactProgress, setAnimatedCompactProgress] =
    useState(segmentProgress);
  const prevSegmentIdxRef = useRef(activeSegmentIndex);
  const animCompactRef = useRef(segmentProgress);

  useEffect(() => {
    if (prefersReducedMotion) {
      prevSegmentIdxRef.current = activeSegmentIndex;
      animCompactRef.current = segmentProgress;
      setAnimatedCompactProgress(segmentProgress);
      return;
    }

    const segmentChanged = prevSegmentIdxRef.current !== activeSegmentIndex;
    prevSegmentIdxRef.current = activeSegmentIndex;

    const from = segmentChanged ? 0 : animCompactRef.current;
    const to = segmentProgress;

    if (Math.abs(to - from) < 0.0005) {
      animCompactRef.current = to;
      setAnimatedCompactProgress(to);
      return;
    }

    let rafId = 0;
    const duration = 520;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      const current = from + (to - from) * eased;
      animCompactRef.current = current;
      setAnimatedCompactProgress(current);
      if (elapsed < 1) {
        rafId = window.requestAnimationFrame(step);
      }
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [segmentProgress, activeSegmentIndex, prefersReducedMotion]);

  const [animatedExpandedProgress, setAnimatedExpandedProgress] = useState(
    expandedTargetProgress
  );
  const animExpandedRef = useRef(expandedTargetProgress);

  useEffect(() => {
    if (prefersReducedMotion) {
      animExpandedRef.current = expandedTargetProgress;
      setAnimatedExpandedProgress(expandedTargetProgress);
      return;
    }

    const from = animExpandedRef.current;
    const to = expandedTargetProgress;

    if (Math.abs(to - from) < 0.0005) {
      animExpandedRef.current = to;
      setAnimatedExpandedProgress(to);
      return;
    }

    let rafId = 0;
    const duration = 550;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      const current = from + (to - from) * eased;
      animExpandedRef.current = current;
      setAnimatedExpandedProgress(current);
      if (elapsed < 1) {
        rafId = window.requestAnimationFrame(step);
      }
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [expandedTargetProgress, prefersReducedMotion]);

  const compactMarkerPoint = useMemo(
    () => getPointAtArcProgress(COMPACT_CURVE, animatedCompactProgress),
    [animatedCompactProgress]
  );

  const compactTraveledPathD = useMemo(
    () => buildTraveledPathD(COMPACT_CURVE, animatedCompactProgress),
    [animatedCompactProgress]
  );

  const expandedMarkerPoint = useMemo(
    () => getPointAtArcProgress(EXPANDED_CURVE, animatedExpandedProgress),
    [animatedExpandedProgress]
  );

  const expandedTraveledPathD = useMemo(
    () => buildTraveledPathD(EXPANDED_CURVE, animatedExpandedProgress),
    [animatedExpandedProgress]
  );

  const isMarkerNearExpandedCheckpoint = useMemo(
    () =>
      EXPANDED_MILESTONE_NODES.some(
        (n) =>
          Math.hypot(
            expandedMarkerPoint.x - n.x,
            expandedMarkerPoint.y - n.y
          ) < 12
      ),
    [expandedMarkerPoint]
  );

  const segmentPercentLabel = formatPrecisePercent(segmentProgress * 100);

  const inspectedMilestone =
    inspectedMilestoneIndex !== null ? MILESTONES[inspectedMilestoneIndex] : null;
  const inspectedThreshold = inspectedMilestone
    ? (target * inspectedMilestone.percent) / 100
    : 0;
  const inspectedUnlocked = inspectedMilestone
    ? overallPct >= inspectedMilestone.percent
    : false;
  const inspectedMissing = Math.max(0, inspectedThreshold - safeSaved);

  return (
    <section
      aria-label="Diario di viaggio verso l’obiettivo"
      className="space-y-3 lg:space-y-5"
    >
      {/* Editorial Top Composition + Seamless Integrated Savannah */}
      <div className="lg:grid lg:grid-cols-12 lg:gap-10 lg:items-center space-y-1.5 lg:space-y-0">
        {/* 1. Editorial Header directly on the page canvas */}
        <header className="lg:col-span-5 space-y-3.5">
          <div className="flex items-center gap-1.5 text-xs text-[#5B6B79] dark:text-[#9DB0C0]">
            <Compass className="w-3.5 h-3.5 text-[#E86A52] shrink-0" />
            <span className="font-medium tracking-wide">
              {vault.partnerAName} & {vault.partnerBName}
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#122638] dark:text-[#FAF6F0] tracking-tight leading-[1.1]">
              {vault.title}
            </h1>

            <div className="flex items-center justify-between gap-3 pt-0.5">
              <div className="min-w-0">
                <p className="font-display text-[2.75rem] sm:text-5xl font-semibold tabular-nums text-[#122638] dark:text-[#FAF6F0] tracking-tight leading-none">
                  {formatEuro(safeSaved)}
                </p>
                <p className="text-xs sm:text-sm text-[#5B6B79] dark:text-[#9DB0C0] tabular-nums mt-1.5 leading-snug">
                  su{' '}
                  <span className="font-semibold text-[#122638] dark:text-[#FAF6F0]">
                    {formatEuro(target)}
                  </span>
                  <span aria-hidden="true" className="mx-1.5 opacity-45">
                    ·
                  </span>
                  <span className="font-semibold text-[#1A6B8A] dark:text-[#2D8FB3]">
                    {overallPctLabel}
                  </span>
                  {remainingTotal === 0 && (
                    <span className="ml-1.5 font-semibold text-[#9B6B16] dark:text-[#F7C76E]">
                      · Obiettivo raggiunto
                    </span>
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={onOpenDeposit}
                className="min-h-[44px] inline-flex items-center justify-end shrink-0 group focus:outline-none"
              >
                <span className="rounded-full bg-[#E86A52] px-3.5 py-1.5 text-xs font-semibold text-white group-hover:bg-[#D1533C] group-active:scale-[0.97] group-focus-visible:ring-2 group-focus-visible:ring-[#1A6B8A] transition-all inline-flex items-center gap-1 whitespace-nowrap">
                  <Plus className="w-3.5 h-3.5 stroke-[2.25]" />
                  <span>Versa extra</span>
                </span>
              </button>
            </div>
          </div>

          {/* Desktop Inline Next Milestone & Expand Trigger */}
          {!expanded && (
            <div className="hidden lg:block pt-4 border-t border-[#E6DDD1] dark:border-[#264561] space-y-2.5">
              {allReached ? (
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-[#9B6B16] dark:text-[#F7C76E]">
                    Destinazione raggiunta
                  </p>
                  <p className="font-display text-lg font-semibold text-[#122638] dark:text-[#FAF6F0] leading-snug">
                    {targetMilestone.label} · 100% completato
                  </p>
                </div>
              ) : (
                <div className="flex items-baseline justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-semibold text-[#122638] dark:text-[#FAF6F0] leading-snug truncate">
                      {targetMilestone.label}
                    </p>
                    <p className="text-xs text-[#5B6B79] dark:text-[#9DB0C0] tabular-nums mt-0.5">
                      Soglia {formatEuro(nextThreshold)} · {segmentPercentLabel} della tappa
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-[#D1533C] dark:text-[#E86A52] whitespace-nowrap shrink-0">
                    Mancano {formatEuro(missingToNext)}
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setExpanded(true);
                  setInspectedMilestoneIndex(null);
                }}
                aria-expanded={expanded}
                aria-controls="full-journey-panel"
                className="min-h-[44px] -my-1.5 inline-flex items-center gap-1.5 text-[13px] sm:text-sm font-semibold text-[#1A6B8A] dark:text-[#2D8FB3] hover:text-[#122638] dark:hover:text-[#FAF6F0] transition-colors focus:outline-none focus-visible:underline"
              >
                <span>Esplora tutto il percorso</span>
                <span className="text-xs font-medium text-[#5B6B79] dark:text-[#9DB0C0] tabular-nums">
                  ({unlockedCount}/{MILESTONES.length})
                </span>
                <ChevronDown className="w-4 h-4 shrink-0" />
              </button>
            </div>
          )}
        </header>

        {/* 2. Cardless Illustrated African Savannah Canvas blending directly into page background */}
        {!expanded && (
          <div className="lg:col-span-7 -mx-4 sm:-mx-6 lg:mx-0">
            <svg
              viewBox="0 0 420 220"
              className="w-full h-auto block select-none"
              role="img"
              aria-label={
                allReached
                  ? `Viaggio nella savana completato: ${formatEuro(safeSaved)} su ${formatEuro(target)}`
                  : `Tratto verso ${targetMilestone.label}: avanzamento ${segmentPercentLabel}, mancano ${formatEuro(missingToNext)}`
              }
            >
              <defs>
                {/* Seamless top-and-bottom bleed into #FAF6F0 (light) and #0E1F2E (dark) */}
                <linearGradient
                  id="page-fade-bottom-light"
                  x1="0%"
                  y1="0%"
                  x2="0%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#FAF6F0" stopOpacity="0" />
                  <stop offset="100%" stopColor="#FAF6F0" stopOpacity="1" />
                </linearGradient>
                <linearGradient
                  id="page-fade-bottom-dark"
                  x1="0%"
                  y1="0%"
                  x2="0%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#0E1F2E" stopOpacity="0" />
                  <stop offset="100%" stopColor="#0E1F2E" stopOpacity="1" />
                </linearGradient>
                <linearGradient
                  id="page-fade-side-light"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor="#FAF6F0" stopOpacity="1" />
                  <stop offset="10%" stopColor="#FAF6F0" stopOpacity="0" />
                  <stop offset="90%" stopColor="#FAF6F0" stopOpacity="0" />
                  <stop offset="100%" stopColor="#FAF6F0" stopOpacity="1" />
                </linearGradient>
                <linearGradient
                  id="page-fade-side-dark"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor="#0E1F2E" stopOpacity="1" />
                  <stop offset="10%" stopColor="#0E1F2E" stopOpacity="0" />
                  <stop offset="90%" stopColor="#0E1F2E" stopOpacity="0" />
                  <stop offset="100%" stopColor="#0E1F2E" stopOpacity="1" />
                </linearGradient>

                <linearGradient
                  id="savannah-horizon-glow-light"
                  x1="0%"
                  y1="0%"
                  x2="0%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#FAF6F0" stopOpacity="0" />
                  <stop offset="55%" stopColor="#F4E6D0" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#FAF6F0" stopOpacity="0" />
                </linearGradient>
                <linearGradient
                  id="savannah-horizon-glow-dark"
                  x1="0%"
                  y1="0%"
                  x2="0%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#0E1F2E" stopOpacity="0" />
                  <stop offset="55%" stopColor="#163147" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#0E1F2E" stopOpacity="0" />
                </linearGradient>

                <linearGradient
                  id="savannah-trail-progress"
                  gradientUnits="userSpaceOnUse"
                  x1="46"
                  y1="174"
                  x2="372"
                  y2="92"
                >
                  <stop offset="0%" stopColor="#1A6B8A" />
                  <stop offset="52%" stopColor="#E09F3E" />
                  <stop offset="100%" stopColor="#E86A52" />
                </linearGradient>
              </defs>

              {/* Soft atmospheric horizon band emerging directly from page background */}
              <rect
                x="0"
                y="20"
                width="420"
                height="160"
                fill="url(#savannah-horizon-glow-light)"
                className="dark:hidden"
              />
              <rect
                x="0"
                y="20"
                width="420"
                height="160"
                fill="url(#savannah-horizon-glow-dark)"
                className="hidden dark:block"
              />

              {/* Warm Savannah Sun */}
              <circle
                cx="350"
                cy="48"
                r="32"
                className="fill-[#E09F3E]/12 dark:fill-[#F7C76E]/10"
              />
              <circle
                cx="350"
                cy="48"
                r="17"
                className="fill-[#E09F3E]/36 dark:fill-[#F7C76E]/26"
              />

              {/* Far Savannah Hills & Sand Dunes */}
              <path
                d="M 0 116 Q 70 82 152 104 Q 232 124 304 88 Q 362 62 420 92 L 420 220 L 0 220 Z"
                className="fill-[#EDE0CB] dark:fill-[#153048]"
              />

              {/* Midground Rolling Terrain */}
              <path
                d="M 0 140 Q 110 112 216 130 Q 320 148 420 108 L 420 220 L 0 220 Z"
                className="fill-[#E4D1B4] dark:fill-[#1B3C58]"
              />

              {/* Distant & Midground Acacias */}
              <AcaciaTree x={254} y={108} scale={0.56} opacity={0.82} />
              <AcaciaTree x={74} y={120} scale={0.86} opacity={0.96} />

              {/* Foreground Soft Savannah Ground */}
              <path
                d="M 0 166 Q 130 146 248 162 Q 346 174 420 138 L 420 220 L 0 220 Z"
                className="fill-[#DAC5A3] dark:fill-[#16334B]"
              />

              {/* Destination Acacia & Rocks */}
              <AcaciaTree x={392} y={106} scale={0.72} opacity={0.95} />
              <SavannahRocks x={136} y={138} scale={0.85} opacity={0.88} />

              {/* Discrete Savannah Grass Tufts */}
              <GrassTuft x={22} y={160} scale={0.95} />
              <GrassTuft x={122} y={146} scale={0.85} />
              <GrassTuft x={176} y={190} scale={0.95} />
              <GrassTuft x={294} y={166} scale={0.9} />
              <GrassTuft x={342} y={124} scale={0.8} />

              {/* Seamless Bottom Page Fade so terrain dissolves into #FAF6F0 / #0E1F2E */}
              <rect
                x="0"
                y="182"
                width="420"
                height="38"
                fill="url(#page-fade-bottom-light)"
                className="dark:hidden"
              />
              <rect
                x="0"
                y="182"
                width="420"
                height="38"
                fill="url(#page-fade-bottom-dark)"
                className="hidden dark:block"
              />
              {/* Soft horizontal edge dissolves on desktop split */}
              <rect
                x="0"
                y="0"
                width="420"
                height="220"
                fill="url(#page-fade-side-light)"
                className="hidden lg:block dark:lg:hidden pointer-events-none"
              />
              <rect
                x="0"
                y="0"
                width="420"
                height="220"
                fill="url(#page-fade-side-dark)"
                className="hidden dark:lg:block pointer-events-none"
              />

              {/* Organic Winding Sandy Trail */}
              <path
                d={COMPACT_PATH_D}
                fill="none"
                strokeWidth="17"
                strokeLinecap="round"
                className="stroke-[#C7AF8B] dark:stroke-[#2E5576]"
              />
              <path
                d={COMPACT_PATH_D}
                fill="none"
                strokeWidth="11.5"
                strokeLinecap="round"
                className="stroke-[#FAF3E8] dark:stroke-[#244764]"
              />
              <path
                d={COMPACT_PATH_D}
                fill="none"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeDasharray="4 6"
                className="stroke-[#BFA582]/85 dark:stroke-[#527C9E]/80"
              />

              {/* Exact Traveled Portion */}
              {compactTraveledPathD && (
                <path
                  d={compactTraveledPathD}
                  fill="none"
                  stroke="url(#savannah-trail-progress)"
                  strokeWidth="11.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Start Anchor */}
              <g transform="translate(46, 174)">
                {celebratingIdx !== null && !allReached && (
                  <motion.circle
                    r="14"
                    initial={{ scale: 0.7, opacity: 0.9 }}
                    animate={{ scale: 1.85, opacity: 0 }}
                    transition={{ duration: 0.9, ease: 'easeOut' }}
                    className="fill-[#E09F3E]/45"
                  />
                )}
                <circle
                  r="6.5"
                  className="fill-[#1A6B8A] dark:fill-[#2D8FB3] stroke-[#FAF6F0] dark:stroke-[#0E1F2E]"
                  strokeWidth="2.2"
                />
              </g>

              <text
                x="46"
                y="198"
                textAnchor="middle"
                fontSize="11"
                fontWeight="600"
                className="fill-[#5B6B79] dark:fill-[#9DB0C0] tabular-nums"
              >
                {formatEuro(prevThreshold)}
              </text>

              {/* Next Milestone Flag Landmark */}
              <g transform="translate(372, 92)">
                {celebratingIdx !== null && allReached && (
                  <motion.circle
                    r="16"
                    initial={{ scale: 0.7, opacity: 0.9 }}
                    animate={{ scale: 1.85, opacity: 0 }}
                    transition={{ duration: 0.9, ease: 'easeOut' }}
                    className="fill-[#E09F3E]/45"
                  />
                )}
                <circle
                  r="10.5"
                  className={
                    allReached
                      ? 'fill-[#E09F3E] stroke-[#FAF6F0] dark:stroke-[#0E1F2E]'
                      : 'fill-[#FAF6F0] dark:fill-[#162D42] stroke-[#E86A52]'
                  }
                  strokeWidth="2.5"
                />
                {allReached ? (
                  <path
                    d="M -3.8 0.5 L -1 3.4 L 4.2 -2.8"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : (
                  <g transform="translate(-3.5, -5.2)">
                    <line
                      x1="1"
                      y1="10.5"
                      x2="1"
                      y2="0"
                      stroke="#E86A52"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path d="M 1 0.5 L 8.5 3 L 1 5.6 Z" fill="#E86A52" />
                  </g>
                )}
              </g>

              <text
                x="372"
                y="119"
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                className="fill-[#122638] dark:fill-[#FAF6F0] tabular-nums"
              >
                {formatEuro(nextThreshold)}
              </text>

              {/* Minimalist Position Marker integrated directly on the curve */}
              <MinimalPositionMarker
                x={compactMarkerPoint.x}
                y={compactMarkerPoint.y}
              />
            </svg>
          </div>
        )}
      </div>

      {/* Mobile Next-Milestone Typographic Strip + Textual Expand Trigger (Zero Cards) */}
      {!expanded && (
        <div className="lg:hidden space-y-1.5">
          {allReached ? (
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-display text-base font-semibold text-[#122638] dark:text-[#FAF6F0] leading-snug">
                {targetMilestone.label}
              </p>
              <span className="text-xs font-semibold tabular-nums text-[#9B6B16] dark:text-[#F7C76E] shrink-0">
                100% completato
              </span>
            </div>
          ) : (
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-base font-semibold text-[#122638] dark:text-[#FAF6F0] leading-snug truncate">
                  {targetMilestone.label}
                </p>
                <p className="text-xs text-[#5B6B79] dark:text-[#9DB0C0] tabular-nums mt-0.5">
                  Soglia {formatEuro(nextThreshold)} · {segmentPercentLabel} della tappa
                </p>
              </div>

              <span className="text-sm font-semibold tabular-nums text-[#D1533C] dark:text-[#E86A52] whitespace-nowrap shrink-0">
                Mancano {formatEuro(missingToNext)}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              setExpanded(true);
              setInspectedMilestoneIndex(null);
            }}
            aria-expanded={expanded}
            aria-controls="full-journey-panel"
            className="min-h-[44px] -my-1.5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1A6B8A] dark:text-[#2D8FB3] hover:text-[#122638] dark:hover:text-[#FAF6F0] transition-colors focus:outline-none focus-visible:underline"
          >
            <span>Esplora tutto il percorso</span>
            <span className="text-xs font-medium text-[#5B6B79] dark:text-[#9DB0C0] tabular-nums">
              ({unlockedCount}/{MILESTONES.length})
            </span>
            <ChevronDown className="w-4 h-4 shrink-0" />
          </button>
        </div>
      )}

      {/* Expanded Full Journey: Continues naturally down the page with zero box */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id="full-journey-panel"
            initial={
              prefersReducedMotion ? { opacity: 1 } : { height: 0, opacity: 0 }
            }
            animate={{ height: 'auto', opacity: 1 }}
            exit={
              prefersReducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }
            }
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: 0.28, ease: [0.16, 1, 0.3, 1] }
            }
            className="overflow-hidden -mx-4 sm:-mx-6"
          >
            <div className="pt-4 pb-2 px-4 sm:px-6 bg-gradient-to-b from-[#FAF6F0] via-[#F2E5CF]/75 to-[#FAF6F0] dark:from-[#0E1F2E] dark:via-[#142D43]/80 dark:to-[#0E1F2E] space-y-4">
              {/* Quiet Editorial Section Header for Expanded Trail */}
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-[#E6DDD1] dark:border-[#264561] pt-4">
                <div>
                  <h2 className="font-display text-lg sm:text-xl font-semibold text-[#122638] dark:text-[#FAF6F0]">
                    Il cammino delle 10 tappe
                  </h2>
                  <p className="text-xs text-[#5B6B79] dark:text-[#9DB0C0]">
                    Tocca una tappa per i dettagli ·{' '}
                    <span className="font-semibold text-[#122638] dark:text-[#FAF6F0] tabular-nums">
                      {unlockedCount} su {MILESTONES.length} raggiunte
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-3 text-[11px] font-medium text-[#5B6B79] dark:text-[#9DB0C0]">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#E09F3E]" />
                    Raggiunta
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#E86A52]" />
                    Attuale
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#D5C7B6] dark:bg-[#2A4966]" />
                    Futura
                  </span>
                </div>
              </div>

              {/* Seamless 1:1 Savannah Serpentine Canvas */}
              <div
                className="relative mx-auto w-full max-w-[390px]"
                style={{
                  aspectRatio: `${EXPANDED_VIEW_W} / ${EXPANDED_VIEW_H}`,
                }}
              >
                <svg
                  viewBox={`0 0 ${EXPANDED_VIEW_W} ${EXPANDED_VIEW_H}`}
                  className="absolute inset-0 w-full h-full overflow-visible pointer-events-none select-none"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient
                      id="expanded-trail-grad"
                      gradientUnits="userSpaceOnUse"
                      x1="0"
                      y1="28"
                      x2="0"
                      y2="646"
                    >
                      <stop offset="0%" stopColor="#1A6B8A" />
                      <stop offset="52%" stopColor="#E09F3E" />
                      <stop offset="100%" stopColor="#E86A52" />
                    </linearGradient>
                  </defs>

                  {/* Varied Savannah Hills, Dunes, Rocks, Acacias & Grass */}
                  <path
                    d="M -28 122 Q 85 92 190 118 T 388 102 L 388 232 L -28 232 Z"
                    className="fill-[#EFE2CC]/55 dark:fill-[#17334B]/65"
                  />
                  <AcaciaTree x={326} y={76} scale={0.68} opacity={0.74} />
                  <GrassTuft x={36} y={136} scale={0.9} opacity={0.8} />
                  <SavannahRocks x={182} y={118} scale={0.8} opacity={0.7} />

                  <path
                    d="M -28 308 Q 115 270 235 304 T 388 284 L 388 450 L -28 450 Z"
                    className="fill-[#E7D5B8]/55 dark:fill-[#1C3D5A]/65"
                  />
                  <AcaciaTree x={38} y={304} scale={0.82} opacity={0.78} />
                  <SavannahRocks x={324} y={338} scale={0.9} opacity={0.72} />
                  <GrassTuft x={148} y={368} scale={0.95} opacity={0.78} />
                  <AcaciaTree x={328} y={444} scale={0.7} opacity={0.74} />

                  <path
                    d="M -28 540 Q 100 504 215 536 T 388 518 L 388 680 L -28 680 Z"
                    className="fill-[#DEC7A6]/50 dark:fill-[#163148]/70"
                  />
                  <circle
                    cx="286"
                    cy="646"
                    r="54"
                    className="fill-[#E09F3E]/14 dark:fill-[#E09F3E]/12"
                  />
                  <SavannahRocks x={44} y={546} scale={0.85} opacity={0.75} />
                  <AcaciaTree x={48} y={658} scale={0.82} opacity={0.8} />
                  <GrassTuft x={145} y={664} scale={1} opacity={0.82} />
                  <GrassTuft x={330} y={672} scale={0.9} opacity={0.82} />

                  {/* Neutral Future Sandy Trail */}
                  <path
                    d={EXPANDED_PATH_D}
                    fill="none"
                    strokeWidth="16"
                    strokeLinecap="round"
                    className="stroke-[#CDB795] dark:stroke-[#2E5576]"
                  />
                  <path
                    d={EXPANDED_PATH_D}
                    fill="none"
                    strokeWidth="10.5"
                    strokeLinecap="round"
                    className="stroke-[#FAF3E8] dark:stroke-[#244764]"
                  />
                  <path
                    d={EXPANDED_PATH_D}
                    fill="none"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeDasharray="4 6"
                    className="stroke-[#BFA582]/85 dark:stroke-[#527C9E]/80"
                  />

                  {/* Strictly Traveled Portion */}
                  {expandedTraveledPathD && (
                    <path
                      d={expandedTraveledPathD}
                      fill="none"
                      stroke="url(#expanded-trail-grad)"
                      strokeWidth="10.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Minimalist Position Marker on Curve */}
                  {!isMarkerNearExpandedCheckpoint && (
                    <MinimalPositionMarker
                      x={expandedMarkerPoint.x}
                      y={expandedMarkerPoint.y}
                      size="sm"
                    />
                  )}
                </svg>

                {/* Origin 0 € Node */}
                <div
                  style={{
                    left: `${(EXPANDED_START_NODE.x / EXPANDED_VIEW_W) * 100}%`,
                    top: `${(EXPANDED_START_NODE.y / EXPANDED_VIEW_H) * 100}%`,
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                >
                  <span className="w-4 h-4 rounded-full bg-[#1A6B8A] dark:bg-[#2D8FB3] border-2 border-[#FAF6F0] dark:border-[#0E1F2E] block" />
                </div>
                <span
                  style={{
                    left: `${((EXPANDED_START_NODE.x + 14) / EXPANDED_VIEW_W) * 100}%`,
                    top: `${(EXPANDED_START_NODE.y / EXPANDED_VIEW_H) * 100}%`,
                  }}
                  className="absolute -translate-y-1/2 text-[11px] font-semibold text-[#5B6B79] dark:text-[#9DB0C0] whitespace-nowrap pointer-events-none"
                >
                  Partenza · {formatEuro(0)}
                </span>

                {/* All 10 Milestones — Pure Typographic Labels directly on the landscape */}
                {MILESTONES.map((milestone, idx) => {
                  const node = EXPANDED_MILESTONE_NODES[idx];
                  const isLeftNode = node.x < EXPANDED_VIEW_W / 2;
                  const leftPct = (node.x / EXPANDED_VIEW_W) * 100;
                  const topPct = (node.y / EXPANDED_VIEW_H) * 100;

                  const unlocked = overallPct >= milestone.percent;
                  const isCurrentTarget = !allReached && idx === nextIndex;
                  const isCelebrating = celebratingIdx === idx;
                  const isRestingHere =
                    (allReached && idx === MILESTONES.length - 1) ||
                    (!allReached &&
                      nextIndex > 0 &&
                      segmentProgress <= 0.02 &&
                      idx === nextIndex - 1);
                  const isSelected = inspectedMilestoneIndex === idx;
                  const euroThreshold = (target * milestone.percent) / 100;

                  return (
                    <React.Fragment key={milestone.percent}>
                      <button
                        type="button"
                        onClick={() =>
                          setInspectedMilestoneIndex((prev) =>
                            prev === idx ? null : idx
                          )
                        }
                        aria-label={`${milestone.label}, soglia ${formatEuro(euroThreshold)}${unlocked ? ', raggiunto' : isCurrentTarget ? ', traguardo attuale' : ''}`}
                        aria-pressed={isSelected}
                        style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                        className="absolute z-10 -translate-x-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E86A52]"
                      >
                        {isCelebrating && (
                          <motion.span
                            initial={{ scale: 0.8, opacity: 0.9 }}
                            animate={{ scale: 1.7, opacity: 0 }}
                            transition={{ duration: 0.9, ease: 'easeOut' }}
                            className="absolute w-9 h-9 rounded-full bg-[#E09F3E]/50 pointer-events-none"
                          />
                        )}
                        <span
                          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border-2 transition-transform ${
                            isSelected ? 'scale-110' : 'hover:scale-105'
                          } ${
                            unlocked
                              ? `bg-[#E09F3E] border-[#FAF6F0] dark:border-[#0E1F2E] text-white ${
                                  isRestingHere
                                    ? 'ring-4 ring-[#E86A52]/40'
                                    : ''
                                }`
                              : isCurrentTarget
                                ? 'bg-[#FAF6F0] dark:bg-[#0E1F2E] border-[#E86A52] text-[#E86A52] ring-4 ring-[#E86A52]/18'
                                : 'bg-[#FAF6F0] dark:bg-[#0E1F2E] border-[#CBB493] dark:border-[#385B7B] text-[#5B6B79] dark:text-[#9DB0C0] opacity-75'
                          }`}
                        >
                          {unlocked ? (
                            <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                          ) : isCurrentTarget ? (
                            <Flag className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          ) : (
                            <span className="text-[10px] font-bold tabular-nums">
                              {idx + 1}
                            </span>
                          )}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setInspectedMilestoneIndex((prev) =>
                            prev === idx ? null : idx
                          )
                        }
                        style={
                          isLeftNode
                            ? {
                                left: '31%',
                                right: '2%',
                                top: `${topPct}%`,
                              }
                            : {
                                left: '2%',
                                right: '31%',
                                top: `${topPct}%`,
                              }
                        }
                        className={`absolute -translate-y-1/2 py-1 px-1.5 rounded-lg transition-opacity focus:outline-none focus-visible:underline ${
                          isLeftNode ? 'text-left' : 'text-right'
                        } ${
                          unlocked || isCurrentTarget || isSelected
                            ? 'opacity-100'
                            : 'opacity-65 hover:opacity-100'
                        }`}
                      >
                        <div
                          className={`flex items-baseline gap-1.5 ${
                            isLeftNode ? 'justify-start' : 'justify-end'
                          }`}
                        >
                          <span
                            className={`text-xs font-semibold truncate ${
                              unlocked
                                ? 'text-[#85580D] dark:text-[#F7C76E]'
                                : isCurrentTarget
                                  ? 'text-[#C4452E] dark:text-[#E86A52]'
                                  : 'text-[#122638] dark:text-[#FAF6F0]'
                            }`}
                          >
                            {milestone.label}
                          </span>
                        </div>
                        <div
                          className={`flex items-center gap-1.5 text-[11px] tabular-nums ${
                            isLeftNode ? 'justify-start' : 'justify-end'
                          }`}
                        >
                          <span className="font-semibold text-[#122638] dark:text-[#FAF6F0]">
                            {formatEuro(euroThreshold)}
                          </span>
                          <span aria-hidden="true" className="opacity-45">
                            ·
                          </span>
                          <span
                            className={`truncate ${
                              unlocked
                                ? 'text-[#85580D] dark:text-[#F7C76E] font-medium'
                                : isCurrentTarget
                                  ? 'text-[#1A6B8A] dark:text-[#2D8FB3] font-semibold'
                                  : 'text-[#5B6B79] dark:text-[#9DB0C0]'
                            }`}
                          >
                            {unlocked
                              ? 'Raggiunto'
                              : isCurrentTarget
                                ? `Mancano ${formatEuro(missingToNext)}`
                                : milestone.subtitle}
                          </span>
                        </div>
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Inspected Milestone Editorial Footnote (zero box) */}
              {inspectedMilestone && (
                <div className="border-t border-[#E6DDD1] dark:border-[#264561] pt-3 flex items-baseline justify-between gap-3 text-xs">
                  <p className="text-[#5B6B79] dark:text-[#9DB0C0] truncate">
                    <span className="font-semibold text-[#122638] dark:text-[#FAF6F0]">
                      {inspectedMilestone.label}
                    </span>{' '}
                    — {inspectedMilestone.subtitle}
                  </p>
                  <span
                    className={`font-semibold tabular-nums shrink-0 ${
                      inspectedUnlocked
                        ? 'text-[#85580D] dark:text-[#F7C76E]'
                        : 'text-[#C4452E] dark:text-[#E86A52]'
                    }`}
                  >
                    {inspectedUnlocked
                      ? 'Sbloccato'
                      : `Mancano ${formatEuro(inspectedMissing)}`}
                  </span>
                </div>
              )}

              {/* Subtle Editorial Collapse Action */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    setExpanded(false);
                    setInspectedMilestoneIndex(null);
                  }}
                  aria-expanded={expanded}
                  aria-controls="full-journey-panel"
                  className="min-h-[44px] inline-flex items-center gap-1.5 text-sm font-semibold text-[#1A6B8A] dark:text-[#2D8FB3] hover:text-[#122638] dark:hover:text-[#FAF6F0] transition-colors focus:outline-none focus-visible:underline"
                >
                  <span>Comprimi percorso</span>
                  <ChevronDown className="w-4 h-4 shrink-0 rotate-180" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
