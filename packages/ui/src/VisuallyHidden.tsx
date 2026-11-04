import type { ReactNode } from 'react';

const style = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;

/** Content for screen readers only. Pass `live` to announce changes. */
export function VisuallyHidden({ children, live }: { children: ReactNode; live?: boolean }) {
  return (
    <span style={style} {...(live ? { 'aria-live': 'polite' as const, 'aria-atomic': true } : {})}>
      {children}
    </span>
  );
}
