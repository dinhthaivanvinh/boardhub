'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { MouseEvent, ReactNode } from 'react';

/**
 * The BoardHub name as the way home. On the home page itself the router has nowhere to go and keeps the
 * scroll position, so the click goes back to the top instead.
 */
export function HomeLink({ className, children }: { className: string; children: ReactNode }) {
  const pathname = usePathname();
  const onClick = (e: MouseEvent) => {
    // A click that opens a new tab or window stays an ordinary link.
    if (pathname !== '/' || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' });
  };
  return (
    <Link href="/" className={className} onClick={onClick}>
      {children}
    </Link>
  );
}
