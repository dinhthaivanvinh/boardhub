import { describe, expect, it } from 'vitest';
import { fromFen, perft, START_FEN } from '../src/rules/board';

// Reference counts from the Chess Programming Wiki "Perft Results" page.
const KIWIPETE = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -';
const POSITION_3 = '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - -';
const POSITION_4 = 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq -';
const POSITION_5 = 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ -';

describe('perft: every legal move sequence is counted exactly', () => {
  it.each([
    ['start', START_FEN, [20, 400, 8902]],
    ['kiwipete (castling, en passant, promotions)', KIWIPETE, [48, 2039]],
    ['position 3 (en passant pins, checks)', POSITION_3, [14, 191, 2812, 43238]],
    ['position 4 (promotions, castling through check)', POSITION_4, [6, 264, 9467]],
    ['position 5', POSITION_5, [44, 1486]],
  ] as const)(
    '%s',
    (_name, fen, counts) => {
      const pos = fromFen(fen);
      counts.forEach((n, i) => expect(perft(pos, i + 1)).toBe(n));
    },
    60_000,
  );
});
