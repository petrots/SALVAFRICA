import React from 'react';
import { AnimatePresence, motion } from 'motion/react';

interface CoastalJarProps {
  percentage: number;
  justDepositedKey: number;
  darkBackdrop?: boolean;
}

export const CoastalJar: React.FC<CoastalJarProps> = ({
  percentage,
  justDepositedKey,
  darkBackdrop = true,
}) => {
  const clamped = Math.max(0, Math.min(100, percentage));
  // Liquid spans y=252 (0%) up to y=78 (100%) inside jar body
  const fillTopY = 252 - (clamped / 100) * 174;

  return (
    <div className="relative flex items-center justify-center w-[186px] h-[226px] sm:w-[210px] sm:h-[252px] shrink-0 select-none">
      {/* Subtle warm sunset aura behind jar */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-4 rounded-full bg-radial from-[#E86A52]/25 via-[#E09F3E]/10 to-transparent blur-xl"
      />

      {/* Dropping coin micro-animation on new deposit */}
      <AnimatePresence>
        {justDepositedKey > 0 && (
          <motion.div
            key={justDepositedKey}
            initial={{ y: -28, opacity: 0, scale: 0.7 }}
            animate={{ y: 38, opacity: [0, 1, 1, 0], scale: [0.85, 1.05, 0.9] }}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-[#F7CE78] to-[#D9912A] border-2 border-[#FAF6F0] shadow-md text-xs font-bold text-[#122638]"
            aria-hidden="true"
          >
            €
          </motion.div>
        )}
      </AnimatePresence>

      <svg
        viewBox="0 0 220 272"
        className="relative z-10 w-full h-full overflow-visible"
        role="img"
        aria-label={`Salvadanaio SALVAFRICA riempito al ${Math.round(clamped)}%`}
      >
        <defs>
          <clipPath id="jar-interior-clip">
            <path d="M 52 74 Q 35 88 35 114 L 35 224 Q 35 254 66 254 L 154 254 Q 185 254 185 224 L 185 114 Q 185 88 168 74 Z" />
          </clipPath>

          <linearGradient id="jar-glass-backdrop" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={darkBackdrop ? '#1E3F58' : '#FAF6F0'} stopOpacity={darkBackdrop ? '0.88' : '0.96'} />
            <stop offset="55%" stopColor={darkBackdrop ? '#274E6B' : '#FDE7DC'} stopOpacity={darkBackdrop ? '0.82' : '0.96'} />
            <stop offset="100%" stopColor={darkBackdrop ? '#344A5E' : '#F8C9B9'} stopOpacity={darkBackdrop ? '0.9' : '0.96'} />
          </linearGradient>

          <linearGradient id="jar-sun-disc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F7C76E" />
            <stop offset="100%" stopColor="#E86A52" />
          </linearGradient>

          <linearGradient id="jar-ocean-deep" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3AA5C8" />
            <stop offset="48%" stopColor="#1D7596" />
            <stop offset="100%" stopColor="#0F465E" />
          </linearGradient>

          <linearGradient id="jar-wave-coral" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#E86A52" stopOpacity="0.72" />
            <stop offset="50%" stopColor="#F5A65B" stopOpacity="0.82" />
            <stop offset="100%" stopColor="#E86A52" stopOpacity="0.72" />
          </linearGradient>

          <linearGradient id="cork-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#C18C59" />
            <stop offset="50%" stopColor="#DEB183" />
            <stop offset="100%" stopColor="#B37D4C" />
          </linearGradient>

          <linearGradient id="rim-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#F2ECE3" />
            <stop offset="50%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#E6DDD1" />
          </linearGradient>
        </defs>

        {/* Grounded contact shadow */}
        <ellipse
          cx="110"
          cy="261"
          rx="66"
          ry="7"
          fill={darkBackdrop ? '#081520' : '#D8CEC0'}
          opacity={darkBackdrop ? '0.45' : '0.75'}
        />

        {/* Jar interior translucent sunset sky */}
        <path
          d="M 52 74 Q 35 88 35 114 L 35 224 Q 35 254 66 254 L 154 254 Q 185 254 185 224 L 185 114 Q 185 88 168 74 Z"
          fill="url(#jar-glass-backdrop)"
        />

        {/* Subtle travel compass ring inside upper glass */}
        <g clipPath="url(#jar-interior-clip)" opacity={darkBackdrop ? '0.16' : '0.12'}>
          <circle cx="110" cy="146" r="46" fill="none" stroke="#FAF6F0" strokeWidth="1" strokeDasharray="3 4" />
          <path d="M110 92 L113 102 L110 100 L107 102 Z" fill="#FAF6F0" />
        </g>

        {/* Warm African Sunset Disc behind waves */}
        <g clipPath="url(#jar-interior-clip)">
          <circle
            className="animate-sun-float"
            cx="110"
            cy={Math.max(118, Math.min(206, fillTopY - 8))}
            r="34"
            fill="url(#jar-sun-disc)"
            opacity="0.28"
          />
          <circle
            className="animate-sun-float"
            cx="110"
            cy={Math.max(118, Math.min(206, fillTopY - 8))}
            r="22"
            fill="url(#jar-sun-disc)"
            opacity="0.72"
          />
        </g>

        {/* Dynamic Ocean Liquid Fill */}
        <g clipPath="url(#jar-interior-clip)">
          {clamped > 0 && (
            <g
              style={{
                transform: `translateY(${fillTopY}px)`,
                transition: 'transform 750ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {/* Back Coral Sunset Reflection Wave */}
              <path
                className="animate-wave-reverse"
                d="M -60 4 Q -15 -8 30 4 T 120 4 T 210 4 T 300 4 T 390 4 L 390 220 L -60 220 Z"
                fill="url(#jar-wave-coral)"
              />
              {/* Main Deep Ocean Liquid */}
              <path
                className="animate-wave-slow"
                d="M -60 8 Q -15 20 30 8 T 120 8 T 210 8 T 300 8 T 390 8 L 390 220 L -60 220 Z"
                fill="url(#jar-ocean-deep)"
              />
              {/* Subtle foam crest line */}
              <path
                className="animate-wave-slow"
                d="M -60 8 Q -15 20 30 8 T 120 8 T 210 8 T 300 8 T 390 8"
                fill="none"
                stroke="#FAF6F0"
                strokeOpacity="0.45"
                strokeWidth="1.5"
              />

              {/* Golden sun-coins resting inside ocean */}
              {clamped >= 6 && (
                <g opacity="0.95">
                  <circle cx="72" cy="40" r="7.5" fill="#D9912A" />
                  <circle cx="72" cy="40" r="5" fill="#F7CE78" />
                </g>
              )}
              {clamped >= 28 && (
                <g opacity="0.95">
                  <circle cx="144" cy="54" r="8.5" fill="#D9912A" />
                  <circle cx="144" cy="54" r="5.5" fill="#F7CE78" />
                </g>
              )}
              {clamped >= 55 && (
                <g opacity="0.95">
                  <circle cx="106" cy="70" r="9.5" fill="#D9912A" />
                  <circle cx="106" cy="70" r="6" fill="#F7CE78" />
                </g>
              )}
            </g>
          )}
        </g>

        {/* Outer Sculpted Glass Rim */}
        <path
          d="M 52 74 Q 34 88 34 114 L 34 224 Q 34 256 66 256 L 154 256 Q 186 256 186 224 L 186 114 Q 186 88 168 74"
          fill="none"
          stroke={darkBackdrop ? '#FAF6F0' : '#122638'}
          strokeOpacity={darkBackdrop ? '0.32' : '0.2'}
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Glass Specular Reflections */}
        <path
          d="M 46 108 L 46 218 Q 46 234 58 242"
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity={darkBackdrop ? '0.35' : '0.7'}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M 173 114 L 173 162"
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity={darkBackdrop ? '0.18' : '0.45'}
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Etched percentage gauge ticks */}
        {[25, 50, 75].map((tick) => {
          const ty = 252 - (tick / 100) * 174;
          const reached = clamped >= tick;
          return (
            <line
              key={tick}
              x1="168"
              y1={ty}
              x2="181"
              y2={ty}
              stroke="#FAF6F0"
              strokeOpacity={reached ? 0.85 : 0.3}
              strokeWidth="2"
              strokeLinecap="round"
            />
          );
        })}

        {/* Ceramic Collar Rim */}
        <rect
          x="50"
          y="58"
          width="120"
          height="16"
          rx="8"
          fill="url(#rim-grad)"
          stroke={darkBackdrop ? '#122638' : '#E6DDD1'}
          strokeOpacity={darkBackdrop ? '0.25' : '1'}
          strokeWidth="2"
        />

        {/* Warm Cork Stopper with Coin Slot */}
        <path
          d="M 66 36 Q 66 28 74 28 L 146 28 Q 154 28 154 36 L 158 58 L 62 58 Z"
          fill="url(#cork-grad)"
        />
        <rect x="88" y="37" width="44" height="5" rx="2.5" fill="#4E2F16" />
      </svg>
    </div>
  );
};
