import { LESSON_IDS } from './data';
import { JOURNEY_LESSONS } from './journey';
import { PRACTICE_LESSON_IDS, practiceId } from './practice';
import { PUZZLES } from './puzzles';

/** What a child can finish, by kind: the ids the progress stores. No React here, so the server can use it too. */
export const LEARN_ITEMS = {
  lesson: new Set<string>([...LESSON_IDS, ...JOURNEY_LESSONS]) as ReadonlySet<string>,
  practice: new Set<string>(PRACTICE_LESSON_IDS.map(practiceId)) as ReadonlySet<string>,
  puzzle: new Set<string>(PUZZLES.map((p) => p.id)) as ReadonlySet<string>,
};
