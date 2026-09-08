/**
 * Shared gesture thresholds for touch input.
 *
 * These live outside `TouchInput` because modes need the same values to
 * classify the normalized events they receive: a pointer up that arrives
 * after {@link LONG_PRESS_MS} belongs to a long press, not to a tap.
 */

/**
 * Long press detection threshold in milliseconds.
 */
export const LONG_PRESS_MS = 500;

/**
 * Maximum movement (in pixels) allowed during a long press.
 */
export const LONG_PRESS_TOLERANCE = 15;
