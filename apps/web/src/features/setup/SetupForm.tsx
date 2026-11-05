'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { BOT_LEVELS, type BotLevel } from '@bg/bots';
import type { Seat } from '@bg/engine';
import { GAMES, type GameId } from '@/games/catalog';
import { CLIENT_GAMES } from '@/games/client-registry';
import { buildPlayUrl, type PlayMode } from '@/game-runtime/match-setup';
import { errorKey } from '@/game-runtime/error-key';
import { configOptionLabel } from '@/features/rules/config-labels';
import { useGameDisabled } from '@/features/admin/games-status';
import { getSocket, request } from '@/online/socket';
import {
  TIME_CONTROL_PRESETS,
  type DisconnectPolicy,
  type RoomSnapshot,
  type TimeControlPreset,
} from '@bg/protocol';

type Mode = PlayMode | 'online' | 'quick';
const PRESETS = Object.keys(TIME_CONTROL_PRESETS) as TimeControlPreset[];

function Choice({
  name,
  checked,
  onChange,
  children,
}: {
  name: string;
  checked: boolean;
  onChange(): void;
  children: ReactNode;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
        checked ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]' : 'border-[var(--border)]'
      }`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="accent-[var(--accent)]"
      />
      {children}
    </label>
  );
}

export function SetupForm({ gameId }: { gameId: GameId }) {
  const t = useTranslations();
  const router = useRouter();
  const { definition } = GAMES[gameId];
  const { configFields } = CLIENT_GAMES[gameId];

  const [mode, setMode] = useState<Mode>('bot');
  const [preset, setPreset] = useState<TimeControlPreset>('none');
  const [ranked, setRanked] = useState(true);
  const [policy, setPolicy] = useState<DisconnectPolicy>('forfeit');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paused = useGameDisabled(gameId);

  /** Creates a room on the game server and opens it (FR-ROOM-01). */
  const createRoom = async () => {
    setBusy(true);
    setError(null);
    try {
      const socket = await getSocket();
      const res = await request<{ room: RoomSnapshot }>(socket, 'room:create', {
        gameId,
        config,
        timeControl: TIME_CONTROL_PRESETS[preset],
        disconnectPolicy: policy,
        hostSeat: 0,
      });
      if (!res.ok) throw new Error(res.code);
      router.push(`/room/${res.data.room.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'network');
      setBusy(false);
    }
  };
  const [level, setLevel] = useState<BotLevel>('medium');
  const [humanSeat, setHumanSeat] = useState<Seat>(0);
  const [config, setConfig] = useState<Record<string, unknown>>(
    () => definition.configSchema.parse({}) as Record<string, unknown>,
  );

  const optionLabel = (key: string, value: string | number) => configOptionLabel(t, gameId, key, value);

  return (
    <form
      className="card flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (mode === 'online') void createRoom();
        else if (mode === 'quick') router.push(`/queue?game=${gameId}&tc=${preset}&ranked=${ranked ? 1 : 0}`);
        else router.push(buildPlayUrl(gameId, { mode, level, humanSeat, config }));
      }}
    >
      <h2 className="text-xl font-semibold">{t('setup.title')}</h2>
      {paused && (
        <p role="status" className="game-paused-note" data-testid="game-paused">
          {t('catalog.pausedNote')}
        </p>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t('setup.mode')}</legend>
        {(['bot', 'local', 'online', 'quick'] as const).map((m) => (
          <Choice
            key={m}
            name="mode"
            checked={mode === m}
            onChange={() => {
              setMode(m);
              // Quick-match games always have a clock.
              if (m === 'quick' && preset === 'none') setPreset('blitz');
            }}
          >
            {t(`setup.modes.${m}`)}
          </Choice>
        ))}
      </fieldset>

      {mode === 'bot' && (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">{t('setup.level')}</legend>
            <div className="grid grid-cols-3 gap-2">
              {BOT_LEVELS.map((l) => (
                <Choice key={l} name="level" checked={level === l} onChange={() => setLevel(l)}>
                  {t(`bot.level.${l}`)}
                </Choice>
              ))}
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">{t('setup.side')}</legend>
            <div className="grid grid-cols-2 gap-2">
              {[0, 1].map((seat) => (
                <Choice
                  key={seat}
                  name="side"
                  checked={humanSeat === seat}
                  onChange={() => setHumanSeat(seat)}
                >
                  <strong>{t(`games.${gameId}.pieces.${seat}`)}</strong>
                  {seat === 0 && <span className="text-[var(--muted)]">({t('setup.movesFirst')})</span>}
                </Choice>
              ))}
            </div>
          </fieldset>
        </>
      )}

      {(mode === 'online' || mode === 'quick') && (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-sm font-medium">
            {t(mode === 'quick' ? 'setup.quick' : 'setup.online')}
          </legend>
          {mode === 'quick' && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--accent)]"
                checked={ranked}
                onChange={(e) => setRanked(e.target.checked)}
              />
              {t('setup.ranked')}
            </label>
          )}
          <label className="flex items-center justify-between gap-3 text-sm">
            {t('setup.timeControl')}
            <select
              className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1"
              value={preset}
              onChange={(e) => setPreset(e.target.value as TimeControlPreset)}
            >
              {PRESETS.filter((p) => mode !== 'quick' || p !== 'none').map((p) => (
                <option key={p} value={p}>
                  {t(`setup.timeControls.${p}`)}
                </option>
              ))}
            </select>
          </label>
          {mode === 'online' && (
            <label className="flex items-center justify-between gap-3 text-sm">
              {t('setup.disconnectPolicy')}
              <select
                className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1"
                value={policy}
                onChange={(e) => setPolicy(e.target.value as DisconnectPolicy)}
              >
                {(['forfeit', 'bot'] as const).map((p) => (
                  <option key={p} value={p}>
                    {t(`setup.disconnectPolicies.${p}`)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </fieldset>
      )}

      {configFields.length > 0 && mode !== 'quick' && (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-sm font-medium">{t('setup.variant')}</legend>
          {configFields.map((field) => {
            const label = t(`games.${gameId}.config.${field.key}`);
            if (field.kind === 'boolean') {
              return (
                <label key={field.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--accent)]"
                    checked={Boolean(config[field.key])}
                    onChange={(e) => setConfig({ ...config, [field.key]: e.target.checked })}
                  />
                  {label}
                </label>
              );
            }
            return (
              <label key={field.key} className="flex items-center justify-between gap-3 text-sm">
                {label}
                <select
                  className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1"
                  value={String(config[field.key])}
                  onChange={(e) => {
                    const option = field.options.find((o) => String(o) === e.target.value);
                    setConfig({ ...config, [field.key]: option });
                  }}
                >
                  {field.options.map((o) => (
                    <option key={String(o)} value={String(o)}>
                      {optionLabel(field.key, o)}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </fieldset>
      )}

      {error && (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {t(errorKey(error))}
        </p>
      )}
      <button type="submit" className="btn btn-primary w-full py-3 text-base" disabled={busy || paused}>
        {busy
          ? t('online.creating')
          : mode === 'online'
            ? t('setup.createRoom')
            : mode === 'quick'
              ? t('setup.findMatch')
              : t('setup.start')}
      </button>
    </form>
  );
}
