'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { NAV_GROUPS } from './nav-links';

/** Menu button for small screens, where the header has no room for the nav links. */
export function MobileNav() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // Close after navigating, on Escape, and on a click outside.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <div ref={root} className="relative sm:hidden">
      <button
        type="button"
        className="grid size-9 place-items-center rounded-lg border border-[var(--border)]"
        aria-label={t('menu')}
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="currentColor">
          {open ? (
            <path d="M4.3 4.3a1 1 0 0 1 1.4 0L10 8.6l4.3-4.3a1 1 0 1 1 1.4 1.4L11.4 10l4.3 4.3a1 1 0 0 1-1.4 1.4L10 11.4l-4.3 4.3a1 1 0 0 1-1.4-1.4L8.6 10 4.3 5.7a1 1 0 0 1 0-1.4Z" />
          ) : (
            <path d="M3 5a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Zm0 5a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Zm1 4a1 1 0 1 0 0 2h12a1 1 0 1 0 0-2H4Z" />
          )}
        </svg>
      </button>
      {open && (
        <nav
          id="mobile-nav"
          aria-label={t('label')}
          className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] py-1 shadow-xl"
        >
          <MenuLink href="/" label={t('home')} current={pathname === '/'} />
          {NAV_GROUPS.map((group) => (
            <div
              key={group.key}
              role="group"
              aria-labelledby={'mobile-nav-' + group.key}
              className="border-t border-[var(--border)] py-1"
            >
              <p
                id={'mobile-nav-' + group.key}
                className="px-4 pt-2 pb-1 text-xs font-semibold tracking-wide text-[var(--muted)] uppercase"
              >
                {t(group.key)}
              </p>
              {group.links.map(({ href, key }) => (
                <MenuLink key={href} href={href} label={t(key)} current={pathname === href} />
              ))}
            </div>
          ))}
        </nav>
      )}
    </div>
  );
}

function MenuLink({ href, label, current }: { href: string; label: string; current: boolean }) {
  return (
    <Link
      href={href}
      aria-current={current ? 'page' : undefined}
      className="block px-4 py-2.5 text-sm hover:bg-[var(--bg)] aria-[current=page]:font-semibold aria-[current=page]:text-[var(--accent)]"
    >
      {label}
    </Link>
  );
}
