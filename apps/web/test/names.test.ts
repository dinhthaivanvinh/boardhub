import { describe, expect, it } from 'vitest';
import { nameLabels } from '../src/online/names';

describe('nameLabels', () => {
  it('keeps unique names as they are', () => {
    const labels = nameLabels([
      { userId: 'a1', name: 'An' },
      { userId: 'b2', name: 'Bình' },
    ]);
    expect([...labels.values()]).toEqual(['An', 'Bình']);
  });

  it('adds a short id when different people share a name', () => {
    const labels = nameLabels([
      { userId: '3f2a9c00-0000-4000-8000-000000000000', name: 'An' },
      { userId: 'b71c1d00-0000-4000-8000-000000000000', name: 'An' },
      { userId: 'c0ffee00-0000-4000-8000-000000000000', name: 'Bình' },
    ]);
    expect(labels.get('3f2a9c00-0000-4000-8000-000000000000')).toBe('An #3f2a');
    expect(labels.get('b71c1d00-0000-4000-8000-000000000000')).toBe('An #b71c');
    expect(labels.get('c0ffee00-0000-4000-8000-000000000000')).toBe('Bình');
  });

  it('the same person listed twice (seat and chat) is not a duplicate', () => {
    const labels = nameLabels([
      { userId: 'a1', name: 'An' },
      { userId: 'a1', name: 'An' },
    ]);
    expect(labels.get('a1')).toBe('An');
  });
});
