export type HapticPattern = 'selection' | 'success' | 'milestone';

const HAPTIC_PATTERNS: Record<HapticPattern, number | number[]> = {
  selection: 10,
  success: [15, 45, 24],
  milestone: [20, 45, 25, 50, 42],
};

/**
 * Triggers tactile haptic feedback using the Vibration API when supported.
 * Respects reduced-motion preferences and fails silently on unsupported browsers.
 */
export function triggerHaptic(pattern: HapticPattern): void {
  try {
    if (
      typeof window === 'undefined' ||
      typeof navigator === 'undefined' ||
      typeof navigator.vibrate !== 'function'
    ) {
      return;
    }

    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    navigator.vibrate(HAPTIC_PATTERNS[pattern]);
  } catch {
    // Ignore browser/device restrictions on navigator.vibrate
  }
}
