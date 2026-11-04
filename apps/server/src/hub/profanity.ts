// Basic chat filter (FR-ROOM-03). Deliberately small; a proper moderation service can replace it later.
const WORDS = ['đụ', 'địt', 'đéo', 'lồn', 'cặc', 'đĩ', 'fuck', 'shit', 'bitch', 'cunt'];

const PATTERN = new RegExp(`(^|[^\\p{L}])(${WORDS.join('|')})(?=$|[^\\p{L}])`, 'giu');

export function maskProfanity(text: string): string {
  return text.replace(PATTERN, (_m, before: string, word: string) => before + '*'.repeat(word.length));
}
