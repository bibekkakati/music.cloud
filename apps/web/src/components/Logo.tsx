import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  showText?: boolean;
  textSize?: number;
  textColor?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 32,
  className = '',
  style = {},
  showText = false,
  textSize = 16,
  textColor = '#ffffff',
}) => {
  return (
    <div
      className={`music-cloud-logo-container ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        textDecoration: 'none',
        flexShrink: 0,
        ...style,
      }}
    >
      {/* High-Resolution Vector Badge: Cloud wearing Headset */}
      <svg
        viewBox="0 0 512 512"
        width={size}
        height={size}
        style={{ display: 'block', flexShrink: 0 }}
      >
        <defs>
          <linearGradient id="mcLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22e569" />
            <stop offset="100%" stopColor="#12923f" />
          </linearGradient>
          <filter id="mcLogoGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="10" stdDeviation="16" floodColor="#000000" floodOpacity="0.32" />
          </filter>
        </defs>

        {/* Outer Circular Emerald Badge */}
        <circle cx="256" cy="256" r="240" fill="url(#mcLogoGrad)" filter="url(#mcLogoGlow)" />

        {/* Headset Headband */}
        <path
          d="M 124 265 C 124 96, 388 96, 388 265"
          fill="none"
          stroke="#0d1511"
          strokeWidth="26"
          strokeLinecap="round"
        />

        {/* Headband Top Comfort Cushion */}
        <path
          d="M 184 136 C 224 116, 288 116, 328 136"
          fill="none"
          stroke="#0d1511"
          strokeWidth="40"
          strokeLinecap="round"
        />

        {/* Headband Adjustment Sliders */}
        <rect x="114" y="224" width="20" height="26" rx="6" fill="#0d1511" />
        <rect x="378" y="224" width="20" height="26" rx="6" fill="#0d1511" />

        {/* Fluffy White Silhouette Cloud */}
        <path
          d="M 175 352 C 142 352, 122 328, 122 296 C 122 268, 142 246, 170 240 C 176 196, 212 162, 258 162 C 302 162, 338 194, 346 236 C 372 242, 390 264, 390 292 C 390 326, 366 352, 334 352 Z"
          fill="#ffffff"
        />

        {/* 5 Audio Equalizer Frequency Bars */}
        <rect x="188" y="258" width="18" height="56" rx="9" fill="#0d1511" />
        <rect x="222" y="230" width="18" height="84" rx="9" fill="#0d1511" />
        <rect x="256" y="200" width="18" height="114" rx="9" fill="#0d1511" />
        <rect x="290" y="234" width="18" height="80" rx="9" fill="#0d1511" />
        <rect x="324" y="264" width="18" height="50" rx="9" fill="#0d1511" />

        {/* Headset Over-Ear Cushions & Cups */}
        <rect x="118" y="246" width="16" height="84" rx="8" fill="#1b2520" />
        <rect x="94" y="238" width="32" height="100" rx="16" fill="#0d1511" />
        <circle cx="110" cy="288" r="7" fill="#22e569" />

        <rect x="378" y="246" width="16" height="84" rx="8" fill="#1b2520" />
        <rect x="386" y="238" width="32" height="100" rx="16" fill="#0d1511" />
        <circle cx="402" cy="288" r="7" fill="#22e569" />
      </svg>

      {showText && (
        <span
          style={{
            fontSize: textSize,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: textColor,
            whiteSpace: 'nowrap',
          }}
        >
          Music Cloud
        </span>
      )}
    </div>
  );
};
