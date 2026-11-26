'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { MAX_RANGE_DAYS, vnDay, type DateRange } from '@bg/protocol';
import { PRESETS, presetRange, validRange, type Preset } from '../range';

export interface RangeChoice {
  preset: Preset | 'custom';
  range: DateRange;
}

export const initialRange = (preset: Preset): RangeChoice => ({ preset, range: presetRange(preset) });

/** One row of filters above everything it applies to: the presets first, then a range of the admin's own. */
export function RangeFilter({ value, onChange }: { value: RangeChoice; onChange(next: RangeChoice): void }) {
  const t = useTranslations('admin.range');
  const [custom, setCustom] = useState(value.preset === 'custom');
  const [draft, setDraft] = useState(value.range);
  const [invalid, setInvalid] = useState(false);
  const errorId = useId();
  const today = vnDay(Date.now());

  return (
    <div className="admin-filter">
      <div className="admin-segment" role="group" aria-label={t('label')}>
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-pressed={!custom && value.preset === preset}
            onClick={() => {
              setCustom(false);
              setInvalid(false);
              const range = presetRange(preset);
              setDraft(range);
              onChange({ preset, range });
            }}
            data-testid={`range-${preset}`}
          >
            {t(preset)}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={custom}
          aria-expanded={custom}
          onClick={() => setCustom(true)}
          data-testid="range-custom"
        >
          {t('custom')}
        </button>
      </div>
      {custom && (
        <form
          className="admin-custom-range"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const ok = validRange(draft);
            setInvalid(!ok);
            if (ok) onChange({ preset: 'custom', range: draft });
          }}
        >
          {(['from', 'to'] as const).map((side) => (
            <label key={side}>
              <span>{t(side)}</span>
              <input
                type="date"
                max={today}
                value={draft[side]}
                aria-invalid={invalid}
                aria-describedby={invalid ? errorId : undefined}
                onChange={(e) => setDraft({ ...draft, [side]: e.target.value })}
                data-testid={`range-${side}`}
              />
            </label>
          ))}
          <button type="submit" className="btn btn-primary" data-testid="range-apply">
            {t('apply')}
          </button>
          {invalid && (
            <p id={errorId} role="alert" className="admin-field-error">
              {t('invalid', { max: MAX_RANGE_DAYS })}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
