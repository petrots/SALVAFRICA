import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Compass,
  Flag,
  Plus,
  Sparkles,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { MILESTONES, Milestone, Vault } from '../types';
import { formatEuro } from '../utils/format';

interface JourneyPathProps {
  vault: Vault;
  totalSaved: number;
  justDepositedKey: number;
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
  dx: number;
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
  const rawPoints: Array<{ segIdx: number; x: number; y: number }> = [];
  segments.forEach((seg, segIdx) => {
    for (let i = 0; i <= stepsPerSegment; i++) {
      if (segIdx > 0 && i === 0) continue;
      const pt = evalCubic(seg, i / stepsPerSegment);
      rawPoints.push({ segIdx, x: pt.x, y: pt.y });
    }
  });

  const cumLengths: number[] = [0];
  for (let i = 1; i < rawPoints.length; i++) {
    const dx = rawPoints[i].x - rawPoints[i - 1].x;
    const dy = rawPoints[i].y - rawPoints[i - 1].y;
    cumLengths.push(cumLengths[i - 1] + Math.hypot(dx, dy));
  }

  const totalLen = Math.max(1e-6, cumLengths[cumLengths.length - 1]);
  const samples: CurveSample[] = rawPoints.map((pt, i) => {
    const prev = rawPoints[Math.max(0, i - 1)];
    const next = rawPoints[Math.min(rawPoints.length - 1, i + 1)];
    return {
      s: cumLengths[i] / totalLen,
      x: pt.x,
      y: pt.y,
      dx: next.x - prev.x,
    };
  });

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

function getPointAtArcProgress(
  curve: SampledCurve,
  progress: number
): { x: number; y: number; dx: number } {
  const clamped = Math.min(1, Math.max(0, progress));
  const { samples } = curve;
  if (samples.length === 0) return { x: 0, y: 0, dx: 1 };
  if (clamped <= 0) {
    return { x: samples[0].x, y: samples[0].y, dx: samples[0].dx };
  }
  if (clamped >= 1) {
    const last = samples[samples.length - 1];
    return { x: last.x, y: last.y, dx: last.dx };
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
        dx: prev.dx + (curr.dx - prev.dx) * localT,
      };
    }
  }

  const last = samples[samples.length - 1];
  return { x: last.x, y: last.y, dx: last.dx };
}

/**
 * Generates an exact geometric SVG path string from s = 0 up to s = progress.
 * Guarantees zero stray dash/gap coloring artifacts across browsers when progress is 0 or tiny.
 */
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

// Compact Savannah Trail (viewBox 0 0 420 232)
const COMPACT_SEGMENTS: CubicSegment[] = [
  {
    p0: { x: 48, y: 192 },
    c1: { x: 118, y: 206 },
    c2: { x: 148, y: 166 },
    p1: { x: 214, y: 154 },
  },
  {
    p0: { x: 214, y: 154 },
    c1: { x: 280, y: 142 },
    c2: { x: 306, y: 114 },
    p1: { x: 364, y: 112 },
  },
];

const COMPACT_PATH_D =
  'M 48 192 C 118 206, 148 166, 214 154 C 280 142, 306 114, 364 112';

const COMPACT_CURVE = buildSampledCurve(COMPACT_SEGMENTS, 72);

// Expanded Savannah Journey (uniform 1:1 viewBox 0 0 360 692)
const EXPANDED_VIEW_W = 360;
const EXPANDED_VIEW_H = 692;
const EXPANDED_START_NODE: Point2D = { x: 180, y: 26 };
const EXPANDED_MILESTONE_NODES: Point2D[] = [
  { x: 74, y: 86 },
  { x: 286, y: 148 },
  { x: 74, y: 210 },
  { x: 286, y: 272 },
  { x: 74, y: 334 },
  { x: 286, y: 396 },
  { x: 74, y: 458 },
  { x: 286, y: 520 },
  { x: 74, y: 582 },
  { x: 286, y: 644 },
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
      ry="3.2"
      className="fill-[#B7A180]/45 dark:fill-[#0B1824]/55"
    />
    <path
      d="M -1.5 1 Q -2 -14 0 -26 M 0 -16 Q -11 -23 -15 -29 M 0 -19 Q 12 -24 16 -30"
      fill="none"
      strokeWidth="2.8"
      strokeLinecap="round"
      className="stroke-[#5D5348] dark:stroke-[#385266]"
    />
    <path
      d="M -28 -29 Q -16 -38 0 -35 Q 17 -39 27 -29 Q 15 -26 0 -27 Q -16 -26 -28 -29 Z"
      className="fill-[#5A7865] dark:fill-[#36594E]"
    />
    <path
      d="M -21 -34 Q -6 -43 12 -39 Q 22 -36 24 -32 Q 8 -31 -21 -34 Z"
      className="fill-[#6D8C77] dark:fill-[#446D5F]"
    />
  </g>
);

// Discrete savannah grass tuft
const GrassTuft: React.FC<{
  x: number;
  y: number;
  scale?: number;
  opacity?: number;
}> = ({ x, y, scale = 1, opacity = 0.85 }) => (
  <g transform={`translate(${x}, ${y}) scale(${scale})`} opacity={opacity}>
    <path
      d="M 0 0 Q -4 -7 -7 -10 M 0 0 Q 0 -9 1 -12 M 0 0 Q 5 -7 8 -9"
      fill="none"
      strokeWidth="1.7"
      strokeLinecap="round"
      className="stroke-[#6D8C77] dark:stroke-[#456D5E]"
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
      className="fill-[#CBB493] dark:fill-[#24435E]"
    />
    <path
      d="M 1 2 Q 2 -4 7 -4 Q 12 -4 13 2 Z"
      className="fill-[#B99E7B] dark:fill-[#1D374E]"
    />
  </g>
);

// Minimalist stylized 2D safari jeep SVG indicator
const SafariJeep: React.FC<{
  x: number;
  y: number;
  flipX?: boolean;
  scale?: number;
}> = ({ x, y, flipX = false, scale = 1 }) => (
  <g
    transform={`translate(${x}, ${y}) scale(${flipX ? -scale : scale}, ${scale})`}
  >
    {/* Ground shadow */}
    <ellipse
      cx="0"
      cy="4"
      rx="12.5"
      ry="2.6"
      className="fill-[#122638]/22 dark:fill-black/50"
    />
    {/* Rear spare wheel */}
    <rect
      x="-13"
      y="-5.5"
      width="3"
      height="6.5"
      rx="1.2"
      className="fill-[#122638] dark:fill-[#0B1722]"
    />
    {/* Coral 4x4 safari body */}
    <path
      d="M -10.5 1.5 L -10.5 -5.5 Q -10.5 -7.5 -8.5 -7.5 L 4.5 -7.5 L 6.6 -4 L 10.6 -3.5 Q 11.8 -3.2 11.8 -1.8 L 11.8 1.5 Z"
      className="fill-[#E86A52] stroke-[#122638] dark:stroke-[#FAF6F0]"
      strokeWidth="1.25"
      strokeLinejoin="round"
    />
    {/* Cream safari roof & roll bar */}
    <path
      d="M -8 -7.5 L -7 -12 L 3.8 -12 L 5 -7.5"
      fill="none"
      className="stroke-[#122638] dark:stroke-[#FAF6F0]"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
    <rect
      x="-8.4"
      y="-13.4"
      width="13.2"
      height="2.5"
      rx="1.1"
      className="fill-[#FAF6F0] stroke-[#122638] dark:stroke-[#FAF6F0]"
      strokeWidth="0.9"
    />
    {/* Windshield */}
    <path
      d="M -5.8 -7.8 L -5.2 -10.6 L 2.8 -10.6 L 3.8 -7.8 Z"
      className="fill-[#D7E9F0] dark:fill-[#2D8FB3]/85"
    />
    {/* Warm headlight */}
    <circle cx="11" cy="-1.2" r="1.2" className="fill-[#F7C76E]" />
    {/* Tires & hubs */}
    <circle
      cx="-6"
      cy="2"
      r="3.5"
      className="fill-[#122638] dark:fill-[#0B1722] stroke-[#FAF6F0]"
      strokeWidth="1"
    />
    <circle cx="-6" cy="2" r="1.3" className="fill-[#FAF6F0]" />
    <circle
      cx="6.8"
      cy="2"
      r="3.5"
      className="fill-[#122638] dark:fill-[#0B1722] stroke-[#FAF6F0]"
      strokeWidth="1"
    />
    <circle cx="6.8" cy="2" r="1.3" className="fill-[#FAF6F0]" />
  </g>
);

export const JourneyPath: React.FC<JourneyPathProps> = ({
  vault,
  totalSaved,
  justDepositedKey,
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

  // Brief celebratory micro-animation strictly when a new deposit unlocks a milestone
  const prevUnlockedRef = useRef(unlockedCount);
  const lastCelebratedKeyRef = useRef(justDepositedKey);
  useEffect(() => {
    if (
      justDepositedKey > lastCelebratedKeyRef.current &&
      unlockedCount > prevUnlockedRef.current &&
      !prefersReducedMotion
    ) {
      const newlyUnlocked = unlockedCount - 1;
      setCelebratingIdx(newlyUnlocked);
      lastCelebratedKeyRef.current = justDepositedKey;
      prevUnlockedRef.current = unlockedCount;
      const timer = window.setTimeout(() => {
        setCelebratingIdx(null);
      }, 1700);
      return () => window.clearTimeout(timer);
    }
    lastCelebratedKeyRef.current = justDepositedKey;
    prevUnlockedRef.current = unlockedCount;
  }, [unlockedCount, justDepositedKey, prefersReducedMotion]);

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

  // Smooth along-curve animation ONLY when savings change (never on initial mount)
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

  // Keep the safari jeep visually above checkpoint circles if resting right near one
  const expandedJeepOffset = useMemo(() => {
    const nearCheckpoint = EXPANDED_MILESTONE_NODES.some(
      (n) =>
        Math.hypot(
          expandedMarkerPoint.x - n.x,
          expandedMarkerPoint.y - n.y
        ) < 18
    );
    return {
      x: expandedMarkerPoint.x,
      y: nearCheckpoint ? expandedMarkerPoint.y - 18 : expandedMarkerPoint.y - 4,
      flipX: expandedMarkerPoint.dx < -0.25,
    };
  }, [expandedMarkerPoint]);

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
      aria-label="Percorso verso l’obiettivo"
      className="relative overflow-hidden rounded-[28px] bg-white dark:bg-[#162D42] border border-[#E6DDD1] dark:border-[#264561] shadow-sm transition-colors"
    >
      {/* Compact Blue Ocean Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#122638] via-[#17435E] to-[#1A6B8A] text-[#FAF6F0] px-4 sm:px-7 py-4 sm:py-5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -right-12 w-52 h-52 rounded-full bg-[#E86A52]/20 blur-3xl"
        />

        <div className="relative z-10 space-y-2.5">
          <div className="flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <Compass className="w-3.5 h-3.5 text-[#F7C76E] shrink-0" />
              <span className="font-display text-sm sm:text-base font-semibold text-white truncate">
                {vault.title}
              </span>
              <span
                aria-hidden="true"
                className="hidden sm:inline text-[#FAF6F0]/40"
              >
                ·
              </span>
              <span className="hidden sm:inline text-[#F7C76E] truncate">
                {vault.destination}
              </span>
            </div>

            <span className="text-[11px] font-medium text-[#FAF6F0]/75 whitespace-nowrap shrink-0">
              {vault.partnerAName} & {vault.partnerBName}
            </span>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-3xl sm:text-4xl font-semibold tabular-nums text-white tracking-tight leading-none">
                {formatEuro(safeSaved)}
              </p>
              <p className="text-xs text-[#FAF6F0]/80 tabular-nums mt-1.5">
                Obiettivo{' '}
                <span className="font-semibold text-white">
                  {formatEuro(target)}
                </span>
                <span aria-hidden="true" className="mx-1.5 text-[#FAF6F0]/40">
                  ·
                </span>
                <span className="font-semibold text-[#F7C76E]">
                  {overallPctLabel}
                </span>
                {remainingTotal === 0 && (
                  <span className="ml-1.5 text-[#F7C76E]">· Completato</span>
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={onOpenDeposit}
              className="min-h-[44px] rounded-2xl bg-[#E86A52] px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-[#D1533C] active:scale-[0.98] transition-all inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 shadow-md shadow-[#E86A52]/25"
            >
              <Plus className="w-4 h-4" />
              <span>Versa extra</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Savannah Journey Body */}
      <div className="p-3.5 sm:p-6 space-y-3">
        {/* Compact Segment View (Default) */}
        {!expanded && (
          <div className="lg:grid lg:grid-cols-12 lg:gap-6 lg:items-center space-y-3 lg:space-y-0">
            {/* Illustrated 2D Savannah Landscape Card */}
            <div className="lg:col-span-7 overflow-hidden rounded-[22px] border border-[#E6DDD1] dark:border-[#264561] bg-[#FAF6F0] dark:bg-[#0E1F2E]">
              <svg
                viewBox="0 0 420 232"
                className="w-full h-auto block select-none"
                role="img"
                aria-label={
                  allReached
                    ? `Viaggio nella savana completato: ${formatEuro(safeSaved)} su ${formatEuro(target)}`
                    : `Tratto verso ${targetMilestone.label}: avanzamento ${segmentPercentLabel}, mancano ${formatEuro(missingToNext)}`
                }
              >
                <defs>
                  <linearGradient
                    id="savannah-sky-light"
                    x1="0%"
                    y1="0%"
                    x2="0%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor="#FAF6F0" />
                    <stop offset="68%" stopColor="#F5EAD8" />
                    <stop offset="100%" stopColor="#EEDAC0" />
                  </linearGradient>
                  <linearGradient
                    id="savannah-sky-dark"
                    x1="0%"
                    y1="0%"
                    x2="0%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor="#0E1F2E" />
                    <stop offset="65%" stopColor="#142C41" />
                    <stop offset="100%" stopColor="#1B3C56" />
                  </linearGradient>

                  <linearGradient
                    id="savannah-trail-progress"
                    gradientUnits="userSpaceOnUse"
                    x1="48"
                    y1="192"
                    x2="364"
                    y2="112"
                  >
                    <stop offset="0%" stopColor="#1A6B8A" />
                    <stop offset="52%" stopColor="#E09F3E" />
                    <stop offset="100%" stopColor="#E86A52" />
                  </linearGradient>
                </defs>

                <rect
                  width="420"
                  height="232"
                  fill="url(#savannah-sky-light)"
                  className="dark:hidden"
                />
                <rect
                  width="420"
                  height="232"
                  fill="url(#savannah-sky-dark)"
                  className="hidden dark:block"
                />

                {/* Warm Savannah Sun */}
                <circle
                  cx="350"
                  cy="60"
                  r="34"
                  className="fill-[#E09F3E]/14 dark:fill-[#F7C76E]/10"
                />
                <circle
                  cx="350"
                  cy="60"
                  r="19"
                  className="fill-[#E09F3E]/40 dark:fill-[#F7C76E]/28"
                />

                {/* Far Savannah Hills & Sand Dunes */}
                <path
                  d="M 0 132 Q 68 96 148 118 Q 225 138 296 102 Q 360 76 420 108 L 420 232 L 0 232 Z"
                  className="fill-[#EBDCC5] dark:fill-[#163148]"
                />

                {/* Midground Rolling Terrain */}
                <path
                  d="M 0 156 Q 108 128 214 146 Q 318 164 420 124 L 420 232 L 0 232 Z"
                  className="fill-[#E2CEB0] dark:fill-[#193852]"
                />

                {/* Distant & Midground Acacias */}
                <AcaciaTree x={256} y={122} scale={0.58} opacity={0.78} />
                <AcaciaTree x={74} y={136} scale={0.86} opacity={0.95} />

                {/* Foreground Soft Savannah Ground */}
                <path
                  d="M 0 182 Q 130 162 246 178 Q 345 190 420 154 L 420 232 L 0 232 Z"
                  className="fill-[#D8C19F] dark:fill-[#132B3F]"
                />

                {/* Destination Acacia & Rocks */}
                <AcaciaTree x={388} y={124} scale={0.74} opacity={0.95} />
                <SavannahRocks x={136} y={154} scale={0.85} opacity={0.8} />

                {/* Discrete Savannah Grass Tufts */}
                <GrassTuft x={22} y={176} scale={0.95} />
                <GrassTuft x={122} y={162} scale={0.85} />
                <GrassTuft x={174} y={208} scale={1} />
                <GrassTuft x={294} y={182} scale={0.9} />
                <GrassTuft x={338} y={142} scale={0.8} />

                {/* Organic Winding Sandy Trail */}
                <path
                  d={COMPACT_PATH_D}
                  fill="none"
                  strokeWidth="19"
                  strokeLinecap="round"
                  className="stroke-[#C7AF8B] dark:stroke-[#23435E]"
                />
                <path
                  d={COMPACT_PATH_D}
                  fill="none"
                  strokeWidth="13"
                  strokeLinecap="round"
                  className="stroke-[#F5ECE0] dark:stroke-[#1B3750]"
                />
                <path
                  d={COMPACT_PATH_D}
                  fill="none"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeDasharray="4 6"
                  className="stroke-[#BFA582]/80 dark:stroke-[#3A6080]"
                />

                {/* Exact Traveled Portion */}
                {compactTraveledPathD && (
                  <path
                    d={compactTraveledPathD}
                    fill="none"
                    stroke="url(#savannah-trail-progress)"
                    strokeWidth="13"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Start Anchor */}
                <g transform="translate(48, 192)">
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
                    r="8"
                    className="fill-[#1A6B8A] dark:fill-[#2D8FB3] stroke-[#FAF6F0] dark:stroke-[#0E1F2E]"
                    strokeWidth="2.4"
                  />
                  <circle r="2.8" className="fill-white" />
                </g>

                <text
                  x="48"
                  y="218"
                  textAnchor="middle"
                  fontSize="11.5"
                  fontWeight="600"
                  className="fill-[#122638] dark:fill-[#FAF6F0] tabular-nums"
                >
                  {formatEuro(prevThreshold)}
                </text>

                {/* Next Milestone Flag Landmark */}
                <g transform="translate(364, 112)">
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
                    r="11"
                    className={
                      allReached
                        ? 'fill-[#E09F3E] stroke-[#FAF6F0] dark:stroke-[#0E1F2E]'
                        : 'fill-[#FAF6F0] dark:fill-[#162D42] stroke-[#E86A52]'
                    }
                    strokeWidth="2.8"
                  />
                  {allReached ? (
                    <path
                      d="M -4 0.5 L -1 3.5 L 4.5 -3"
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : (
                    <g transform="translate(-3.5, -5.5)">
                      <line
                        x1="1"
                        y1="11"
                        x2="1"
                        y2="0"
                        stroke="#E86A52"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <path d="M 1 0.5 L 9 3.2 L 1 6 Z" fill="#E86A52" />
                    </g>
                  )}
                </g>

                <text
                  x="364"
                  y="141"
                  textAnchor="middle"
                  fontSize="11.5"
                  fontWeight="700"
                  className="fill-[#122638] dark:fill-[#FAF6F0] tabular-nums"
                >
                  {formatEuro(nextThreshold)}
                </text>

                {/* Stylized Safari Jeep Indicator on the Trail */}
                <SafariJeep
                  x={
                    animatedCompactProgress > 0.94
                      ? compactMarkerPoint.x - 14
                      : compactMarkerPoint.x
                  }
                  y={compactMarkerPoint.y - 5}
                  scale={1.05}
                />
              </svg>
            </div>

            {/* Ultra-Compact Next-Milestone Strip + Expand Command */}
            <div className="lg:col-span-5 flex flex-col justify-between gap-2.5">
              {allReached ? (
                <div className="rounded-2xl bg-[#E09F3E]/12 dark:bg-[#E09F3E]/15 border border-[#E09F3E]/35 px-3.5 py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-7 h-7 rounded-full bg-[#E09F3E] text-white flex items-center justify-center shrink-0">
                      <Sparkles className="w-3.5 h-3.5" />
                    </span>
                    <p className="text-xs sm:text-sm font-semibold text-[#122638] dark:text-[#FAF6F0] truncate">
                      {targetMilestone.label} · Completato
                    </p>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-[#9B6B16] dark:text-[#F7C76E] shrink-0">
                    100%
                  </span>
                </div>
              ) : (
                <div className="rounded-2xl bg-[#FAF6F0] dark:bg-[#112436] border border-[#E6DDD1] dark:border-[#264561] px-3.5 py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-sm sm:text-base font-semibold text-[#122638] dark:text-[#FAF6F0] truncate">
                      {targetMilestone.label}
                    </p>
                    <p className="text-[11px] font-medium text-[#5B6B79] dark:text-[#9DB0C0] tabular-nums">
                      {segmentPercentLabel} della tappa
                    </p>
                  </div>

                  <span className="text-xs sm:text-sm font-semibold tabular-nums text-[#D1533C] dark:text-[#E86A52] whitespace-nowrap shrink-0">
                    Mancano {formatEuro(missingToNext)}
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setExpanded(true);
                  setInspectedMilestoneIndex(null);
                }}
                aria-expanded={expanded}
                aria-controls="full-journey-panel"
                className="w-full min-h-[44px] rounded-2xl bg-[#F2ECE3] dark:bg-[#1E3952] hover:bg-[#E6DDD1] dark:hover:bg-[#264561] text-[#122638] dark:text-[#FAF6F0] px-4 py-2 text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A6B8A]/50"
              >
                <span>Esplora tutto il percorso</span>
                <span className="text-[#5B6B79] dark:text-[#9DB0C0] font-medium tabular-nums">
                  ({unlockedCount}/{MILESTONES.length})
                </span>
                <ChevronDown className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </div>
        )}

        {/* Expanded View: Complete Evolving Savannah Journey across all 10 milestones */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              id="full-journey-panel"
              initial={
                prefersReducedMotion
                  ? { opacity: 1 }
                  : { height: 0, opacity: 0 }
              }
              animate={{ height: 'auto', opacity: 1 }}
              exit={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { height: 0, opacity: 0 }
              }
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 0.28, ease: [0.16, 1, 0.3, 1] }
              }
              className="overflow-hidden space-y-3"
            >
              <div className="relative overflow-hidden rounded-[22px] border border-[#E6DDD1] dark:border-[#264561] bg-[#FAF6F0] dark:bg-[#0E1F2E]">
                {/* Header inside Expanded Canvas */}
                <div className="relative z-20 px-4 sm:px-6 pt-3.5 pb-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-[#E6DDD1]/75 dark:border-[#264561]/75 bg-[#FAF6F0]/90 dark:bg-[#0E1F2E]/90 backdrop-blur-xs">
                  <div>
                    <h2 className="font-display text-base sm:text-lg font-semibold text-[#122638] dark:text-[#FAF6F0]">
                      Il cammino verso {formatEuro(target)}
                    </h2>
                    <p className="text-xs text-[#5B6B79] dark:text-[#9DB0C0]">
                      Tocca una tappa per i dettagli ·{' '}
                      <span className="font-semibold text-[#122638] dark:text-[#FAF6F0] tabular-nums">
                        {unlockedCount} / {MILESTONES.length} raggiunte
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] font-medium text-[#5B6B79] dark:text-[#9DB0C0]">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#E09F3E]" />
                      Raggiunta
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#E86A52]" />
                      Attuale
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#D5C7B6] dark:bg-[#2A4966]" />
                      Futura
                    </span>
                  </div>
                </div>

                {/* Unified Aspect-Preserving Savannah Canvas (Zero Path/Text Distortion) */}
                <div className="relative px-2 sm:px-6 py-4 bg-gradient-to-b from-[#FAF6F0] via-[#F3E6D1] to-[#ECD7BA] dark:from-[#0E1F2E] dark:via-[#132A3E] dark:to-[#183650]">
                  <div
                    className="relative mx-auto w-full max-w-[390px]"
                    style={{
                      aspectRatio: `${EXPANDED_VIEW_W} / ${EXPANDED_VIEW_H}`,
                    }}
                  >
                    {/* Single Uniform 1:1 SVG: Evolving Savannah Scenery + Exact Path + Jeep */}
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
                          y1="26"
                          x2="0"
                          y2="644"
                        >
                          <stop offset="0%" stopColor="#1A6B8A" />
                          <stop offset="52%" stopColor="#E09F3E" />
                          <stop offset="100%" stopColor="#E86A52" />
                        </linearGradient>
                      </defs>

                      {/* Varied Evolving Savannah Hills, Dunes, Rocks, Acacias & Grass */}
                      {/* Zone 1: Morning dunes */}
                      <path
                        d="M -20 120 Q 85 90 190 116 T 380 100 L 380 230 L -20 230 Z"
                        className="fill-[#EFE2CC]/65 dark:fill-[#163046]/60"
                      />
                      <AcaciaTree x={326} y={76} scale={0.68} opacity={0.55} />
                      <GrassTuft x={36} y={136} scale={0.9} opacity={0.65} />
                      <SavannahRocks x={182} y={118} scale={0.8} opacity={0.5} />

                      {/* Zone 2: Rolling savannah ridges */}
                      <path
                        d="M -20 305 Q 115 268 235 302 T 380 282 L 380 450 L -20 450 Z"
                        className="fill-[#E7D5B8]/65 dark:fill-[#18354E]/60"
                      />
                      <AcaciaTree x={38} y={302} scale={0.82} opacity={0.6} />
                      <SavannahRocks x={324} y={336} scale={0.9} opacity={0.6} />
                      <GrassTuft x={148} y={366} scale={0.95} opacity={0.6} />
                      <AcaciaTree x={328} y={442} scale={0.7} opacity={0.55} />

                      {/* Zone 3: Ochre ridge & sunset horizon */}
                      <path
                        d="M -20 538 Q 100 502 215 534 T 380 516 L 380 710 L -20 710 Z"
                        className="fill-[#DEC7A6]/70 dark:fill-[#13293C]/75"
                      />
                      <circle
                        cx="286"
                        cy="644"
                        r="56"
                        className="fill-[#E09F3E]/16 dark:fill-[#E09F3E]/12"
                      />
                      <SavannahRocks x={44} y={544} scale={0.85} opacity={0.65} />
                      <AcaciaTree x={48} y={656} scale={0.82} opacity={0.68} />
                      <GrassTuft x={145} y={662} scale={1} opacity={0.7} />
                      <GrassTuft x={330} y={672} scale={0.9} opacity={0.7} />

                      {/* Neutral Future Sandy Trail */}
                      <path
                        d={EXPANDED_PATH_D}
                        fill="none"
                        strokeWidth="17"
                        strokeLinecap="round"
                        className="stroke-[#CDB795] dark:stroke-[#23435E]"
                      />
                      <path
                        d={EXPANDED_PATH_D}
                        fill="none"
                        strokeWidth="11.5"
                        strokeLinecap="round"
                        className="stroke-[#F5ECE0] dark:stroke-[#1B3750]"
                      />
                      <path
                        d={EXPANDED_PATH_D}
                        fill="none"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeDasharray="4 6"
                        className="stroke-[#BFA582]/85 dark:stroke-[#3A6080]"
                      />

                      {/* ONLY the genuinely traveled portion is colored */}
                      {expandedTraveledPathD && (
                        <path
                          d={expandedTraveledPathD}
                          fill="none"
                          stroke="url(#expanded-trail-grad)"
                          strokeWidth="11.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}

                      {/* Safari Jeep Position Indicator along the Exact Curve */}
                      <SafariJeep
                        x={expandedJeepOffset.x}
                        y={expandedJeepOffset.y}
                        flipX={expandedJeepOffset.flipX}
                        scale={0.95}
                      />
                    </svg>

                    {/* Origin 0 € Node */}
                    <div
                      style={{
                        left: `${(EXPANDED_START_NODE.x / EXPANDED_VIEW_W) * 100}%`,
                        top: `${(EXPANDED_START_NODE.y / EXPANDED_VIEW_H) * 100}%`,
                      }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    >
                      <span className="w-5 h-5 rounded-full bg-[#1A6B8A] dark:bg-[#2D8FB3] border-2 border-white dark:border-[#0E1F2E] shadow-xs flex items-center justify-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      </span>
                    </div>
                    <span
                      style={{
                        left: `${((EXPANDED_START_NODE.x + 16) / EXPANDED_VIEW_W) * 100}%`,
                        top: `${(EXPANDED_START_NODE.y / EXPANDED_VIEW_H) * 100}%`,
                      }}
                      className="absolute -translate-y-1/2 text-[11px] font-semibold text-[#5B6B79] dark:text-[#9DB0C0] whitespace-nowrap pointer-events-none"
                    >
                      Partenza · {formatEuro(0)}
                    </span>

                    {/* All 10 Real Milestones with Non-Overlapping Label Corridors */}
                    {MILESTONES.map((milestone, idx) => {
                      const node = EXPANDED_MILESTONE_NODES[idx];
                      const isLeftNode = node.x < EXPANDED_VIEW_W / 2;
                      const leftPct = (node.x / EXPANDED_VIEW_W) * 100;
                      const topPct = (node.y / EXPANDED_VIEW_H) * 100;

                      const unlocked = overallPct >= milestone.percent;
                      const isCurrentTarget = !allReached && idx === nextIndex;
                      const isCelebrating = celebratingIdx === idx;
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
                                  ? 'bg-[#E09F3E] border-white dark:border-[#0E1F2E] text-white shadow-sm'
                                  : isCurrentTarget
                                    ? 'bg-white dark:bg-[#162D42] border-[#E86A52] text-[#E86A52] shadow-sm ring-4 ring-[#E86A52]/18'
                                    : 'bg-white/90 dark:bg-[#162D42]/90 border-[#D5C7B6] dark:border-[#385B7B] text-[#5B6B79] dark:text-[#9DB0C0] opacity-75'
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
                            className={`absolute -translate-y-1/2 py-1 px-2 rounded-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A6B8A] ${
                              isLeftNode ? 'text-left' : 'text-right'
                            } ${
                              isSelected
                                ? 'bg-white/95 dark:bg-[#162D42] ring-1 ring-[#1A6B8A]/45 shadow-xs'
                                : isCurrentTarget
                                  ? 'bg-white/90 dark:bg-[#162D42]/90 shadow-xs'
                                  : unlocked
                                    ? 'bg-white/70 dark:bg-[#162D42]/70 hover:bg-white/90 dark:hover:bg-[#162D42]/90'
                                    : 'opacity-70 hover:opacity-100 hover:bg-white/55 dark:hover:bg-[#162D42]/55'
                            }`}
                          >
                            <div
                              className={`flex items-baseline gap-1.5 ${
                                isLeftNode ? 'justify-start' : 'justify-end'
                              }`}
                            >
                              <span
                                className={`text-[11px] sm:text-xs font-semibold truncate ${
                                  unlocked
                                    ? 'text-[#9B6B16] dark:text-[#F7C76E]'
                                    : isCurrentTarget
                                      ? 'text-[#D1533C] dark:text-[#E86A52]'
                                      : 'text-[#122638] dark:text-[#FAF6F0]'
                                }`}
                              >
                                {milestone.label}
                              </span>
                            </div>
                            <div
                              className={`flex items-center gap-1.5 text-[10.5px] sm:text-[11px] tabular-nums ${
                                isLeftNode ? 'justify-start' : 'justify-end'
                              }`}
                            >
                              <span className="font-semibold text-[#122638] dark:text-[#FAF6F0]">
                                {formatEuro(euroThreshold)}
                              </span>
                              <span
                                aria-hidden="true"
                                className="text-[#5B6B79]/50"
                              >
                                ·
                              </span>
                              <span
                                className={`truncate ${
                                  unlocked
                                    ? 'text-[#9B6B16] dark:text-[#F7C76E] font-medium'
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

                  {/* Inspected Milestone Detail Strip */}
                  {inspectedMilestone && (
                    <div className="mt-3 rounded-2xl bg-white/95 dark:bg-[#162D42]/95 border border-[#E6DDD1] dark:border-[#264561] px-4 py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#1A6B8A] dark:text-[#2D8FB3]">
                          {inspectedMilestone.label} ·{' '}
                          {formatEuro(inspectedThreshold)}
                        </p>
                        <p className="text-xs text-[#5B6B79] dark:text-[#9DB0C0] truncate">
                          {inspectedMilestone.subtitle}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-semibold tabular-nums shrink-0 ${
                          inspectedUnlocked
                            ? 'text-[#9B6B16] dark:text-[#F7C76E]'
                            : 'text-[#D1533C] dark:text-[#E86A52]'
                        }`}
                      >
                        {inspectedUnlocked
                          ? 'Tappa sbloccata'
                          : `Mancano ${formatEuro(inspectedMissing)}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setExpanded(false);
                  setInspectedMilestoneIndex(null);
                }}
                aria-expanded={expanded}
                aria-controls="full-journey-panel"
                className="w-full min-h-[44px] rounded-2xl bg-[#F2ECE3] dark:bg-[#1E3952] hover:bg-[#E6DDD1] dark:hover:bg-[#264561] text-[#122638] dark:text-[#FAF6F0] px-4 py-2 text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A6B8A]/50"
              >
                <span>Torna alla vista compatta</span>
                <ChevronDown className="w-4 h-4 shrink-0 rotate-180" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};
