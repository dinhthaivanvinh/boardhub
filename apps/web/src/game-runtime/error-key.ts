/** Maps a move rejection code to its i18n key: 'caro.cell_occupied' → 'games.caro.errors.cell_occupied'. */
export function errorKey(code: string): string {
  const dot = code.indexOf('.');
  if (dot < 0) return `engine.${code}`;
  const ns = code.slice(0, dot);
  const rest = code.slice(dot + 1);
  return ns === 'engine' ? `engine.${rest}` : `games.${ns}.errors.${rest}`;
}
