import { PartnerKey } from '../types';

/**
 * SALVAFRICA Design System Tokens & Motion Presets
 * Reference: Editorial travel-journal aesthetic (sand/cream light + night ocean dark, coral & teal accents).
 */

export const DS_COLORS = {
  light: {
    canvas: '#FAF6F0',
    surface: '#F2ECE3',
    border: '#E6DDD1',
    ink: '#122638',
    muted: '#5B6B79',
    goldInk: '#85580D',
  },
  dark: {
    canvas: '#0E1F2E',
    surface: '#162D42',
    surfaceHover: '#1E3952',
    border: '#264561',
    ink: '#FAF6F0',
    muted: '#9DB0C0',
    goldInk: '#F7C76E',
  },
  accents: {
    coral: '#E86A52',
    coralStrong: '#D1533C',
    teal: '#1A6B8A',
    tealLight: '#2D8FB3',
    gold: '#E09F3E',
  },
} as const;

export const DS_PARTNER_STYLES: Record<
  PartnerKey,
  {
    iconBadge: string;
    activeSegment: string;
    dot: string;
    textAccent: string;
  }
> = {
  A: {
    iconBadge:
      'bg-[#E86A52]/12 dark:bg-[#E86A52]/20 text-[#D1533C] dark:text-[#E86A52]',
    activeSegment: 'bg-[#E86A52] text-white',
    dot: 'bg-[#E86A52]',
    textAccent: 'text-[#D1533C] dark:text-[#E86A52]',
  },
  B: {
    iconBadge:
      'bg-[#1A6B8A]/12 dark:bg-[#2D8FB3]/20 text-[#1A6B8A] dark:text-[#2D8FB3]',
    activeSegment: 'bg-[#1A6B8A] text-white',
    dot: 'bg-[#1A6B8A] dark:bg-[#2D8FB3]',
    textAccent: 'text-[#1A6B8A] dark:text-[#2D8FB3]',
  },
};

export const DS_EASE = [0.16, 1, 0.3, 1] as const;

export const DS_DURATION = {
  fast: 0.15,
  normal: 0.22,
  smooth: 0.28,
} as const;

export function getSheetBackdropMotion(reducedMotion: boolean | null) {
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: reducedMotion ? 0.08 : 0.18 },
  };
}

export function getSheetPanelMotion(reducedMotion: boolean | null) {
  if (reducedMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.12 },
    };
  }
  return {
    initial: { y: '100%', opacity: 0.88 },
    animate: { y: 0, opacity: 1 },
    exit: { y: '100%', opacity: 0.88 },
    transition: { duration: DS_DURATION.normal, ease: DS_EASE },
  };
}

export function getToastMotion(reducedMotion: boolean | null) {
  if (reducedMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.12 },
    };
  }
  return {
    initial: { opacity: 0, y: -16, scale: 0.97 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -14, scale: 0.97 },
    transition: { duration: 0.2, ease: DS_EASE },
  };
}
