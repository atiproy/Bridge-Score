import type { CSSProperties } from 'react';

/**
 * The Athelite mark, rendered as a CSS mask so it always comes out as a solid
 * silhouette in the current text colour — correct in both themes with a
 * single source file, no separate light/dark asset needed.
 */
interface Props {
  className?: string;
  /** Defaults to the current text colour; pass a CSS colour to override. */
  color?: string;
  title?: string;
}

export function AthleteMark({ className = '', color = 'currentColor', title = 'Athelite' }: Props) {
  const maskImage = 'url(/brand/athelite-logo.svg)';
  const style: CSSProperties = {
    display: 'inline-block',
    backgroundColor: color,
    WebkitMaskImage: maskImage,
    maskImage,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
  };

  return <span role="img" aria-label={title} className={className} style={style} />;
}
