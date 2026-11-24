'use server';

import { cookies } from 'next/headers';
import { LANGUAGE_CHOICE, LOCALE_COOKIE, toLocale } from './messages';

export async function setLocale(locale: string): Promise<void> {
  if (!LANGUAGE_CHOICE) return;
  (await cookies()).set(LOCALE_COOKIE, toLocale(locale), {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
}
