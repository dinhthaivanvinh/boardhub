'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/** The header and footer of the children's pages. The admin area has a frame of its own instead. */
export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return pathname === '/admin' || pathname.startsWith('/admin/') ? null : children;
}
