import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createRng } from '@bg/engine';
import { ACCESSORIES, EYES, MOUTHS, NATURAL, PALETTE, PATTERNS, SPECIES } from '../src/catalog';
import { defaultAvatar, randomAvatar } from '../src/random';
import { Avatar } from '../src/render/Avatar';
import { inkOn, isDark, luminance, mix, shade } from '../src/render/color';
import { AvatarSchema, type Avatar as A } from '../src/schema';

const base = (species: (typeof SPECIES)[number] = 'cat'): A => ({
  v: 1,
  species,
  ...NATURAL[species],
  eyes: 'round',
  mouth: 'smile',
  accessory: 'none',
  accessoryColor: '#ef4444',
  background: '#bae6fd',
});
const draw = (avatar: A, size = 96, label?: string) =>
  renderToStaticMarkup(<Avatar avatar={avatar} size={size} {...(label ? { label } : {})} />);

describe('schema', () => {
  it('accepts catalog avatars', () => {
    for (const s of SPECIES) expect(AvatarSchema.parse(base(s))).toEqual(base(s));
  });

  it.each([
    ['an unknown species', { species: 'dragon' }],
    ['a colour outside the palette', { body: '#123456' }],
    ['an unknown accessory', { accessory: 'cape' }],
    ['another version', { v: 2 }],
    ['an extra field (e.g. an image url)', { image: 'https://example.com/x.png' }],
  ])('rejects %s', (_name, patch) => {
    expect(AvatarSchema.safeParse({ ...base(), ...patch }).success).toBe(false);
  });

  it('the natural colours of every species are in the palette', () => {
    for (const s of SPECIES) {
      expect(PALETTE).toContain(NATURAL[s].body);
      expect(PALETTE).toContain(NATURAL[s].accent);
    }
  });
});

describe('random avatars', () => {
  it('1,000 random avatars are all valid, and every species shows up', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const a = randomAvatar(createRng('r', i));
      expect(AvatarSchema.safeParse(a).success).toBe(true);
      seen.add(a.species);
    }
    expect(seen.size).toBe(SPECIES.length);
  });

  it('a new player always gets the same default avatar', () => {
    expect(defaultAvatar('user-1')).toEqual(defaultAvatar('user-1'));
    const many = new Set(Array.from({ length: 20 }, (_, i) => JSON.stringify(defaultAvatar(`u${i}`))));
    expect(many.size).toBeGreaterThan(15);
  });
});

describe('drawing', () => {
  it('every species with every accessory, eye and mouth draws', () => {
    let count = 0;
    for (const s of SPECIES) {
      for (const accessory of ACCESSORIES) {
        for (const eyes of EYES) {
          const svg = draw({ ...base(s), accessory, eyes, mouth: MOUTHS[count % MOUTHS.length]! });
          expect(svg).toContain(`data-species="${s}"`);
          if (accessory !== 'none') expect(svg).toContain('data-part="accessory"');
          count++;
        }
      }
    }
    expect(count).toBe(600);
  });

  it('every pattern draws, and small avatars drop the details', () => {
    for (const pattern of PATTERNS) expect(draw({ ...base(), pattern })).toContain('<svg');
    const big = draw({ ...base(), pattern: 'stripes' }, 96);
    const small = draw({ ...base(), pattern: 'stripes' }, 32);
    expect(big.length).toBeGreaterThan(small.length);
  });

  it('is pure: the same avatar draws the same picture', () => {
    expect(draw(base('fox'))).toBe(draw(base('fox')));
  });

  it('is decorative unless labelled', () => {
    expect(draw(base())).toContain('aria-hidden="true"');
    const labelled = draw(base(), 96, 'An: mèo cam');
    expect(labelled).toContain('role="img"');
    expect(labelled).toContain('aria-label="An: mèo cam"');
  });

  it('dark fur gets light eyes', () => {
    const dark = draw({ ...base('dog'), body: '#27272a' });
    expect(dark).toMatch(/data-part="eyes"><circle[^>]*fill="#f8fafc"/);
    expect(draw(base('dog'))).toMatch(/data-part="eyes"><circle[^>]*fill="#1f2937"/);
  });

  it('draws 200 avatars quickly (a full stage)', () => {
    const start = performance.now();
    for (let i = 0; i < 200; i++) draw(randomAvatar(createRng('perf', i)), 56);
    expect(performance.now() - start).toBeLessThan(1500);
  });
});

describe('colours', () => {
  it('brightness, mixing, shades and ink', () => {
    expect(luminance('#ffffff')).toBe(1);
    expect(luminance('#000000')).toBe(0);
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(isDark('#27272a')).toBe(true);
    expect(isDark('#fde68a')).toBe(false);
    expect(luminance(shade('#f59e0b'))).toBeLessThan(luminance('#f59e0b'));
    expect(luminance(shade('#27272a'))).toBeGreaterThan(luminance('#27272a'));
    expect(inkOn('#27272a')).toBe('#f8fafc');
    expect(inkOn('#fef3c7')).toBe('#1f2937');
  });
});
