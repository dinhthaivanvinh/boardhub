import type { ConfigFieldSpec } from '@bg/ui';

/** Fields shown in the setup form. Labels come from games.reversi.config.<key>. */
export const configFields: ConfigFieldSpec[] = [{ key: 'size', kind: 'select', options: [8, 6, 10] }];
