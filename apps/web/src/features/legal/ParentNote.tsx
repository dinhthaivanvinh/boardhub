import { useTranslations } from 'next-intl';

/** Shown on the registration forms. Opens the policy in a new tab so what was typed stays. */
export function ParentNote() {
  const t = useTranslations('account');
  return (
    <p className="text-sm text-[var(--muted)]" data-testid="parent-note">
      {t('parentNote')}{' '}
      <a href="/privacy" target="_blank" rel="noopener" className="underline">
        {t('privacyLink')}
      </a>
    </p>
  );
}
