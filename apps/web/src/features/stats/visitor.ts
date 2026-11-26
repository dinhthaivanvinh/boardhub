const ID_KEY = 'bh.visitor.v1';
const ACTIVE_KEY = 'bh.visit.active.v1';

/** Away this long or longer, and coming back is a new session. */
export const SESSION_GAP_MS = 30 * 60_000;

type Store = Pick<Storage, 'getItem' | 'setItem'>;

/** A random id this browser made up: no cookie, no address, no name. Throws when storage is blocked. */
export function visitorId(store: Store = window.localStorage): string {
  let id = store.getItem(ID_KEY);
  if (!id || !/^[A-Za-z0-9-]{16,64}$/.test(id)) {
    id = crypto.randomUUID();
    store.setItem(ID_KEY, id);
  }
  return id;
}

/** Remembers that the child is here now; true when this starts a new session. */
export function touchSession(now: number, store: Store = window.localStorage): boolean {
  const last = Number(store.getItem(ACTIVE_KEY));
  store.setItem(ACTIVE_KEY, String(now));
  return !last || now - last >= SESSION_GAP_MS;
}
