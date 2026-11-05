import { useId } from 'react';
import type { Avatar as AvatarData } from '../schema';
import { inkOn, shade } from './color';
import { AccessoryShape, EyePair, MouthShape, PatternMarks } from './parts';
import { SPECIES_ART, type Paint } from './species';

export interface AvatarProps {
  avatar: AvatarData;
  /** Rendered size in px (the drawing scales). */
  size?: number;
  /** Accessible name; without it the picture is decorative. */
  label?: string;
  /** Fewer small details; automatic below 40 px. */
  detail?: 'full' | 'low';
  className?: string;
}

/**
 * An animal avatar drawn in layers inside a round badge:
 * background → shoulders → ears → head → pattern (clipped) → muzzle/cheeks → eyes → nose → mouth → accessory.
 * Pure: the same avatar always draws the same picture.
 */
export function Avatar({ avatar, size = 96, label, detail, className }: AvatarProps) {
  const uid = useId().replace(/:/g, '');
  const art = SPECIES_ART[avatar.species];
  const a = art.anchors;
  const paint: Paint = { body: avatar.body, accent: avatar.accent, dark: shade(avatar.body) };
  const full = (detail ?? (size < 40 ? 'low' : 'full')) === 'full';
  const badge = `badge-${uid}`;
  const headClip = `head-${uid}`;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      data-species={avatar.species}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <defs>
        <clipPath id={badge}>
          <circle cx={50} cy={50} r={50} />
        </clipPath>
        <clipPath id={headClip}>
          <path d={art.head} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${badge})`}>
        <rect width={100} height={100} fill={avatar.background} />
        <ellipse cx={50} cy={102} rx={31} ry={22} fill={paint.body} />
        <ellipse cx={50} cy={100} rx={art.belly ?? 14} ry={12} fill={paint.accent} />
        {art.back?.(paint)}
        <path d={art.head} fill={paint.body} />
        {full && (
          <g clipPath={`url(#${headClip})`}>
            <PatternMarks pattern={avatar.pattern} color={paint.dark} />
          </g>
        )}
        {art.front?.(paint)}
        <EyePair eyes={avatar.eyes} a={a} ink={inkOn(art.eyeGround(paint))} detail={full} />
        {art.nose(paint, a)}
        <MouthShape mouth={avatar.mouth} a={a} ink={inkOn(art.mouthGround(paint))} />
        <AccessoryShape accessory={avatar.accessory} a={a} color={avatar.accessoryColor} />
      </g>
    </svg>
  );
}
