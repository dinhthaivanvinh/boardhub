import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { useId } from 'react';
import { PieceGlyph } from '@bg/game-chess';
import { INFO_PAGE_IDS } from '@/features/legal/types';
import { NAV_GROUPS, NAV_LINKS } from '@/features/settings/nav-links';
import { HomeLink } from './HomeLink';
import { Logo } from './Logo';

/**
 * "Explore" follows the header menus: the plain links, then the first page of each group (a group is a dropdown
 * up there, so down here it is one link). "Information" is the pages about the site.
 */
export const EXPLORE_LINKS: readonly { href: string; key: string }[] = [
  ...NAV_LINKS,
  ...NAV_GROUPS.map((group) => ({ href: group.links[0]!.href, key: group.key })),
];
const INFO_LINKS = INFO_PAGE_IDS.map((id) => ({ href: `/${id}`, key: id }));

/** The footer of every page (hidden in the admin area and on full-screen boards, by CSS). */
export async function SiteFooter() {
  const t = await getTranslations('app');
  const nav = await getTranslations('nav');
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-main">
          <div className="site-footer-about">
            <HomeLink className="site-footer-brand">
              <Logo size={36} />
              {t('name')}
            </HomeLink>
            <p className="site-footer-slogan">{t('slogan')}</p>
            <p className="site-footer-text">{t('footerAbout')}</p>
            {/* Decoration only. */}
            <span className="site-footer-piece" aria-hidden="true">
              <PieceGlyph piece="wN" size={88} />
            </span>
          </div>
          <FooterColumn
            title={t('footerExplore')}
            links={EXPLORE_LINKS.map((l) => ({ href: l.href, label: nav(l.key) }))}
          />
          <FooterColumn
            title={t('footerInfo')}
            links={INFO_LINKS.map((l) => ({ href: l.href, label: nav(l.key) }))}
          />
        </div>
        <div className="site-footer-bottom">
          <p>{t('copyright', { year: new Date().getFullYear() })}</p>
          <p>{t('footerTagline')}</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  const id = useId();
  return (
    <nav aria-labelledby={id} className="site-footer-column">
      <h2 id={id}>{title}</h2>
      <ul>
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href}>{link.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
