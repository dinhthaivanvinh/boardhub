// Namespaces of protocol errors (docs/05 §6); their messages live under errors.* in the app's i18n.
const PROTOCOL_NAMESPACES = new Set([
  'room',
  'match',
  'auth',
  'rate',
  'invalid',
  'game',
  'protocol',
  'queue',
  'office',
  'admin',
  'chat',
  'report',
  'user',
]);

/**
 * Maps an error code to its i18n key:
 * 'engine.x' → 'engine.x', 'room.full' → 'errors.room.full', 'network' → 'errors.network',
 * 'caro.cell_occupied' → 'games.caro.errors.cell_occupied'.
 */
export function errorKey(code: string): string {
  const dot = code.indexOf('.');
  if (dot < 0) return `errors.${code}`;
  const ns = code.slice(0, dot);
  const rest = code.slice(dot + 1);
  if (ns === 'engine') return `engine.${rest}`;
  if (PROTOCOL_NAMESPACES.has(ns)) return `errors.${code}`;
  return `games.${ns}.errors.${rest}`;
}
