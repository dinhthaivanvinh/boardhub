import type { SiteInfo } from './site-info';

export const INFO_PAGE_IDS = ['about', 'contact', 'privacy', 'terms'] as const;
export type InfoPageId = (typeof INFO_PAGE_IDS)[number];

export interface InfoSection {
  id: string;
  title: string;
  paragraphs?: string[];
  list?: string[];
  /** Pages of this site (`/…`), other sites (`https://…`) or a `mailto:` address. */
  links?: { href: string; label: string }[];
}

export interface InfoPage {
  title: string;
  /** For search results and social cards. */
  description: string;
  intro: string[];
  sections: InfoSection[];
}

export interface InfoContent {
  /** "Last updated: {date}", shown on the privacy policy and the terms. */
  updated: (date: string) => string;
  pages: (site: SiteInfo) => Record<InfoPageId, InfoPage>;
}
