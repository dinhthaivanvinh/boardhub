import en from '../i18n/en.json';
import vi from '../i18n/vi.json';
import { fromFen, squareName } from '../rules/board';
import { DRAW_QUIZ, JUDGE_ROUNDS, PLACE_ROUNDS, SETUP_QUIZ } from './basics';
import { PIECE_VALUE, VALUE_ROUNDS } from './capture';
import { MATE_ROUNDS, matingMoves } from './checkmate';
import { coordRounds, COORD_KINDS, fileOf, rankOf } from './coordinates';
import { OPENING_LESSONS, PIECE_LESSONS, SPECIAL_LESSONS } from './data';
import { parseMove, positionsOf } from './logic';
import { PRACTICE_LESSON_IDS, practiceRounds, STARS_PER_PRACTICE } from './practice';
import { spellSquares } from './speech';
import { LADDER_ROUNDS } from './tactics';
import { voiceKey } from './voice-hash';

type Messages = typeof vi;
const MESSAGES: Record<'vi' | 'en', Messages> = { vi, en: en as unknown as Messages };

/**
 * Every sentence a lesson can say aloud, for one language. The pre-recorded voice is made from this list, and a
 * test checks that what the lessons really say is a part of it: a sentence missing here is read by the browser's
 * own voice instead (or not at all), so keep it in step with the lessons.
 */
export function speechTexts(lang: 'vi' | 'en'): string[] {
  const m = MESSAGES[lang];
  const out = new Set<string>();

  const get = (root: unknown, path: string): unknown =>
    path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], root);
  /** A text of `learn.*`, with its {placeholders} filled in; a placeholder left unfilled is a bug in this list. */
  const say = (path: string, values: Record<string, string | number> = {}) => {
    const raw = get(m.learn, path);
    if (typeof raw !== 'string') throw new Error(`speech text missing: learn.${path}`);
    const text = raw.replace(/\{(\w+)\}/g, (_, k: string) => {
      if (!(k in values)) throw new Error(`speech text learn.${path} needs {${k}}`);
      return String(values[k]);
    });
    out.add(text);
    return text;
  };
  const pieceName = (type: string) => String(get(m, `pieceNames.${type}`));

  // ---- pieces
  for (const l of PIECE_LESSONS) {
    for (const k of ['meet', 'move', 'try', 'challenge', 'fun']) say(`pieces.${l.id}.${k}`);
    say('pieceDone', { piece: pieceName(l.piece) });
  }
  for (const k of ['tryDone', 'tryWrong', 'challengeWon', 'challengeNotGoal', 'challengeIllegal']) say(k);

  // ---- special moves
  for (const l of SPECIAL_LESSONS) {
    for (const k of ['meet', 'move', 'try', 'fun']) say(`specials.${l.id}.${k}`);
    say('specialDone', { name: String(get(m.learn, `specials.${l.id}.name`)) });
  }

  // ---- openings: the idea of every move, the hint for each move of the child, and the feedback
  for (const l of OPENING_LESSONS) {
    const positions = positionsOf(l);
    l.moves.forEach((text, i) => {
      say(`openings.${l.id}.s${i}`);
      if (positions[i]!.turn === l.side) {
        const move = parseMove(text);
        say('hintFrom', { square: squareName(move.from) });
        say('hintTo', { from: squareName(move.from), square: squareName(move.to) });
      }
    });
    const done = say('openingDone');
    out.add(`${done} ${say(`openings.${l.id}.s${l.moves.length - 1}`)}`);
  }
  say('wrongMove');
  say('rightMove');

  // ---- coordinates
  say('coordinates.meet');
  for (const kind of COORD_KINDS) {
    for (const round of coordRounds(kind)) {
      say(`coordinates.prompt.${kind}`, {
        square: squareName(round.square),
        rank: rankOf(round.square),
        file: fileOf(round.square),
      });
    }
    say(`coordinates.wrong.${kind}`, { square: '', rank: '', file: '' });
  }
  for (const k of ['right', 'allDone', 'done', 'fun']) say(`coordinates.${k}`);

  // ---- capture
  say('capture.meet');
  for (const k of ['take', 'attacked', 'safe', 'value']) say(`capture.prompt.${k}`);
  for (const k of [
    'take.illegal',
    'take.notCapture',
    'take.right',
    'take.hint',
    'attacked.wrong',
    'attacked.right',
    'attacked.hint',
    'safe.rightFree',
    'safe.rightGuarded',
    'safe.wrongFree',
    'safe.wrongGuarded',
    'value.wrong',
    'allDone',
    'done',
    'fun',
  ]) {
    say(`capture.${k}`);
  }
  for (const { left, right } of VALUE_ROUNDS) {
    const big = PIECE_VALUE[left] > PIECE_VALUE[right] ? left : right;
    const small = big === left ? right : left;
    say('capture.value.right', {
      big: pieceName(big),
      bigPoints: PIECE_VALUE[big],
      small: pieceName(small),
      smallPoints: PIECE_VALUE[small],
    });
  }

  // ---- checkmate
  say('checkmate.meet');
  for (const k of ['check', 'judge', 'mate', 'escape.run', 'escape.block', 'escape.capture'])
    say(`checkmate.prompt.${k}`);
  for (const k of [
    'right',
    'wrong.check',
    'escape.illegal',
    'judge.rightSave',
    'judge.rightMate',
    'judge.wrong',
    'mate.right',
    'mate.escaped',
    'mate.stalemate',
    'mate.noCheck',
    'mate.defended',
    'mate.illegal',
    'allDone',
    'done',
    'fun',
  ]) {
    say(`checkmate.${k}`);
  }
  const kinds = ['run', 'block', 'capture'];
  for (const did of kinds) {
    for (const asked of kinds) {
      if (did === asked) continue;
      say('checkmate.escape.other', {
        did: String(get(m.learn, `checkmate.kind.${did}`)),
        asked: String(get(m.learn, `checkmate.kind.${asked}`)),
      });
    }
  }
  for (const { fen } of MATE_ROUNDS) mateHints(fen, (k, v) => say(`checkmate.${k}`, v));

  // ---- tactics
  say('tactics.meet');
  for (const k of ['fork', 'pin', 'mate', 'draw']) say(`tactics.prompt.${k}`);
  for (const k of [
    'fork.illegal',
    'fork.notFork',
    'fork.right',
    'fork.hint',
    'pin.right',
    'pin.wrong',
    'pin.hint',
    'mate.right',
    'mate.escaped',
    'mate.stalemate',
    'mate.noCheck',
    'mate.defended',
    'mate.illegal',
    'draw.right.mate',
    'draw.right.stalemate',
    'draw.right.ongoing',
    'draw.wrong',
    'allDone',
    'done',
    'fun',
  ]) {
    say(`tactics.${k}`);
  }
  for (const { fen } of LADDER_ROUNDS) mateHints(fen, (k, v) => say(`tactics.${k}`, v));

  // ---- setup and draws: the idea, every question with its answers, and the results
  for (const lesson of ['setup', 'draws']) {
    say(`${lesson}.meet`);
    for (const k of ['allDone', 'done', 'fun']) say(`${lesson}.${k}`);
  }
  for (const r of PLACE_ROUNDS) {
    say('setup.prompt.place', { square: r.square });
    say('setup.place.right', {
      square: r.square,
      piece: pieceName(r.piece).toLowerCase(),
      color: String(get(m.learn, `setup.color.${r.color}`)),
    });
  }
  say('setup.place.wrong');
  for (const q of SETUP_QUIZ) for (const k of ['q', 'right', 'wrong']) say(`setup.quiz.${q.id}.${k}`);
  for (const side of ['w', 'b'])
    say('draws.prompt.judge', { side: String(get(m.learn, `draws.side.${side}`)) });
  say('draws.judge.wrong');
  for (const r of JUDGE_ROUNDS) say(`draws.judge.${r.id}.right`);
  for (const q of DRAW_QUIZ) for (const k of ['q', 'right', 'wrong']) say(`draws.quiz.${q.id}.${k}`);

  // ---- the "start the challenge" line of a piece or special lesson names the square to reach
  for (const l of PIECE_LESSONS) say('challengeStart', { square: l.challenge.goal });
  for (const l of SPECIAL_LESSONS) say('challengeStart', { square: l.challenge.to });

  // ---- practice: the questions, the answers, and the hints that name the squares of each round
  for (const k of [
    'prompt.star',
    'prompt.opening',
    'star.right',
    'star.wrong',
    'move.right',
    'move.illegal',
    'move.notGoal',
    'allDone',
  ]) {
    say(`practice.${k}`);
  }
  say('practice.done', { stars: STARS_PER_PRACTICE });
  for (const id of PRACTICE_LESSON_IDS) {
    for (const round of practiceRounds(id)!) {
      if (round.kind === 'star') {
        say('practice.star.hint', { from: round.answer });
        continue;
      }
      say('practice.move.hint1', { from: round.from });
      say('practice.move.hint2', { from: round.from, to: round.to });
      const p = round.prompt;
      if (p.key === 'capture') say('practice.prompt.capture', { piece: pieceName(p.piece) });
      else if (p.key !== 'opening') say(`practice.prompt.${p.key}`, { to: p.to });
    }
  }

  return [...out];
}

/** The two hints of a mate round name the squares of the first mating move. */
function mateHints(fen: string, add: (key: string, values: Record<string, string>) => void) {
  const mate = matingMoves(fromFen(fen))[0]!;
  add('mate.hint1', { from: squareName(mate.from) });
  add('mate.hint2', { from: squareName(mate.from), to: squareName(mate.to) });
}

/** What the voice is given to say: "e4" is spelled as letter and number (see `spellSquares`). */
export const spokenForm = (text: string, lang: 'vi' | 'en') => spellSquares(text, lang);

/** The sentences with the name of their sound file: one entry per distinct thing said. */
export function speechEntries(lang: 'vi' | 'en'): { text: string; spoken: string; key: string }[] {
  const seen = new Map<string, { text: string; spoken: string; key: string }>();
  for (const text of speechTexts(lang)) {
    const spoken = spokenForm(text, lang);
    seen.set(spoken, { text, spoken, key: voiceKey(spoken) });
  }
  return [...seen.values()];
}
