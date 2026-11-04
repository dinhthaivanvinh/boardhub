import type { ConfigFieldSpec } from '@bg/ui';

/** Fields shown in the setup form. Labels come from games.four-in-a-row.config.<key>. */
export const configFields: ConfigFieldSpec[] = [
  { key: 'columns', kind: 'select', options: [7, 8, 9] },
  { key: 'rows', kind: 'select', options: [6, 7] },
];
