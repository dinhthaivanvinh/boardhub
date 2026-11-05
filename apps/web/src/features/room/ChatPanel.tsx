'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@bg/protocol';

export function ChatPanel({
  messages,
  myUserId,
  labels,
  onSend,
}: {
  messages: ChatMessage[];
  myUserId: string | null;
  labels?: Map<string, string>;
  onSend(text: string): Promise<string | null>;
}) {
  const t = useTranslations('chat');
  const [text, setText] = useState('');
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  return (
    <section className="card flex flex-col gap-2 py-3" aria-label={t('title')}>
      <h2 className="text-sm font-medium">{t('title')}</h2>
      <ol
        ref={listRef}
        className="flex max-h-56 min-h-24 flex-col gap-1 overflow-y-auto text-sm"
        aria-live="polite"
      >
        {messages.length === 0 && <li className="text-[var(--muted)]">{t('empty')}</li>}
        {messages.map((m) => (
          <li key={m.id} className="break-words">
            <span className={`font-medium ${m.from.userId === myUserId ? 'text-[var(--accent)]' : ''}`}>
              {labels?.get(m.from.userId) ?? m.from.name}:
            </span>{' '}
            {m.text}
          </li>
        ))}
      </ol>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const value = text.trim();
          if (!value) return;
          if ((await onSend(value)) === null) setText('');
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          placeholder={t('placeholder')}
          aria-label={t('placeholder')}
          className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm"
        />
        <button type="submit" className="btn px-3 py-1">
          {t('send')}
        </button>
      </form>
    </section>
  );
}
