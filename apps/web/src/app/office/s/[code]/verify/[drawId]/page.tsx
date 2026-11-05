import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { VerifyClient } from '@/features/office/session/clients';

type Props = { params: Promise<{ code: string; drawId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('officeSession.verify');
  return { title: t('kicker'), robots: { index: false } };
}

export default async function Page({ params }: Props) {
  const { code: raw, drawId } = await params;
  const code = raw.toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code) || !/^[0-9a-f-]{36}$/i.test(drawId)) notFound();
  return <VerifyClient code={code} drawId={drawId} />;
}
