import type { Metadata } from 'next';
import Link from 'next/link';
import { getFormatter, getLocale } from 'next-intl/server';
import { toLocale } from '@/i18n/messages';
import { publicPage } from '@/seo/site';
import { EN } from './content-en';
import { VI } from './content-vi';
import { LEGAL_UPDATED, SITE_INFO } from './site-info';
import type { InfoPageId } from './types';

const load = async (id: InfoPageId) => {
  const locale = toLocale(await getLocale());
  const content = locale === 'en' ? EN : VI;
  return { locale, content, page: content.pages(SITE_INFO)[id] };
};

export async function infoMetadata(id: InfoPageId): Promise<Metadata> {
  const { locale, page } = await load(id);
  return publicPage({ title: page.title, description: page.description, path: `/${id}`, locale });
}

/** About, contact, privacy and terms: plain text rendered on the server. */
export async function InfoPageView({ id }: { id: InfoPageId }) {
  const { content, page } = await load(id);
  const format = await getFormatter();
  const dated = id === 'privacy' || id === 'terms';
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-10 leading-relaxed">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-balance">{page.title}</h1>
        {dated && (
          <p className="text-sm text-[var(--muted)]">
            {content.updated(
              format.dateTime(new Date(`${LEGAL_UPDATED}T12:00:00+07:00`), { dateStyle: 'long' }),
            )}
          </p>
        )}
      </header>
      {page.intro.map((text) => (
        <p key={text}>{text}</p>
      ))}
      {page.sections.map((section) => (
        <section key={section.id} id={section.id} className="mt-4 flex scroll-mt-20 flex-col gap-3">
          <h2 className="text-xl font-bold">{section.title}</h2>
          {section.paragraphs?.map((text) => (
            <p key={text}>{text}</p>
          ))}
          {section.list && (
            <ul className="flex list-disc flex-col gap-2 pl-6">
              {section.list.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          )}
          {section.links && (
            <ul className="flex flex-wrap gap-x-5 gap-y-1">
              {section.links.map((link) => (
                <li key={link.href}>
                  {link.href.startsWith('/') ? (
                    <Link href={link.href} className="font-semibold text-[var(--accent)] underline">
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      className="font-semibold break-all text-[var(--accent)] underline"
                      rel="noopener noreferrer"
                    >
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </article>
  );
}
