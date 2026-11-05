'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Avatar, type AvatarData } from '@bg/avatars';
import type { OfficeParticipant } from '@bg/protocol';
import { errorKey } from '@/game-runtime/error-key';

/** The link people open (or scan) to join. */
export function joinUrl(code: string): string {
  if (typeof window === 'undefined') return `/office/s/${code}`;
  return `${window.location.origin}/office/s/${code}`;
}

export function QrCode({ value, size = 220 }: { value: string; size?: number }) {
  const t = useTranslations('officeSession');
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void QRCode.toString(value, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }).then((s) => {
      if (!cancelled) setSvg(s);
    });
    return () => {
      cancelled = true;
    };
  }, [value]);
  return (
    <div
      className="office-qr"
      style={{ width: size, height: size }}
      role="img"
      aria-label={t('qrLabel', { url: value })}
      data-testid="office-qr"
      // The SVG comes from the qrcode library, generated from our own URL.
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}

/** Size of each animal on the stage, by head count (docs/office/07 §2). */
export const herdSize = (n: number) => (n <= 12 ? 150 : n <= 60 ? 92 : 56);

export function animalLabel(t: ReturnType<typeof useTranslations>, p: { name: string; avatar: AvatarData }) {
  return t('animalLabel', { name: p.name, species: t(`species.${p.avatar.species}`) });
}

/** Everyone in the session as their animal; newcomers hop in. */
export function Herd({
  people,
  size,
  showNames = true,
}: {
  people: OfficeParticipant[];
  size: number;
  showNames?: boolean;
}) {
  const t = useTranslations('avatar');
  return (
    <ul
      className="office-herd"
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${size + 16}px, 1fr))` }}
    >
      {people.map((p) => (
        <li
          key={p.id}
          className="office-herd-item"
          data-testid="herd-animal"
          data-online={p.online ? 'true' : 'false'}
          data-absent={p.absent ? 'true' : undefined}
        >
          <Avatar avatar={p.avatar} size={size} label={animalLabel(t, p)} />
          {showNames && (
            <span className="office-herd-name" style={{ maxWidth: size + 16 }}>
              {p.absent && <span aria-hidden="true">📵 </span>}
              {p.name}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function OfficeError({ code }: { code: string }) {
  const t = useTranslations();
  const known = ['office.not_found', 'office.closed', 'office.locked'].includes(code);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
      <span className="text-5xl" aria-hidden="true">
        🙈
      </span>
      <p role="alert" className="text-lg font-semibold">
        {known ? t(`officeSession.errors.${code.slice('office.'.length)}`) : t(errorKey(code))}
      </p>
      <Link href="/office" className="btn">
        ← {t('office.title')}
      </Link>
    </div>
  );
}

export function Connecting() {
  const t = useTranslations('online');
  return <p className="px-4 py-20 text-center text-[var(--muted)]">{t('connecting')}</p>;
}
