import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { OfficeArt } from '@/features/home/OfficeArt';
import { OfficeJoinForm } from '@/features/office/OfficeJoinForm';
import { OFFICE_ACTIVITIES } from '@/office/catalog';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('office');
  return { title: t('title'), description: t('tagline') };
}

const STEPS = ['create', 'join', 'draw'] as const;

export default async function OfficePage() {
  const t = await getTranslations('office');
  return (
    <>
      <section className="hero border-b border-[var(--border)]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:py-16">
          <div>
            <p className="chip chip-accent">{t('badge')}</p>
            <h1 className="mt-4 text-4xl leading-tight font-extrabold tracking-tight text-balance sm:text-5xl">
              {t('title')}
            </h1>
            <p className="mt-4 max-w-lg text-lg text-[var(--muted)]">{t('tagline')}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/office/new" className="btn btn-primary btn-lg">
                {t('start')}
              </Link>
              <Link href="/office/avatar" className="btn btn-lg">
                🐾 {t('myAnimal')}
              </Link>
            </div>
            <div className="mt-6 max-w-md">
              <OfficeJoinForm />
            </div>
          </div>
          <div
            className="overflow-hidden rounded-2xl border border-[var(--border)] shadow-xl"
            aria-hidden="true"
          >
            <OfficeArt className="block aspect-[16/10] w-full" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10" aria-labelledby="office-how">
        <h2 id="office-how" className="text-2xl font-bold tracking-tight">
          {t('how.title')}
        </h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step} className="card flex gap-3">
              <span className="feature-icon text-lg font-bold">{i + 1}</span>
              <div>
                <h3 className="font-semibold">{t(`how.${step}.title`)}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{t(`how.${step}.text`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16" aria-labelledby="office-activities">
        <h2 id="office-activities" className="text-2xl font-bold tracking-tight">
          {t('activitiesTitle')}
        </h2>
        <ul className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {OFFICE_ACTIVITIES.map((a) => (
            <li
              key={a.id}
              className="card flex h-full flex-col gap-2"
              data-testid={`activity-${a.id}`}
              aria-disabled={a.status !== 'ready'}
            >
              <span className="text-3xl" aria-hidden="true">
                {a.emoji}
              </span>
              <h3 className="text-lg font-semibold">{t(`activities.${a.id}.name`)}</h3>
              <p className="flex-1 text-sm text-[var(--muted)]">{t(`activities.${a.id}.text`)}</p>
              {a.status === 'soon' ? (
                <span className="chip self-start text-xs">{t('soon')}</span>
              ) : (
                <Link href="/office/new" className="game-card-cta">
                  {t('start')} <span aria-hidden="true">→</span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
