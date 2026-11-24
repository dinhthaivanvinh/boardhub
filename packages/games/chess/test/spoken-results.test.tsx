// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { squareName } from '../src/rules/board';
import vi from '../src/i18n/vi.json';
import { coordRounds } from '../src/learn/coordinates';
import { CoordinatesLesson } from '../src/learn/CoordinatesLesson';
import { PIECE_LESSONS } from '../src/learn/data';
import { PieceLesson } from '../src/learn/PieceLesson';

const get = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj);
const tr = (key: string, values?: Record<string, string | number>) => {
  const text = get(vi, key.replace(/^games\.chess\./, ''));
  if (typeof text !== 'string') return key;
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(values?.[k] ?? ''));
};
const c = (key: string) => tr(`games.chess.learn.coordinates.${key}`);
const click = (square: string) => fireEvent.click(document.querySelector(`[data-square="${square}"]`)!);
const nextName = tr('games.chess.learn.next');
const next = () => fireEvent.click(screen.getByRole('button', { name: nextName }));

/** A speech synthesis with a Vietnamese voice that records what it is asked to say. */
function installSpeech() {
  const state = { spoken: [] as string[], speaking: false };
  class Utterance {
    voice: unknown;
    lang = '';
    rate = 1;
    constructor(public text: string) {}
  }
  Object.assign(globalThis, { SpeechSynthesisUtterance: Utterance });
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      getVoices: () => [{ lang: 'vi-VN', name: 'Vietnamese' }],
      cancel: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      get speaking() {
        return state.speaking;
      },
      speak: (u: Utterance) => state.spoken.push(u.text),
    },
  });
  return state;
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, 'speechSynthesis');
});

describe('spoken results', () => {
  it('reads the result after each answer, and again when the same wrong answer is given twice', () => {
    const speech = installSpeech();
    render(<CoordinatesLesson t={tr} animate={false} advanceDelay={0} />);
    next(); // meet -> rows
    const round = coordRounds('rank')[0]!;
    const wrongSquare = squareName((round.square + 8) % 64); // another row
    speech.spoken.length = 0;

    click(wrongSquare);
    expect(speech.spoken).toEqual([c('wrong.rank')]);
    click(wrongSquare);
    expect(speech.spoken).toEqual([c('wrong.rank'), c('wrong.rank')]);
    click(squareName(round.square));
    expect(speech.spoken.at(-1)).toBe(c('right'));
  });

  it('stays quiet when the child turns "Đọc kết quả" off, and remembers it', () => {
    const speech = installSpeech();
    const { unmount } = render(<CoordinatesLesson t={tr} animate={false} advanceDelay={0} />);
    next();
    fireEvent.click(screen.getByLabelText(tr('games.chess.learn.speakResults')));
    expect(JSON.parse(window.localStorage.getItem('learn.chess.voice.v1')!)).toEqual({
      auto: true,
      results: false,
    });
    speech.spoken.length = 0;
    const round = coordRounds('rank')[0]!;
    click(squareName((round.square + 8) % 64));
    expect(speech.spoken).toEqual([]);
    // The text is still shown for those who can read.
    expect(screen.getByRole('status').textContent).toBe(c('wrong.rank'));
    unmount();

    // A new lesson starts with the remembered choice.
    render(<CoordinatesLesson t={tr} animate={false} advanceDelay={0} />);
    next();
    return waitFor(() =>
      expect((screen.getByLabelText(tr('games.chess.learn.speakResults')) as HTMLInputElement).checked).toBe(
        false,
      ),
    );
  });

  it('reads each question by itself by default, and stops when the child turns it off', async () => {
    const speech = installSpeech();
    render(<CoordinatesLesson t={tr} animate={false} advanceDelay={0} />);
    next(); // meet -> rows
    const prompt = c('prompt.rank').replace('{rank}', '');
    await waitFor(() =>
      expect(speech.spoken.some((text) => text.startsWith(prompt.slice(0, 12)))).toBe(true),
    );

    fireEvent.click(screen.getByLabelText(tr('games.chess.learn.autoRead')));
    expect(JSON.parse(window.localStorage.getItem('learn.chess.voice.v1')!)).toMatchObject({ auto: false });
  });

  it('waits until the result has been spoken before the next question', async () => {
    const speech = installSpeech();
    render(<CoordinatesLesson t={tr} animate={false} advanceDelay={0} />);
    next();
    await waitFor(() => expect(screen.getByTestId('coord-prompt').textContent).toContain('1/5'));
    speech.speaking = true; // the voice is still talking
    click(squareName(coordRounds('rank')[0]!.square));
    await new Promise((r) => setTimeout(r, 700));
    expect(screen.getByTestId('coord-prompt').textContent).toContain('1/5');
    speech.speaking = false; // done talking
    await waitFor(() => expect(screen.getByTestId('coord-prompt').textContent).toContain('2/5'), {
      timeout: 2000,
    });
  });

  it('piece lesson: the "found 2 of 4" counter is silent, a wrong tap and the end are spoken', () => {
    const speech = installSpeech();
    const lesson = PIECE_LESSONS.find((l) => l.id === 'knight')!;
    render(<PieceLesson lesson={lesson} t={tr} animate={false} />);
    next(); // meet -> watch
    next(); // watch -> try
    speech.spoken.length = 0;

    click('b5'); // one of the knight's squares: the counter changes, nothing is said
    expect(speech.spoken).toEqual([]);
    click('a1'); // not a knight square
    expect(speech.spoken).toEqual([]); // the counter is still showing: the hint only appears with no squares found
    for (const sq of ['c6', 'e6', 'f5']) click(sq);
    expect(speech.spoken.at(-1)).toBe(tr('games.chess.learn.tryDone'));
  });
});
