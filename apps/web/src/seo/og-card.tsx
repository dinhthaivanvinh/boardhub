import { ImageResponse } from 'next/og';

export const OG_SIZE = { width: 1200, height: 630 };

/** The social card (Facebook, Zalo, X…): the BoardHub tiles, a title and one line. */
export function ogCard({ title, line, kicker }: { title: string; line: string; kicker: string }) {
  const tile = (color: string) => (
    <div style={{ width: 52, height: 52, borderRadius: 14, background: color, display: 'flex' }} />
  );
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 72,
        background: 'linear-gradient(135deg, #fff7ed 0%, #f7f5f0 55%, #e0e7ff 100%)',
        color: '#1c1917',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', width: 116, gap: 12 }}>
          {tile('#f97316')}
          {tile('#1d4ed8')}
          {tile('#15803d')}
          {tile('#b91c1c')}
        </div>
        <div style={{ fontSize: 44, fontWeight: 800 }}>BoardHub</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 30, color: '#c2410c', fontWeight: 700 }}>{kicker}</div>
        <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05 }}>{title}</div>
        <div style={{ fontSize: 34, color: '#57534e', lineHeight: 1.3 }}>{line}</div>
      </div>
    </div>,
    OG_SIZE,
  );
}
