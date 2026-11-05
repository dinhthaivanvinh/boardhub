import type { ConfigFieldSpec } from '@bg/ui';

/** The parts of next-intl's translator this module needs. */
export interface Tr {
  (key: string, values?: Record<string, string | number>): string;
  has(key: string): boolean;
}

/** Label of one option value, e.g. caro size 19 → "19 × 19" (falls back to the raw value). */
export function configOptionLabel(t: Tr, gameId: string, key: string, value: unknown): string {
  const k = `games.${gameId}.config.${key}Options.${String(value)}`;
  return t.has(k) ? t(k) : String(value);
}

/** "Label: value" rows for the options in effect, in the order the setup form shows them. */
export function describeConfig(
  t: Tr,
  gameId: string,
  fields: readonly ConfigFieldSpec[],
  config: Record<string, unknown>,
): { key: string; label: string; value: string }[] {
  return fields.map((field) => {
    const raw = config[field.key];
    const value =
      field.kind === 'boolean'
        ? t(raw ? 'rules.on' : 'rules.off')
        : configOptionLabel(t, gameId, field.key, raw);
    return { key: field.key, label: t(`games.${gameId}.config.${field.key}`), value };
  });
}
