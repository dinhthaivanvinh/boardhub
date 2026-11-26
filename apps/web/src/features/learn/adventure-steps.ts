import { JOURNEY } from '@bg/game-chess';

function stage(id: string): string[] {
  return JOURNEY.find((s) => s.id === id)?.lessons ?? [];
}

/** The eight places of the adventure map: the lessons that belong to each (the last one has no lesson: it is play). */
export const ADVENTURE_STEPS = [
  { key: 'coordinates', href: '/learn/chess/coordinates', lessons: stage('start') },
  { key: 'pieces', href: '/learn/chess/pawn', lessons: stage('pieces') },
  { key: 'capture', href: '/learn/chess/capture', lessons: stage('rules').slice(0, 1) },
  { key: 'checkmate', href: '/learn/chess/checkmate', lessons: stage('rules').slice(1) },
  { key: 'special', href: '/learn/chess/castling', lessons: stage('specials') },
  { key: 'tactics', href: '/learn/chess/tactics', lessons: stage('tactics') },
  { key: 'openings', href: '/learn/chess/italian', lessons: stage('openings') },
  { key: 'play', href: '/games/chess', lessons: [] as string[] },
] as const;

export type StepKey = (typeof ADVENTURE_STEPS)[number]['key'];
