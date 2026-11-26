'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { PublicUser } from '@bg/protocol';
import { useHydrated } from '@/features/account/use-hydrated';
import { adminReports } from '@/online/admin-api';
import { apiRequest } from '@/online/api';
import { useSession } from '@/online/session';
import { AdminIcon, type IconName } from './ui/icons';

/** Only pages that exist are listed. */
const NAV: { href: string; key: 'dashboard' | 'visitors' | 'reports' | 'settings'; icon: IconName }[] = [
  { href: '/admin', key: 'dashboard', icon: 'dashboard' },
  { href: '/admin/visitors', key: 'visitors', icon: 'visitors' },
  { href: '/admin/reports', key: 'reports', icon: 'reports' },
  { href: '/admin/settings/games', key: 'settings', icon: 'settings' },
];
const COLLAPSED_KEY = 'bh.admin.sidebar';
/** The server lists at most this many open reports. */
const REPORT_LIST_LIMIT = 100;

/** Lets a page say that the number of open reports changed. */
const ReportsContext = createContext<() => void>(() => {});
export const useRefreshReportCount = () => useContext(ReportsContext);

/** The admin area's own frame: it replaces the header and footer of the children's pages. */
export function AdminShell({ children }: { children: ReactNode }) {
  const t = useTranslations('admin');
  const hydrated = useHydrated();
  const token = useSession((s) => s.token);
  const [me, setMe] = useState<PublicUser | null | 'loading'>('loading');

  // Re-read the account: the admin flag may be newer than the copy kept in the browser. The server checks
  // every request again; this only decides what to show.
  useEffect(() => {
    if (!hydrated) return;
    if (!token) return setMe(null);
    let stale = false;
    void apiRequest<PublicUser>('GET', '/api/me', undefined, token).then((res) => {
      if (stale) return;
      if (res.ok) useSession.getState().setUser(res.data);
      setMe(res.ok ? res.data : null);
    });
    return () => {
      stale = true;
    };
  }, [hydrated, token]);

  if (me === 'loading')
    return (
      <div className="admin admin-gate">
        <p role="status">{t('loading')}</p>
      </div>
    );
  if (!me?.admin)
    return (
      <div className="admin admin-gate">
        <div className="card">
          <p role="alert" data-testid="admin-denied">
            {t('denied')}
          </p>
          <div className="admin-gate-actions">
            <Link href="/account" className="btn btn-primary">
              {t('signIn')}
            </Link>
            <Link href="/" className="btn">
              {t('shell.site')}
            </Link>
          </div>
        </div>
      </div>
    );
  return <Frame me={me}>{children}</Frame>;
}

function Frame({ me, children }: { me: PublicUser; children: ReactNode }) {
  const t = useTranslations('admin');
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  const [reports, setReports] = useState<number | null>(null);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === '1');
    } catch {
      /* not remembered */
    }
  }, []);
  const toggle = () => {
    setCollapsed(!collapsed);
    try {
      window.localStorage.setItem(COLLAPSED_KEY, collapsed ? '0' : '1');
    } catch {
      /* not remembered */
    }
  };

  const refreshReports = useCallback(() => {
    void adminReports('open').then((res) => {
      if (res.ok) setReports(res.data.reports.length);
    });
  }, []);
  // Read again on every page, and close the menu of a narrow screen.
  useEffect(() => {
    refreshReports();
    setOpen(false);
  }, [pathname, refreshReports]);

  useEffect(() => {
    if (!open) return;
    const close = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);

  const current = NAV.find((n) => n.href === pathname) ?? NAV[0]!;
  const count =
    reports === null ? '' : reports >= REPORT_LIST_LIMIT ? `${REPORT_LIST_LIMIT}+` : String(reports);

  return (
    <ReportsContext.Provider value={refreshReports}>
      <div className="admin admin-shell" data-collapsed={collapsed} data-open={open}>
        <aside className="admin-sidebar" id="admin-sidebar">
          <div className="admin-brand">
            <span className="admin-brand-mark" aria-hidden="true">
              B
            </span>
            <span className="admin-label">{t('shell.brand')}</span>
          </div>
          <nav aria-label={t('shell.menu')}>
            <ul>
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={item.href === current.href ? 'page' : undefined}
                    title={t(`nav.${item.key}`)}
                    data-testid={`admin-nav-${item.key}`}
                  >
                    <AdminIcon name={item.icon} />
                    <span className="admin-label">{t(`nav.${item.key}`)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <button type="button" className="admin-collapse" onClick={toggle} aria-pressed={collapsed}>
            <AdminIcon name={collapsed ? 'expand' : 'collapse'} />
            <span className="admin-label">{t(collapsed ? 'shell.expand' : 'shell.collapse')}</span>
          </button>
        </aside>
        {open && <div className="admin-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}
        <div className="admin-main">
          <header className="admin-header">
            <button
              type="button"
              className="admin-icon-button admin-menu-button"
              aria-label={t('shell.menu')}
              aria-expanded={open}
              aria-controls="admin-sidebar"
              onClick={() => setOpen(!open)}
              data-testid="admin-menu"
            >
              <AdminIcon name="menu" />
            </button>
            <nav aria-label={t('shell.breadcrumb')} className="admin-breadcrumb">
              <ol>
                <li>
                  <Link href="/admin">{t('title')}</Link>
                </li>
                <li aria-current="page">{t(`crumbs.${current.key}`)}</li>
              </ol>
            </nav>
            <Link
              href="/admin/reports"
              className="admin-icon-button"
              aria-label={t('shell.notifications', { count: reports ?? 0 })}
              data-testid="admin-bell"
            >
              <AdminIcon name="bell" />
              {!!reports && <span className="admin-badge">{count}</span>}
            </Link>
            <ProfileMenu me={me} />
          </header>
          <div className="admin-content">{children}</div>
        </div>
      </div>
    </ReportsContext.Provider>
  );
}

function ProfileMenu({ me }: { me: PublicUser }) {
  const t = useTranslations('admin.shell');
  const router = useRouter();
  const menu = useRef<HTMLDetailsElement>(null);

  // A click elsewhere or Escape closes the menu.
  useEffect(() => {
    const away = (e: Event) => {
      const el = menu.current;
      if (!el?.open) return;
      if (e instanceof globalThis.KeyboardEvent ? e.key === 'Escape' : !el.contains(e.target as Node))
        el.open = false;
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', away);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', away);
    };
  }, []);

  return (
    <details className="admin-profile" ref={menu}>
      <summary aria-label={t('profile', { name: me.displayName })} data-testid="admin-profile">
        <span className="admin-avatar" aria-hidden="true">
          {me.displayName.trim().charAt(0).toUpperCase()}
        </span>
        <span className="admin-profile-name">{me.displayName}</span>
      </summary>
      <div className="card admin-profile-menu">
        <p>
          <strong>{me.displayName}</strong>
          <span>{me.email}</span>
        </p>
        <Link href="/account">{t('account')}</Link>
        <Link href="/">{t('site')}</Link>
        <button
          type="button"
          onClick={() => {
            router.push('/');
            useSession.getState().clear();
          }}
          data-testid="admin-logout"
        >
          {t('signOut')}
        </button>
      </div>
    </details>
  );
}
