import type { ConfigFieldSpec } from '@bg/ui';

/** Fields shown in the setup form. Labels come from games.caro.config.<key>. */
export const configFields: ConfigFieldSpec[] = [
  { key: 'size', kind: 'select', options: [15, 19] },
  { key: 'blockedEndsRule', kind: 'boolean' },
  { key: 'exactLength', kind: 'boolean' },
];
