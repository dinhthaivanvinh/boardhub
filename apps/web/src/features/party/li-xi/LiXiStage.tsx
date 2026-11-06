'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useRef, type CSSProperties, type RefObject } from 'react';
import { Avatar } from '@bg/avatars';
import { DRAW_LANDING_MS } from '@bg/office-core';
import type { LiXiView } from '@bg/office-li-xi';
import type { OfficeDrawRecord, OfficeDrawStarted, OfficeParticipant, OfficeSnapshot } from '@bg/protocol';
import { buildUpSpot, landingSpot } from '@/features/office/draw-player/spotlight-math';
import { easeInOut } from '@/features/office/draw-player/timeline';
import { useDrawAnimations } from '@/features/office/draw-player/use-draw-clock';
import { animalLabel } from '@/features/office/session/shared';
import { formatVnd } from '../money';
import { Celebration, Envelope, Note } from './Envelope';
import { TetRoom } from './TetRoom';
import { reached, type LiXiPhase } from './timeline';
import { useLiXiClock } from './use-li-xi-clock';
import { useLiXiSounds, useTetMusic } from './sounds';
import { liXiViewOf, giftOf, heldBack, topValue, WISH_COUNT, wishIndex } from './view';

/** The Lì xì draw running now (or the last one), if the session's draw is one. */
export const liXiDraw = (session: OfficeSnapshot): OfficeDrawStarted | OfficeDrawRecord | null =>
  session.draw && session.draw.mode === 'li-xi' ? session.draw : null;

/**
 * The Tết room on the big screen (docs/office/activities/li-xi.md §7): everyone in the room, a light
 * picks who comes up, they walk to the front and open their envelope. Also used, smaller, on the host
 * console and on members' phones. Everything is timed on server time, so every screen shows the same moment.
 */
export function LiXiStage({
  session,
  serverOffset,
  big = true,
  sound = false,
  music = big,
}: {
  session: OfficeSnapshot;
  serverOffset: number;
  big?: boolean;
  sound?: boolean;
  /** The background tune (on the projector by default). */
  music?: boolean;
}) {
  const t = useTranslations('liXi');
  const tAvatar = useTranslations('avatar');
  const locale = useLocale();
  const animate = useDrawAnimations();
  const full = liXiViewOf(session);
  const draw = liXiDraw(session);

  const crowdBox = useRef<HTMLDivElement>(null);
  const floor = useRef<HTMLDivElement>(null);
  const spot = useRef<HTMLDivElement>(null);
  const light = useRef<HTMLDivElement>(null);
  const walker = useRef<HTMLDivElement>(null);
  const cells = useRef(new Map<string, HTMLElement>());

  const onFrame = useCallback(
    (p: LiXiPhase) => frame(p, draw, { crowdBox, floor, spot, light, walker, cells }),
    [draw],
  );
  const phase = useLiXiClock(draw, serverOffset, animate, onFrame);
  const top = full ? topValue(full) : 0;
  useLiXiSounds(
    draw?.drawId ?? null,
    phase,
    sound,
    top,
    full && draw ? (giftOf(full, draw)?.value ?? null) : null,
  );
  useTetMusic(sound && music);

  if (!full) return null;
  const open = !draw || phase === null || reached(phase, 'note');
  const view = heldBack(full, draw?.drawId ?? null, open);
  const gift = draw ? giftOf(full, draw) : null;
  const inGift = phase?.kind === 'gift';
  const atFront = inGift && reached(phase, 'envelope');
  const walking = inGift && phase.step === 'walk';
  const host = session.participants.find((p) => p.id === session.hostId);
  const crowd = session.participants.filter((p) => view.settings.hostReceives || p.id !== session.hostId);
  const got = new Set(view.gifts.map((g) => g.recipient));
  const size = crowdSize(crowd.length, big);
  const money = (v: number) => formatVnd(locale, v);
  const celebrate =
    inGift && gift && (phase.step === 'note' || (phase.step === 'shown' && phase.t < 2500)) && animate;

  return (
    <div
      className={`lixi-stage ${big ? 'lixi-stage-big' : ''} ${animate ? '' : 'lixi-still'}`}
      data-testid="li-xi-stage"
      data-phase={phase ? (phase.kind === 'gift' ? phase.step : phase.kind) : 'idle'}
    >
      <TetRoom />
      <div className="lixi-layout">
        <div ref={floor} className="lixi-floor">
          <div className="lixi-front">
            {host && !view.settings.hostReceives && (
              <figure className="lixi-giver">
                <Avatar avatar={host.avatar} size={big ? 96 : 56} label={animalLabel(tAvatar, host)} />
                <figcaption>
                  <span className="lixi-giver-name">{host.name}</span>
                  <span className="lixi-giver-role">{t('giver')}</span>
                </figcaption>
              </figure>
            )}
            <div className="lixi-podium">
              <div className="lixi-podium-text">
                <p className="lixi-status" role="status" aria-live="polite" data-testid="li-xi-status">
                  {statusText(t, view, phase, gift)}
                </p>
                {inGift && gift && reached(phase, 'note') && (
                  <p className="lixi-amount" data-testid="li-xi-amount">
                    {gift.value > 0 ? money(gift.value) : t('wishOnly')}
                  </p>
                )}
                {inGift && draw && reached(phase, 'note') && (
                  <p className="lixi-wish">“{t(`wishes.${wishIndex(draw.drawId, WISH_COUNT)}`)}”</p>
                )}
                {view.done && !inGiftUnfinished(phase) && (
                  <div className="lixi-finale" data-testid="li-xi-finale">
                    <p className="lixi-finale-title">🎉 {t('done')}</p>
                    <p>{t('doneText', { n: view.gifts.length, total: money(view.total) })}</p>
                  </div>
                )}
              </div>
              <div className="lixi-podium-stage">
                <div ref={spot} className="lixi-spot">
                  {atFront && gift && (
                    <figure className="lixi-receiver" data-testid="li-xi-receiver">
                      <Avatar avatar={gift.avatar} size={big ? 150 : 84} label={animalLabel(tAvatar, gift)} />
                      <figcaption>{gift.name}</figcaption>
                    </figure>
                  )}
                </div>
                {atFront && gift && (
                  <Envelope key={draw?.drawId} step={phase.step} t={phase.t} value={gift.value} big={big} />
                )}
                <div className="lixi-podium-base" aria-hidden="true" />
              </div>
              {celebrate && (
                <Celebration key={draw?.drawId} fireworks={gift.value > 0 && gift.value === topValue(full)} />
              )}
            </div>
          </div>

          <div
            ref={crowdBox}
            className="lixi-crowd"
            data-calling={phase && !inGift ? 'true' : undefined}
            style={{ '--cell': `${size}px` } as CSSProperties}
          >
            <ul className="lixi-crowd-grid">
              {crowd.map((p) => (
                <CrowdMember
                  key={p.id}
                  person={p}
                  size={size}
                  got={got.has(p.id)}
                  away={!!gift && gift.recipient === p.id && (walking || atFront)}
                  showName={crowd.length <= 60}
                  cellRef={(el) => {
                    if (el) cells.current.set(p.id, el);
                    else cells.current.delete(p.id);
                  }}
                />
              ))}
            </ul>
            <div ref={light} className="spotlight-light lixi-light" aria-hidden="true" />
          </div>
          {walking && gift && (
            <div ref={walker} className="lixi-walker" aria-hidden="true">
              <Avatar avatar={gift.avatar} size={big ? 150 : 84} />
            </div>
          )}
        </div>

        <LiXiSide view={view} big={big} />
      </div>
    </div>
  );
}

function inGiftUnfinished(p: LiXiPhase | null) {
  return p !== null && !(p.kind === 'gift' && p.step === 'shown');
}

function statusText(
  t: ReturnType<typeof useTranslations>,
  view: LiXiView,
  phase: LiXiPhase | null,
  gift: ReturnType<typeof giftOf>,
): string {
  if (phase && phase.kind !== 'gift') return t('calling');
  if (phase?.kind === 'gift' && gift) {
    if (!reached(phase, 'note')) return t('called', { name: gift.name });
    return gift.value > 0 ? t('got', { name: gift.name }) : t('gotWish', { name: gift.name });
  }
  if (!view.started) return t('waitingStart');
  if (view.done) return t('done');
  return t('readyNext');
}

function crowdSize(n: number, big: boolean) {
  const base = n <= 10 ? 110 : n <= 24 ? 84 : n <= 60 ? 62 : 42;
  return big ? base : Math.round(base * 0.6);
}

function CrowdMember({
  person,
  size,
  got,
  away,
  showName,
  cellRef,
}: {
  person: OfficeParticipant;
  size: number;
  got: boolean;
  away: boolean;
  showName: boolean;
  cellRef: (el: HTMLLIElement | null) => void;
}) {
  const tAvatar = useTranslations('avatar');
  return (
    <li
      ref={cellRef}
      className="lixi-person"
      data-testid="li-xi-person"
      data-got={got ? 'true' : undefined}
      data-away={away ? 'true' : undefined}
      data-online={person.online ? 'true' : 'false'}
    >
      <span className="lixi-person-avatar">
        <Avatar avatar={person.avatar} size={size} label={animalLabel(tAvatar, person)} />
        {got && (
          <span className="lixi-person-badge" aria-hidden="true">
            🧧
          </span>
        )}
      </span>
      {showName && <span className="lixi-person-name">{person.name}</span>}
    </li>
  );
}

/** The table: notes left of each value, who got what, and the total so far. */
export function LiXiSide({ view, big }: { view: LiXiView; big: boolean }) {
  const t = useTranslations('liXi');
  const locale = useLocale();
  const recent = [...view.gifts].reverse().slice(0, big ? 8 : 5);
  return (
    <aside className="lixi-side" data-testid="li-xi-side">
      <section>
        <h2 className="lixi-side-title">{t('pile')}</h2>
        <ul className="lixi-pile">
          {view.settings.denominations.map((d, i) => (
            <li key={d.value} className="lixi-pile-row" data-testid="li-xi-pile-row">
              <Note value={d.value} small />
              <span className="lixi-pile-value">{formatVnd(locale, d.value)}</span>
              <span className="lixi-pile-left">
                {view.left[i] === null ? '∞' : t('notesLeft', { n: view.left[i] ?? 0 })}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="lixi-side-title">{t('given', { n: view.gifts.length })}</h2>
        {recent.length === 0 ? (
          <p className="lixi-side-empty">{t('noneYet')}</p>
        ) : (
          <ol className="lixi-gifts" data-testid="li-xi-gifts">
            {recent.map((g) => (
              <li key={g.drawId} className="lixi-gift">
                <Avatar avatar={g.avatar} size={32} />
                <span className="lixi-gift-name">{g.name}</span>
                <span className="lixi-gift-value">{g.value > 0 ? formatVnd(locale, g.value) : '🌸'}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="lixi-total">
        <span>{t('total')}</span>
        <strong data-testid="li-xi-total">{formatVnd(locale, view.total)}</strong>
        <span className="lixi-side-waiting">{t('waiting', { n: view.waiting })}</span>
      </section>
    </aside>
  );
}

type Refs = {
  crowdBox: RefObject<HTMLDivElement | null>;
  floor: RefObject<HTMLDivElement | null>;
  spot: RefObject<HTMLDivElement | null>;
  light: RefObject<HTMLDivElement | null>;
  walker: RefObject<HTMLDivElement | null>;
  cells: RefObject<Map<string, HTMLElement>>;
};

/** Per animation frame: the light over the crowd, then the walk to the front. No React state. */
function frame(p: LiXiPhase, draw: OfficeDrawStarted | OfficeDrawRecord | null, r: Refs) {
  const light = r.light.current;
  if (!draw || !light) return;
  const count = draw.candidates.length;
  const s =
    p.kind === 'buildUp'
      ? buildUpSpot(draw.drawId, count, p.t)
      : p.kind === 'landing'
        ? landingSpot(p.record, count, p.t)
        : p.kind === 'gift' && p.step === 'walk' && p.t < 300
          ? landingSpot(p.record, count, DRAW_LANDING_MS)
          : null;
  const box = r.crowdBox.current;
  if (!s || !box) {
    light.style.opacity = '0';
  } else {
    const a = r.cells.current.get(draw.candidates[s.a]?.id ?? '');
    const b = r.cells.current.get(draw.candidates[s.b]?.id ?? '');
    if (a && b) {
      const base = box.getBoundingClientRect();
      const pa = centre(a, base);
      const pb = centre(b, base);
      const rad = light.offsetWidth / 2;
      light.style.opacity = '1';
      light.style.transform = `translate3d(${pa.x + (pb.x - pa.x) * s.f - rad}px, ${pa.y + (pb.y - pa.y) * s.f - rad}px, 0)`;
    }
  }

  // The walk: from their place in the crowd up to the podium, with a little hop in each step.
  const w = r.walker.current;
  if (p.kind !== 'gift' || p.step !== 'walk' || !w) return;
  const from = r.cells.current.get(p.record.winners[0] ?? '');
  const to = r.spot.current;
  const floor = r.floor.current;
  if (!from || !to || !floor) return;
  const base = floor.getBoundingClientRect();
  const a = centre(from.querySelector('svg') ?? from, base);
  const b = centre(to, base);
  const f = easeInOut(p.t / 1400);
  const hop = Math.abs(Math.sin(f * Math.PI * 5)) * 18 * (1 - f);
  const half = w.offsetWidth / 2;
  const scale = 0.55 + 0.45 * f;
  w.style.opacity = '1';
  w.style.transform = `translate3d(${a.x + (b.x - a.x) * f - half}px, ${a.y + (b.y - a.y) * f - half - hop}px, 0) scale(${scale})`;
}

function centre(el: Element, base: DOMRect) {
  const r = el.getBoundingClientRect();
  return { x: r.left - base.left + r.width / 2, y: r.top - base.top + r.height / 2 };
}
