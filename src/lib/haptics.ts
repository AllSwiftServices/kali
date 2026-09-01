/**
 * Lightweight tactile feedback for key taps (tab switches, confirming a
 * trade, quick actions). Backed by the Vibration API, which only exists on
 * Android/Chromium — iOS Safari has no equivalent, so this silently no-ops
 * there rather than throwing.
 */
type HapticStyle = "light" | "medium" | "success" | "warning";

const PATTERNS: Record<HapticStyle, number | number[]> = {
  light: 8,
  medium: 15,
  success: [10, 40, 10],
  warning: [15, 60, 15, 60, 15],
};

export function haptic(style: HapticStyle = "light") {
  if (typeof window === "undefined") return;
  try {
    window.navigator.vibrate?.(PATTERNS[style]);
  } catch {
    // Vibration API not supported — ignore.
  }
}
