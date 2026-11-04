'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { BOT_LEVELS, type BotLevel } from '@bg/bots';
import type { Seat } from '@bg/engine';
import { GAMES, type GameId } from '@/games/catalog';
import { CLIENT_GAMES } from '@/games/client-registry';
import { buildPlayUrl, type PlayMode } from '@/game-runtime/match-setup';

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

  const [mode, setMode] = useState<PlayMode>('bot');
  const [level, setLevel] = useState<BotLevel>('medium');
  const [humanSeat, setHumanSeat] = useState<Seat>(0);
  const [config, setConfig] = useState<Record<string, unknown>>(
    () => definition.configSchema.parse({}) as Record<string, unknown>,
  );

  const optionLabel = (key: string, value: string | number) => {
    const k = `games.${gameId}.config.${key}Options.${value}`;
    return t.has(k) ? t(k) : String(value);
  };

  return (
    <form
      className="card flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(buildPlayUrl(gameId, { mode, level, humanSeat, config }));
      }}
    >
      <h2 className="text-xl font-semibold">{t('setup.title')}</h2>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t('setup.mode')}</legend>
        {(['bot', 'local'] as const).map((m) => (
          <Choice key={m} name="mode" checked={mode === m} onChange={() => setMode(m)}>
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

      {configFields.length > 0 && (
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

      <button type="submit" className="btn btn-primary w-full py-3 text-base">
        {t('setup.start')}
      </button>
    </form>
  );
}
