import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { getMessagesFor, LOCALE_COOKIE, TIME_ZONE, toLocale } from './messages';

// Locale comes from a cookie (no /vi or /en in URLs). Vietnamese by default.
export default getRequestConfig(async () => {
  const locale = toLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return { locale, messages: getMessagesFor(locale), timeZone: TIME_ZONE };
});
