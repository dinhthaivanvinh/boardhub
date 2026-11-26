import { describe, expect, it } from 'vitest';
import { KEEP_LEARN_DAYS } from '../../server/src/stats/learn-events';
import { KEEP_DAYS } from '../../server/src/stats/visit-service';
import { EN } from '../src/features/legal/content-en';
import { VI } from '../src/features/legal/content-vi';
import { INFO_PAGE_IDS } from '../src/features/legal/types';

const filled = { operator: 'Test Operator', email: 'hello@example.com' };
const empty = { operator: '', email: '' };

const shape = (content: typeof VI, site: typeof filled) => {
  const pages = content.pages(site);
  return INFO_PAGE_IDS.map((id) => ({
    id,
    intro: pages[id].intro.length,
    sections: pages[id].sections.map((s) => [
      s.id,
      s.paragraphs?.length ?? 0,
      s.list?.length ?? 0,
      s.links?.map((l) => l.href) ?? [],
    ]),
  }));
};

describe('information pages', () => {
  it('say the same things in vi and en', () => {
    for (const site of [filled, empty]) expect(shape(EN, site)).toEqual(shape(VI, site));
  });

  it('have no empty text and no repeated section id', () => {
    for (const content of [VI, EN]) {
      for (const site of [filled, empty]) {
        for (const page of Object.values(content.pages(site))) {
          const ids = page.sections.map((s) => s.id);
          expect(new Set(ids).size).toBe(ids.length);
          const texts = [
            page.title,
            page.description,
            ...page.intro,
            ...page.sections.flatMap((s) => [s.title, ...(s.paragraphs ?? []), ...(s.list ?? [])]),
          ];
          for (const text of texts) expect(text.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('publish the contact address on the contact and privacy pages, and none when there is none', () => {
    const links = (site: typeof filled, id: 'contact' | 'privacy') =>
      VI.pages(site)[id].sections.flatMap((s) => s.links?.map((l) => l.href) ?? []);
    for (const id of ['contact', 'privacy'] as const) {
      expect(links(filled, id)).toContain('mailto:hello@example.com');
      expect(links(empty, id).some((href) => href.startsWith('mailto:'))).toBe(false);
    }
  });

  // The policy promises these periods: a change on the server must change the texts too.
  it('state the retention periods the server uses', () => {
    for (const content of [VI, EN]) {
      const stats = content.pages(filled).privacy.sections.find((s) => s.id === 'stats')!;
      const text = stats.list!.join(' ');
      expect(text).toContain(String(KEEP_DAYS));
      expect(text).toContain(String(KEEP_LEARN_DAYS));
    }
  });
});
