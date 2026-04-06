import React, { useMemo } from 'react';

function computeInitials(name) {
  const s = (name || '').toString().trim();
  if (!s) return '—';
  return s
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

export default function AvatarInitials({
  name,
  dimensionPx = 40, // px
  className = '',
}) {
  const initials = useMemo(() => computeInitials(name), [name]);
  const px = Number.isFinite(Number(dimensionPx)) ? Number(dimensionPx) : 40;
  return (
    <div
      className={[
        'rounded-full bg-gradient-to-br from-primary/80 to-amber-400 text-white font-bold flex items-center justify-center',
        className,
      ].join(' ')}
      style={{ inlineSize: px, blockSize: px }}
      aria-label={name ? `Avatar for ${name}` : 'Avatar'}
    >
      <span className="text-xs md:text-sm">{initials}</span>
    </div>
  );
}

