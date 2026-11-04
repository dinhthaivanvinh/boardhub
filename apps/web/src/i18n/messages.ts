import { GAME_IDS, GAMES } from '@/games/catalog';
import en from './en.json';
import vi from './vi.json';

export const LOCALES = ['vi', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'vi';
export const LOCALE_COOKIE = 'NEXT_LOCALE';
export const TIME_ZONE = 'Asia/Ho_Chi_Minh';

export function toLocale(value: string | undefined): Locale {
  return LOCALES.includes(value as Locale) ? (value as Locale) : DEFAULT_LOCALE;
}

/** App strings plus each game's strings under games.<id> (docs/08 §6). */
export function getMessagesFor(locale: Locale) {
  const common = locale === 'en' ? en : vi;
  const games = Object.fromEntries(GAME_IDS.map((id) => [id, GAMES[id].messages[locale]]));
  return { ...common, games };
}
