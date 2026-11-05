// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_BOARD_SETTINGS } from '@bg/ui';
import { playerView, setup } from '../src/rules/rules';
import type { BanTauState } from '../src/rules/types';
import { Board, PieceIcon } from '../src/ui/Board';
import { at, battle, play } from './helpers';

afterEach(cleanup);

const t = (key: string, values?: Record<string, string | number>) =>
  values
    ? `${key} ${Object.entries(values)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ')}`
    : key;

function renderBoard(
  state: BanTauState,
  opts: { mySeat?: number | null; isMyTurn?: boolean; confirmMove?: boolean } = {},
) {
  const onMove = vi.fn();
  const mySeat = opts.mySeat === undefined ? 0 : opts.mySeat;
  const props = {
    view: playerView(state, mySeat ?? 'spectator'),
    mySeat,
    isMyTurn: opts.isMyTurn ?? true,
    onMove,
    settings: { ...DEFAULT_BOARD_SETTINGS, confirmMove: opts.confirmMove ?? false },
    t,
  };
  const r = render(<Board {...props} />);
  return { onMove, rerender: r.rerender, props };
}

const sea = (id: string) => screen.getByTestId(id);
const cellIn = (id: string, cell: number) => within(sea(id)).getAllByRole('gridcell')[cell] as HTMLElement;

describe('placing ships', () => {
  it('pick a ship, tap the sea; done only when all five are placed', () => {
    const { onMove } = renderBoard(setup({}));
    const done = screen.getByRole('button', { name: 'games.ban-tau.place.done' });
    expect(done).toHaveProperty('disabled', true);
    // The carrier is selected first; place the five ships on rows 1, 3, 5, 7, 9.
    for (const row of [0, 2, 4, 6, 8]) fireEvent.click(cellIn('sea-placement', row * 10));
    expect(
      within(sea('sea-placement'))
        .getAllByRole('gridcell')
        .filter((c) => c.getAttribute('data-state') === 'ship'),
    ).toHaveLength(17);
    expect(done).toHaveProperty('disabled', false);
    fireEvent.click(done);
    expect(onMove).toHaveBeenCalledWith({
      kind: 'place',
      ships: [0, 20, 40, 60, 80].map((cell) => ({ cell, horizontal: true })),
    });
  });

  it('rotate, refuse a ship that does not fit, pick a placed ship up again', () => {
    renderBoard(setup({}));
    fireEvent.click(screen.getByRole('button', { name: /games\.ban-tau\.place\.rotate/ }));
    fireEvent.click(cellIn('sea-placement', at(0, 8))); // a 5-long ship down from row 8 leaves the sea
    expect(screen.getByRole('alert').textContent).toBe('games.ban-tau.place.cannot');
    fireEvent.click(cellIn('sea-placement', at(0, 1))); // down column A, rows 1-5
    expect(cellIn('sea-placement', at(0, 5)).getAttribute('data-state')).toBe('ship');
    // Pick the carrier up again from its list button.
    fireEvent.click(screen.getAllByRole('button', { name: /games\.ban-tau\.ships\.0/ })[0]!);
    expect(cellIn('sea-placement', at(0, 5)).getAttribute('data-state')).toBe('water');
  });

  it('"Random" places the whole fleet; the second player can only submit on their turn', () => {
    const { onMove } = renderBoard(setup({}), { mySeat: 1, isMyTurn: false });
    fireEvent.click(screen.getByRole('button', { name: /games\.ban-tau\.place\.random/ }));
    expect(screen.getByRole('button', { name: 'games.ban-tau.place.done' })).toHaveProperty('disabled', true);
    expect(screen.getByText('games.ban-tau.waiting')).toBeTruthy();
    expect(onMove).not.toHaveBeenCalled();
  });
});

describe('battle', () => {
  it('tap the enemy sea to fire; your ships show in your own sea only', () => {
    const { onMove } = renderBoard(battle());
    expect(
      within(sea('sea-mine'))
        .getAllByRole('gridcell')
        .filter((c) => c.getAttribute('data-state') === 'ship'),
    ).toHaveLength(17);
    expect(
      within(sea('sea-enemy'))
        .getAllByRole('gridcell')
        .filter((c) => c.getAttribute('data-state') === 'ship'),
    ).toHaveLength(0);
    fireEvent.click(cellIn('sea-enemy', at(4, 5)));
    expect(onMove).toHaveBeenCalledWith({ kind: 'fire', cell: at(4, 5) });
  });

  it('shows hits, misses and sunk ships; no firing at a used square or out of turn', () => {
    let s = play(battle(), 0, { kind: 'fire', cell: at(1, 10) });
    s = play(s, 0, { kind: 'fire', cell: at(2, 10) }); // sinks the destroyer
    s = play(s, 0, { kind: 'fire', cell: at(0, 0 + 1) }); // miss
    const { onMove } = renderBoard({ ...s, turn: 0 });
    expect(cellIn('sea-enemy', at(1, 10)).getAttribute('data-state')).toBe('sunk');
    expect(cellIn('sea-enemy', at(0, 1)).getAttribute('data-state')).toBe('miss');
    expect(cellIn('sea-enemy', at(0, 1)).getAttribute('data-latest')).toBe('true');
    fireEvent.click(cellIn('sea-enemy', at(0, 1)));
    expect(onMove).not.toHaveBeenCalled();
    expect(
      screen.getByText(/games\.ban-tau\.afloat/).parentElement!.querySelector('[data-sunk="true"]')!
        .textContent,
    ).toContain('games.ban-tau.ships.4');
    cleanup();
    const out = renderBoard(battle(), { isMyTurn: false });
    fireEvent.click(cellIn('sea-enemy', 0));
    expect(out.onMove).not.toHaveBeenCalled();
  });

  it('with "tap twice to confirm", the first tap only aims', () => {
    const { onMove } = renderBoard(battle(), { confirmMove: true });
    fireEvent.click(cellIn('sea-enemy', 33));
    expect(onMove).not.toHaveBeenCalled();
    expect(cellIn('sea-enemy', 33).getAttribute('data-pending')).toBe('true');
    fireEvent.click(cellIn('sea-enemy', 33));
    expect(onMove).toHaveBeenCalledWith({ kind: 'fire', cell: 33 });
  });

  it('a spectator sees both seas by name and no hidden ships', () => {
    renderBoard(battle(), { mySeat: null, isMyTurn: false });
    expect(screen.getByText('games.ban-tau.seaOf player=games.ban-tau.pieces.1')).toBeTruthy();
    expect(
      screen.queryAllByRole('gridcell').filter((c) => c.getAttribute('data-state') === 'ship'),
    ).toHaveLength(0);
  });
});

describe('two players on one device', () => {
  it('when the device changes hands, the board is covered until the new player is ready', () => {
    const s = battle();
    const { rerender, props } = renderBoard(s, { mySeat: 0 });
    const next = play(s, 0, { kind: 'fire', cell: 50 }); // a miss: seat 1's turn
    rerender(<Board {...props} view={playerView(next, 1)} mySeat={1} />);
    expect(screen.getByText('games.ban-tau.handoff.title player=games.ban-tau.pieces.1')).toBeTruthy();
    expect(screen.queryByTestId('sea-mine')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /games\.ban-tau\.handoff\.show/ }));
    expect(sea('sea-mine')).toBeTruthy();
  });

  it('PieceIcon draws each fleet', () => {
    const { container } = render(
      <>
        <PieceIcon seat={0} />
        <PieceIcon seat={1} />
      </>,
    );
    expect(container.querySelectorAll('.bt-icon-p0')).toHaveLength(1);
    expect(container.querySelectorAll('.bt-icon-p1')).toHaveLength(1);
  });
});
