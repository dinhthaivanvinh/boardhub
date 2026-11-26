import { describe, expect, it } from 'vitest';
import { BOTS } from '../src/games/bots';
import { botLevelsOf, defaultBotLevelOf, GAME_IDS } from '../src/games/catalog';
import { parseMatchSetup } from '../src/game-runtime/match-setup';

describe('bot levels of each game', () => {
  it('are the ones the bot really has: a level it lacks would silently play like the weakest', () => {
    for (const id of GAME_IDS) {
      const bot = BOTS[id];
      expect([...botLevelsOf(id)], id).toEqual(bot.levels);
      expect(botLevelsOf(id), id).toContain(defaultBotLevelOf(id));
    }
  });

  it('chess starts at the easy level and alone has the beginner level', () => {
    expect(parseMatchSetup('chess', {}).level).toBe('easy');
    expect(parseMatchSetup('chess', { level: 'beginner' }).level).toBe('beginner');
    expect(parseMatchSetup('caro', {}).level).toBe('medium');
    expect(parseMatchSetup('caro', { level: 'beginner' }).level).toBe('medium');
  });
});
