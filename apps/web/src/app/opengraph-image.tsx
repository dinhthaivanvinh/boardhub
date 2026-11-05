import { getTranslations } from 'next-intl/server';
import { OG_SIZE, ogCard } from '@/seo/og-card';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'BoardHub';

export default async function Image() {
  const t = await getTranslations('portal');
  return ogCard({ kicker: 'Board game · Văn phòng', title: t('title'), line: t('tagline') });
}
