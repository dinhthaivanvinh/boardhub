import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { SimpleMarkdown } from '@/components/SimpleMarkdown';
import { SetupForm } from '@/features/setup/SetupForm';
import { isGameId } from '@/games/catalog';

type Props = { params: Promise<{ gameId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { gameId } = await params;
  if (!isGameId(gameId)) return {};
  const t = await getTranslations();
  return { title: t(`games.${gameId}.name`), description: t(`games.${gameId}.shortDescription`) };
}

export default async function GamePage({ params }: Props) {
  const { gameId } = await params;
  if (!isGameId(gameId)) notFound();
  const t = await getTranslations();
  // Raw: rules are markdown, not ICU messages.
  const rules = t.raw(`games.${gameId}.rules`) as string;

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section>
        <h1 className="text-3xl font-bold tracking-tight">{t(`games.${gameId}.name`)}</h1>
        <p className="mt-2 text-[var(--muted)]">{t(`games.${gameId}.shortDescription`)}</p>
        <h2 className="mt-8 mb-3 text-xl font-semibold">{t('setup.rules')}</h2>
        <SimpleMarkdown text={rules} />
      </section>
      <aside>
        <SetupForm gameId={gameId} />
      </aside>
    </div>
  );
}
