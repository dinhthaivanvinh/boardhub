/** Timing of a draw (docs/office/04 §6), shared by the hub and the screens. */

/** From "Spin" to the start of the build-up: time for every screen to receive the start. */
export const DRAW_START_DELAY_MS = 1200;
/** Build-up: everyone runs or spins, nobody (not even the host) knows the result yet. */
export const DRAW_BUILD_UP_MS = 3000;
/** The result leaves the server this long before the landing starts. */
export const DRAW_REVEAL_LEAD_MS = 400;
/** Landing: the animation ends exactly on the winner(s). */
export const DRAW_LANDING_MS = 3600;
