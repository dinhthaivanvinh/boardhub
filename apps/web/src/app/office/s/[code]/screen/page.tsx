import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { StageClient } from '@/features/office/session/clients';

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const t = await getTranslations('officeSession');
  return { title: `${t('stageTitle')} ${code.toUpperCase()}`, robots: { index: false } };
}

export default async function Page({ params }: Props) {
  const code = (await params).code.toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) notFound();
  return <StageClient code={code} />;
}
