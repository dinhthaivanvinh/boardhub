'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ACCESSORIES,
  Avatar,
  BACKGROUNDS,
  defaultAvatar,
  EYES,
  MOUTHS,
  NATURAL,
  PALETTE,
  PATTERNS,
  randomAvatar,
  SPECIES,
  type AvatarData,
  type PaletteColor,
  type Species,
} from '@bg/avatars';
import type { Rng } from '@bg/engine';
import { apiRequest } from '@/online/api';
import { ensureToken, useSession } from '@/online/session';
import { fetchMyAvatar, saveMyAvatar } from '@/office/avatar-api';
import type { PublicUser } from '@bg/protocol';

const TABS = ['species', 'colors', 'face', 'accessory', 'background'] as const;
type Tab = (typeof TABS)[number];
const SAVE_DELAY_MS = 600;

/** UI-only randomness for the "Random" button. */
const uiRng: Rng = {
  next: () => Math.random(),
  int: (a, b) => a + Math.floor(Math.random() * (b - a)),
  shuffle: (items) => [...items].sort(() => Math.random() - 0.5),
};

type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

/** "Thú của tôi": dress up your animal; every change is saved to your profile (docs/office/05 §5). */
export function AvatarStudio() {
  const t = useTranslations('avatar');
  const user = useSession((s) => s.user);
  const token = useSession((s) => s.token);
  const setUser = useSession((s) => s.setUser);
  const [avatar, setAvatar] = useState<AvatarData | null>(null);
  const [history, setHistory] = useState<AvatarData[]>([]);
  const [tab, setTab] = useState<Tab>('species');
  const [save, setSave] = useState<SaveState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load: the saved avatar, or the player's default one.
  useEffect(() => {
    let cancelled = false;
    void ensureToken().then(async (tok) => {
      const res = await fetchMyAvatar(tok);
      const me = useSession.getState().user;
      if (cancelled || !me) return;
      setAvatar(res.ok && res.data ? res.data : defaultAvatar(me.id));
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const persist = useCallback(
    (next: AvatarData) => {
      if (timer.current) clearTimeout(timer.current);
      setSave('saving');
      timer.current = setTimeout(async () => {
        const tok = token ?? (await ensureToken());
        const res = await saveMyAvatar(tok, next);
        setSave(res.ok ? 'saved' : 'failed');
        if (!res.ok) timer.current = setTimeout(() => persist(next), 3_000);
      }, SAVE_DELAY_MS);
    },
    [token],
  );
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const change = (next: AvatarData) => {
    if (!avatar) return;
    setHistory((h) => [...h.slice(-29), avatar]);
    setAvatar(next);
    persist(next);
  };
  const patch = (p: Partial<AvatarData>) => avatar && change({ ...avatar, ...p });
  const undo = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory((h) => h.slice(0, -1));
    setAvatar(previous);
    persist(previous);
  };

  if (!avatar || !user) {
    return <p className="px-4 py-20 text-center text-[var(--muted)]">{t('loading')}</p>;
  }

  /** Switching animal keeps your colours, unless they were simply the old animal's own colours. */
  const pickSpecies = (species: Species) => {
    const old = NATURAL[avatar.species];
    const natural = avatar.body === old.body && avatar.accent === old.accent;
    patch(natural ? { species, body: NATURAL[species].body, accent: NATURAL[species].accent } : { species });
  };
  const colorName = (c: PaletteColor) => t(`colors.${PALETTE.indexOf(c)}`);
  const label = t('preview', { name: user.displayName, species: t(`species.${avatar.species}`) });

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] md:py-12">
      <section className="flex flex-col items-center gap-4 md:sticky md:top-20 md:self-start">
        <h1 className="self-start text-2xl font-bold tracking-tight md:text-3xl">{t('title')}</h1>
        <div className="studio-preview">
          <Avatar avatar={avatar} size={220} label={label} />
        </div>
        <NameField user={user} token={token} onSaved={setUser} />
        <div className="flex w-full gap-2">
          <button type="button" className="btn flex-1" onClick={() => change(randomAvatar(uiRng))}>
            🎲 {t('random')}
          </button>
          <button type="button" className="btn flex-1" onClick={undo} disabled={history.length === 0}>
            ↶ {t('undo')}
          </button>
        </div>
        <p className="min-h-5 text-sm text-[var(--muted)]" role="status" data-testid="save-state">
          {save === 'saving'
            ? t('saving')
            : save === 'saved'
              ? `✓ ${t('saved')}`
              : save === 'failed'
                ? t('saveFailed')
                : ''}
        </p>
        <p className="text-sm text-[var(--muted)]">{t('intro')}</p>
      </section>

      <section>
        <div role="tablist" aria-label={t('title')} className="studio-tabs">
          {TABS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`studio-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`studio-panel-${id}`}
              className="studio-tab"
              onClick={() => setTab(id)}
            >
              {t(`tabs.${id}`)}
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          id={`studio-panel-${tab}`}
          aria-labelledby={`studio-tab-${tab}`}
          className="mt-4"
        >
          {tab === 'species' && (
            <OptionGrid label={t('tabs.species')}>
              {SPECIES.map((s) => (
                <Option
                  key={s}
                  selected={avatar.species === s}
                  name={t(`species.${s}`)}
                  onPick={() => pickSpecies(s)}
                >
                  <Avatar
                    avatar={
                      avatar.species === s ? avatar : { ...avatar, species: s, ...pickColors(avatar, s) }
                    }
                    size={72}
                  />
                </Option>
              ))}
            </OptionGrid>
          )}
          {tab === 'colors' && (
            <>
              <Swatches
                label={t('groups.body')}
                colors={PALETTE}
                value={avatar.body}
                name={colorName}
                onPick={(body) => patch({ body })}
              />
              <Swatches
                label={t('groups.accent')}
                colors={PALETTE}
                value={avatar.accent}
                name={colorName}
                onPick={(accent) => patch({ accent })}
              />
              <OptionGrid label={t('groups.pattern')}>
                {PATTERNS.map((p) => (
                  <Option
                    key={p}
                    selected={avatar.pattern === p}
                    name={t(`pattern.${p}`)}
                    onPick={() => patch({ pattern: p })}
                  >
                    <Avatar avatar={{ ...avatar, pattern: p }} size={72} />
                  </Option>
                ))}
              </OptionGrid>
            </>
          )}
          {tab === 'face' && (
            <>
              <OptionGrid label={t('groups.eyes')}>
                {EYES.map((e) => (
                  <Option
                    key={e}
                    selected={avatar.eyes === e}
                    name={t(`eyes.${e}`)}
                    onPick={() => patch({ eyes: e })}
                  >
                    <Avatar avatar={{ ...avatar, eyes: e, accessory: 'none' }} size={72} />
                  </Option>
                ))}
              </OptionGrid>
              <OptionGrid label={t('groups.mouth')}>
                {MOUTHS.map((m) => (
                  <Option
                    key={m}
                    selected={avatar.mouth === m}
                    name={t(`mouth.${m}`)}
                    onPick={() => patch({ mouth: m })}
                  >
                    <Avatar avatar={{ ...avatar, mouth: m }} size={72} />
                  </Option>
                ))}
              </OptionGrid>
            </>
          )}
          {tab === 'accessory' && (
            <>
              <OptionGrid label={t('groups.accessory')}>
                {ACCESSORIES.map((acc) => (
                  <Option
                    key={acc}
                    selected={avatar.accessory === acc}
                    name={t(`accessory.${acc}`)}
                    onPick={() => patch({ accessory: acc })}
                  >
                    <Avatar avatar={{ ...avatar, accessory: acc }} size={72} />
                  </Option>
                ))}
              </OptionGrid>
              <Swatches
                label={t('groups.accessoryColor')}
                colors={PALETTE}
                value={avatar.accessoryColor}
                name={colorName}
                onPick={(accessoryColor) => patch({ accessoryColor })}
              />
            </>
          )}
          {tab === 'background' && (
            <Swatches
              label={t('groups.background')}
              colors={[...BACKGROUNDS, ...PALETTE.filter((c) => !BACKGROUNDS.includes(c))]}
              value={avatar.background}
              name={colorName}
              onPick={(background) => patch({ background })}
            />
          )}
        </div>
      </section>
    </div>
  );
}

/** Colours for a species preview: its own colours if the avatar still has the current animal's own. */
function pickColors(avatar: AvatarData, species: Species) {
  const old = NATURAL[avatar.species];
  return avatar.body === old.body && avatar.accent === old.accent
    ? { body: NATURAL[species].body, accent: NATURAL[species].accent }
    : {};
}

function OptionGrid({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="mb-6">
      <legend className="mb-2 text-sm font-semibold">{label}</legend>
      <div className="studio-options">{children}</div>
    </fieldset>
  );
}

function Option({
  selected,
  name,
  onPick,
  children,
}: {
  selected: boolean;
  name: string;
  onPick(): void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="studio-option"
      aria-pressed={selected}
      aria-label={name}
      title={name}
      onClick={onPick}
    >
      {children}
      <span className="studio-option-name" aria-hidden="true">
        {name}
      </span>
    </button>
  );
}

function Swatches({
  label,
  colors,
  value,
  name,
  onPick,
}: {
  label: string;
  colors: readonly PaletteColor[];
  value: PaletteColor;
  name(c: PaletteColor): string;
  onPick(c: PaletteColor): void;
}) {
  return (
    <fieldset className="mb-6">
      <legend className="mb-2 text-sm font-semibold">{label}</legend>
      <div className="studio-swatches">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            className="studio-swatch"
            style={{ background: c }}
            aria-pressed={value === c}
            aria-label={name(c)}
            title={name(c)}
            onClick={() => onPick(c)}
          />
        ))}
      </div>
    </fieldset>
  );
}

function NameField({
  user,
  token,
  onSaved,
}: {
  user: PublicUser;
  token: string | null;
  onSaved(u: PublicUser): void;
}) {
  const t = useTranslations('avatar');
  const [name, setName] = useState(user.displayName);
  const commit = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed === user.displayName || !token) return;
    const res = await apiRequest<PublicUser>('PATCH', '/api/me', { displayName: trimmed }, token);
    if (res.ok) onSaved(res.data);
  };
  return (
    <label className="flex w-full flex-col gap-1 text-sm font-medium">
      {t('name')}
      <input
        value={name}
        maxLength={24}
        minLength={2}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => e.key === 'Enter' && void commit()}
        className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
      />
    </label>
  );
}
