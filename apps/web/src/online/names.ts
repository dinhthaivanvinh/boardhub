/**
 * Display labels for the people in a room. Names are not unique (two guests can pick "An"), so when
 * different users share a name, each gets a short id suffix: "An #3f2a", "An #b71c".
 */
export function nameLabels(people: readonly { userId: string; name: string }[]): Map<string, string> {
  const usersByName = new Map<string, Set<string>>();
  for (const p of people) {
    const set = usersByName.get(p.name) ?? new Set<string>();
    set.add(p.userId);
    usersByName.set(p.name, set);
  }
  const labels = new Map<string, string>();
  for (const p of people) {
    if (labels.has(p.userId)) continue;
    const shared = (usersByName.get(p.name)?.size ?? 0) > 1;
    labels.set(p.userId, shared ? `${p.name} #${shortId(p.userId)}` : p.name);
  }
  return labels;
}

const shortId = (userId: string) =>
  userId
    .replace(/[^0-9a-z]/gi, '')
    .slice(0, 4)
    .toLowerCase();
