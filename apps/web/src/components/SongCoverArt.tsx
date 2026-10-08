import React, { useState } from 'react';
import { Music2 } from 'lucide-react';

interface SongCoverArtProps {
  src?: string | null;
  alt?: string;
  size?: number | string;
  borderRadius?: number | string;
  iconSize?: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export const DEFAULT_COVER_BG = '#282828';

export const SongCoverArt: React.FC<SongCoverArtProps> = ({
  src,
  alt = 'Cover Art',
  size = '100%',
  borderRadius = 4,
  iconSize = 24,
  className = '',
  style = {},
  children,
}) => {
  const [hasError, setHasError] = useState(false);

  const customAspectRatio = (style as Record<string, unknown> | undefined)?.aspectRatio;
  const hasAspectRatio = Boolean(customAspectRatio);
  const isPercentSize = typeof size === 'string' && size.includes('%');

  const containerStyle: React.CSSProperties = {
    width: size,
    height: hasAspectRatio || isPercentSize ? 'auto' : size,
    aspectRatio: (customAspectRatio as any) || (isPercentSize ? '1 / 1' : undefined),
    borderRadius,
    backgroundColor: DEFAULT_COVER_BG,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0,
    ...style,
  };

  const showImage = Boolean(src && !hasError);

  return (
    <div className={`song-cover-art ${className}`} style={containerStyle}>
      {showImage ? (
        <img
          src={src as string}
          alt={alt}
          onError={() => setHasError(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
          loading="lazy"
        />
      ) : (
        <Music2 size={iconSize} color="rgba(255, 255, 255, 0.4)" />
      )}
      {children}
    </div>
  );
};
