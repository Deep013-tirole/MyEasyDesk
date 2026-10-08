import React from 'react';

export interface MyEasyDeskBrandProps {
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Whether to render the official tagline beneath the brand */
  showTagline?: boolean;
  /** Inverted mode for dark/navy backgrounds (e.g. Footer) */
  inverted?: boolean;
  /** Optional custom CSS classes */
  className?: string;
  /** Optional click handler (e.g. navigation to home) */
  onClick?: () => void;
}

/**
 * MyEasyDeskBrand
 * 
 * Official text-based brand mark for My EasyDesk.
 * Recreated purely in HTML + CSS text matching the exact reference specifications:
 * - "My": Expressive, flowing script styling in vivid electric blue
 * - "Easy": Bold, modern sans-serif in deep midnight navy (or pure white when inverted)
 * - "Desk": Bold, modern sans-serif in vivid electric blue (or cyan-sky when inverted)
 * - Tagline: "Your Online Work, Done Easily" directly below
 */
export const MyEasyDeskBrand: React.FC<MyEasyDeskBrandProps> = ({
  size = 'md',
  showTagline = true,
  inverted = false,
  className = '',
  onClick
}) => {
  // Size-specific scaling classes
  const sizeStyles = {
    sm: {
      my: 'text-xl leading-none -mr-0.5',
      main: 'text-base sm:text-lg leading-none',
      tagline: 'text-[9px] sm:text-[10px] mt-0.5 tracking-normal',
      container: 'gap-0',
    },
    md: {
      my: 'text-2xl sm:text-3xl leading-none -mr-0.5',
      main: 'text-xl sm:text-2xl leading-none',
      tagline: 'text-[10px] sm:text-[11px] mt-0.5 tracking-normal',
      container: 'gap-0',
    },
    lg: {
      my: 'text-3xl sm:text-4xl leading-none -mr-1',
      main: 'text-2xl sm:text-3xl leading-none',
      tagline: 'text-xs sm:text-sm mt-1 tracking-normal',
      container: 'gap-0',
    },
    xl: {
      my: 'text-4xl sm:text-5xl md:text-6xl leading-none -mr-1.5',
      main: 'text-3xl sm:text-4xl md:text-5xl leading-none',
      tagline: 'text-sm sm:text-base mt-1.5 tracking-normal',
      container: 'gap-0',
    },
  }[size];

  // Palette colors based on inverted mode
  const myColor = inverted ? 'text-[#38BDF8]' : 'text-[#0062FF]';
  const easyColor = inverted ? 'text-white' : 'text-[#0B192C]';
  const deskColor = inverted ? 'text-[#38BDF8]' : 'text-[#0062FF]';
  const taglineColor = inverted ? 'text-slate-300' : 'text-slate-700';

  const brandContent = (
    <div
      className={`inline-flex flex-col select-none notranslate ${className}`}
      translate="no"
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      style={{ WebkitFontSmoothing: 'antialiased' }}
    >
      {/* Brand Title: "My" (Script) + "EasyDesk" (Bold Modern Sans) */}
      <div className={`inline-flex items-baseline ${sizeStyles.container} tracking-tight font-black`}>
        {/* "My" — Handwritten script styling */}
        <span
          className={`${sizeStyles.my} ${myColor} font-bold select-none inline-block origin-bottom-left`}
          style={{
            fontFamily: "'Caveat', 'Dancing Script', 'Segoe Script', 'Brush Script MT', cursive",
            transform: 'rotate(-4deg) translateY(1px)',
            marginRight: '0.12em',
            letterSpacing: '-0.02em',
            textShadow: inverted ? '0 0 20px rgba(56, 189, 248, 0.25)' : 'none',
          }}
        >
          My
        </span>

        {/* "Easy" + "Desk" — Strong Modern Sans-Serif */}
        <span
          className={`${sizeStyles.main} font-black tracking-tight`}
          style={{
            fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            fontWeight: 900,
            letterSpacing: '-0.035em',
          }}
        >
          <span className={easyColor}>Easy</span>
          <span className={deskColor}>Desk</span>
        </span>
      </div>

      {/* Official Tagline */}
      {showTagline && (
        <span
          className={`${sizeStyles.tagline} ${taglineColor} font-semibold block leading-tight`}
          style={{
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            letterSpacing: '-0.01em',
          }}
        >
          Your Online Work, Done Easily
        </span>
      )}
    </div>
  );

  return brandContent;
};

export default MyEasyDeskBrand;
