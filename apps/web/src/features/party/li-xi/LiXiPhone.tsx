'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect } from 'react';
import type { OfficeSnapshot } from '@bg/protocol';
import { useDrawAnimations } from '@/features/office/draw-player/use-draw-clock';
import { formatVnd } from '../money';
import { liXiDraw } from './LiXiStage';
import { reached } from './timeline';
import { useLiXiClock } from './use-li-xi-clock';
import { liXiViewOf, giftOf, heldBack } from './view';

/**
 * A member's own line above the Tết room on their phone: "look at the screen" while the light looks,
 * "Your turn!" (with a buzz) when it stops on you, then what was in your envelope. Others see who got
 * what. Same clock as the stage, so a phone never spoils the moment.
 */
export function LiXiPhone({ session, serverOffset }: { session: OfficeSnapshot; serverOffset: number }) {
  const t = useTranslations('liXiPhone');
  const tLiXi = useTranslations('liXi');
  const locale = useLocale();
  const full = liXiViewOf(session);
  const draw = liXiDraw(session);
  const phase = useLiXiClock(draw, serverOffset, useDrawAnimations());
  const meId = session.me.id;
  const gift = full && draw ? giftOf(full, draw) : null;
  const inGift = phase?.kind === 'gift';
  const mine = inGift && gift?.recipient === meId;
  const myTurnNow = mine && phase.step !== 'shown';

  useEffect(() => {
    if (myTurnNow) navigator.vibrate?.([250, 120, 250, 120, 400]);
  }, [myTurnNow]);

  if (!full) return null;
  const open = !draw || phase === null || reached(phase, 'note');
  const view = heldBack(full, draw?.drawId ?? null, open);
  const myGift = view.gifts.find((g) => g.recipient === meId);
  const money = (v: number) => (v > 0 ? formatVnd(locale, v) : tLiXi('wishOnly'));

  return (
    <div className="flex w-full flex-col items-center gap-3" data-testid="li-xi-phone">
      {phase && !inGift && (
        <p className="card draw-phone draw-phone-running w-full" role="status">
          🏮 {t('watch')}
        </p>
      )}
      {inGift && gift && mine && draw && (
        <div
          className="lixi-phone-mine w-full"
          role="status"
          aria-live="assertive"
          data-testid="li-xi-my-turn"
        >
          <p className="text-2xl font-black">🎉 {t('yourTurn')}</p>
          {reached(phase, 'note') ? (
            <>
              <p className="lixi-phone-amount" data-testid="li-xi-my-amount">
                {money(gift.value)}
              </p>
            </>
          ) : (
            <p>{t('opening')}</p>
          )}
        </div>
      )}
      {inGift && gift && !mine && (
        <p className="card w-full" role="status" data-testid="li-xi-other">
          {reached(phase, 'note')
            ? t('otherGot', { name: gift.name, amount: money(gift.value) })
            : tLiXi('called', { name: gift.name })}
        </p>
      )}
      {myGift && !mine && (
        <p className="card w-full" data-testid="li-xi-my-gift">
          🧧 {t('yours', { amount: money(myGift.value) })}
        </p>
      )}
      <p className="text-sm text-[var(--muted)]" data-testid="li-xi-phone-status">
        {!view.started
          ? tLiXi('waitingStart')
          : view.done
            ? `🎉 ${tLiXi('done')}`
            : myGift
              ? t('waitingOthers', { n: view.waiting })
              : t('waitingYou', { n: view.waiting })}
      </p>
    </div>
  );
}
