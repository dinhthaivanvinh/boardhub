import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import {
  DEFAULT_LOCALE,
  getMessagesFor,
  LANGUAGE_CHOICE,
  LOCALE_COOKIE,
  TIME_ZONE,
  toLocale,
} from './messages';

// Locale comes from a cookie (no /vi or /en in URLs), only when the language can be chosen. Vietnamese by default.
export default getRequestConfig(async () => {
  const locale = LANGUAGE_CHOICE ? toLocale((await cookies()).get(LOCALE_COOKIE)?.value) : DEFAULT_LOCALE;
  return { locale, messages: getMessagesFor(locale), timeZone: TIME_ZONE };
});
