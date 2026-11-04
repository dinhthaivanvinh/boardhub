# Templates cho game mới

Thay `<id>` bằng game id, `<Name>` bằng PascalCase (ví dụ `FourInARow`).

## package.json

```json
{
  "name": "@bg/game-<id>",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./rules": "./src/rules/definition.ts",
    "./ui": "./src/ui/Board.tsx",
    "./bot": "./src/bot/index.ts",
    "./i18n/*": "./src/i18n/*",
    "./theme.css": "./src/ui/theme.css"
  },
  "scripts": {
    "typecheck": "tsc -p .",
    "test": "vitest run --coverage"
  },
  "dependencies": {
    "@bg/engine": "workspace:*",
    "@bg/ui": "workspace:*",
    "@bg/bots": "workspace:*",
    "zod": "catalog:"
  },
  "peerDependencies": { "react": "catalog:" }
}
```

`./rules` được export riêng để server import luật mà không kéo theo React.

## src/rules/types.ts

```ts
import type { Seat } from '@bg/engine';
import type { <Name>Config } from './config';

export type <Name>Move = { cell: number };

export type <Name>State = {
  config: <Name>Config;
  board: (Seat | null)[];
  turn: Seat;
  moveCount: number;
  lastMove: number | null;
};
```

## src/rules/config.ts

```ts
import { z } from 'zod';

export const configSchema = z.object({
  size: z.union([z.literal(7), z.literal(9)]).default(7),
}).strict();

export type <Name>Config = z.infer<typeof configSchema>;
```

## src/rules/moves.ts

```ts
import { z } from 'zod';
import type { MoveCheck, Seat } from '@bg/engine';
import type { <Name>Move, <Name>State } from './types';

export const moveSchema = z.object({ cell: z.number().int() }).strict();

export function validateMove(s: <Name>State, _seat: Seat, m: <Name>Move): MoveCheck {
  if (m.cell < 0 || m.cell >= s.board.length) return { ok: false, code: '<id>.out_of_bounds' };
  if (s.board[m.cell] !== null) return { ok: false, code: '<id>.cell_occupied' };
  return { ok: true };
}

export function applyMove(s: <Name>State, seat: Seat, m: <Name>Move): <Name>State {
  const board = s.board.slice();
  board[m.cell] = seat;
  return { ...s, board, turn: (1 - seat) as Seat, moveCount: s.moveCount + 1, lastMove: m.cell };
}

export function legalMoves(s: <Name>State, _seat: Seat): <Name>Move[] {
  const out: <Name>Move[] = [];
  s.board.forEach((v, cell) => { if (v === null) out.push({ cell }); });
  return out;
}
```

## src/rules/definition.ts

```ts
import type { GameDefinition } from '@bg/engine';
import { configSchema, type <Name>Config } from './config';
import { moveSchema, validateMove, applyMove, legalMoves } from './moves';
import { setup } from './setup';
import { result } from './result';
import type { <Name>Move, <Name>State } from './types';

export const definition: GameDefinition<<Name>State, <Name>Move, <Name>Config> = {
  meta: {
    id: '<id>',
    rulesVersion: 1,
    minPlayers: 2,
    maxPlayers: 2,
    tags: ['perfect-info'],
    estimatedMinutes: 10,
    i18nKey: 'games.<id>',
  },
  configSchema,
  moveSchema,
  setup,
  activePlayers: (s) => (result(s) ? [] : [s.turn]),
  validateMove,
  applyMove,
  legalMoves,
  result,
  playerView: (s) => s,   // perfect-info
};
```

## src/index.ts

```ts
export { definition } from './rules/definition';
export type * from './rules/types';
export { Board, PieceIcon } from './ui/Board';
export { bot } from './bot';
export { default as vi } from './i18n/vi.json';
export { default as en } from './i18n/en.json';
```

## test/properties.test.ts

```ts
import { describe, it } from 'vitest';
import {
  randomPlayout,
  assertLegalMovesConsistent,
  assertSerializable,
  assertDeterministic,
  assertNoMutation,
} from '@bg/engine/testing';
import { definition } from '../src/rules/definition';

const config = definition.configSchema.parse({});

describe('<id> invariants', () => {
  it('random playouts terminate with a result', () => {
    for (let seed = 0; seed < 200; seed++)
      randomPlayout(definition, config, String(seed), 10_000, {
        eachStep: (state) => {
          assertLegalMovesConsistent(definition, state);
          assertSerializable(state);
        },
      });
  });
  it('is deterministic', () => assertDeterministic(definition, config, 50));
  it('applyMove does not mutate input', () => assertNoMutation(definition, config, 50));
});
```
