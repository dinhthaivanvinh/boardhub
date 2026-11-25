'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { groupOf, linkOf, NAV_GROUPS, NAV_LINKS } from './nav-links';

/** Header menus for wide screens: "Board game ▾" and "Văn phòng ▾". */
export function NavMenus() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const root = useRef<HTMLElement>(null);
  const current = groupOf(pathname);
  const currentLink = linkOf(pathname);

  useEffect(() => setOpen(null), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    const onClick = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <nav ref={root} className="hidden items-center gap-1 text-sm md:flex" aria-label={t('label')}>
      {NAV_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="nav-link"
          data-current={currentLink === link.key ? 'true' : undefined}
          aria-current={currentLink === link.key ? 'page' : undefined}
        >
          {t(link.key)}
        </Link>
      ))}
      {NAV_GROUPS.map((group) => {
        const isOpen = open === group.key;
        const id = `nav-menu-${group.key}`;
        return (
          <div key={group.key} className="relative">
            <button
              type="button"
              className="nav-link inline-flex items-center gap-1"
              aria-expanded={isOpen}
              aria-controls={id}
              data-current={current === group.key ? 'true' : undefined}
              onClick={() => setOpen(isOpen ? null : group.key)}
            >
              {t(group.key)}
              <svg
                viewBox="0 0 12 12"
                width="10"
                height="10"
                aria-hidden="true"
                className={isOpen ? 'rotate-180' : ''}
              >
                <path
                  d="M2 4l4 4 4-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            {isOpen && (
              <ul id={id} className="nav-dropdown">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={pathname === link.href ? 'page' : undefined}
                      className="nav-dropdown-link"
                    >
                      {t(link.key)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}
