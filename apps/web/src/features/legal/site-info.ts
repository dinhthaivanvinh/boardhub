/**
 * Who runs the site and how to reach them, as published on the About, Contact, Privacy and Terms pages.
 * Both are public. The address must receive mail: it is how data requests arrive. Use one made for the site.
 * Whatever is written about the operator must be true.
 */
export interface SiteInfo {
  /** The name to publish for who is responsible. Empty = the pages say one individual runs the site. */
  operator: string;
  /** Public contact address. Empty = the pages say it is being set up. */
  email: string;
}

export const SITE_INFO: SiteInfo = {
  operator: '',
  email: 'boardhubvn.lienhe@gmail.com',
};

/** When the texts of the privacy policy and the terms last changed (`YYYY-MM-DD`). */
export const LEGAL_UPDATED = '2026-11-26';
