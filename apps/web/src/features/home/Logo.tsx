/** Four tiles in the colours of the pieces: the BoardHub mark. */
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <rect x="2" y="2" width="13" height="13" rx="4" fill="#f97316" />
      <rect x="17" y="2" width="13" height="13" rx="4" fill="#1d4ed8" />
      <rect x="2" y="17" width="13" height="13" rx="4" fill="#15803d" />
      <rect x="17" y="17" width="13" height="13" rx="4" fill="#b91c1c" />
      <circle cx="23.5" cy="23.5" r="3.5" fill="#fff" opacity="0.9" />
    </svg>
  );
}
