const PATHS = {
  dashboard: 'M4 13h7V4H4zm9 7h7v-9h-7zm0-16v5h7V4zM4 20h7v-5H4z',
  visitors: 'M3 20h18M6 17v-5m6 5V6m6 11v-8',
  reports: 'M5 21V4m0 1h11l-2 4 2 4H5',
  settings: 'M4 7h10m4 0h2M4 17h4m4 0h8M16 5v4m-6 6v4',
  users:
    'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9a6 6 0 0 1 12 0m1-9a3 3 0 0 0 0-6m2 15a6 6 0 0 0-3-5',
  account: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
  guest: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0M4 4l16 16',
  active: 'M3 12h4l3-7 4 14 3-7h4',
  lessons: 'M4 5a8 4 0 0 1 8 1 8 4 0 0 1 8-1v13a8 4 0 0 0-8 1 8 4 0 0 0-8-1zm8 1v13',
  done: 'M20 6 9 17l-5-5',
  chess: 'M8 21h8M9 21l1-8H8l1-3a3.500 3.500 0 1 1 6 0l1 3h-2l1 8',
  puzzle: 'M9 4h6v3a2 2 0 1 0 0 4h5v9H4v-9h5a2 2 0 1 0 0-4z',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zm4 5h4',
  menu: 'M4 6h16M4 12h16M4 18h16',
  collapse: 'M15 6l-6 6 6 6',
  expand: 'M9 6l6 6-6 6',
} as const;

export type IconName = keyof typeof PATHS;

/** One line style for the whole admin area. */
export function AdminIcon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
