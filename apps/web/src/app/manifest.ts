import type { MetadataRoute } from 'next';
import { SITE_NAME } from '@/seo/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: 'Board game và trò chơi văn phòng, miễn phí trên trình duyệt.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f5f0',
    theme_color: '#f7f5f0',
    lang: 'vi',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
