import Image from 'next/image';
import type { ReactNode } from 'react';

/** The title of a page in the adventure look: a sky-blue band with the mascot at its side. */
export function PageBanner({
  title,
  subtitle,
  mascot,
  children,
}: {
  title: string;
  subtitle: string;
  /** File name under public/scene. */
  mascot: string;
  children?: ReactNode;
}) {
  return (
    <header className="adv-banner">
      <div className="adv-banner-text">
        <h1 className="adv-banner-title">{title}</h1>
        <p className="adv-banner-sub">{subtitle}</p>
        {children}
      </div>
      <Image
        src={`/scene/${mascot}`}
        alt=""
        width={130}
        height={190}
        priority
        className="adv-banner-mascot"
      />
    </header>
  );
}
