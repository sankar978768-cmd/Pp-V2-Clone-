import React from 'react';
import { BirdId } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { Calendar, MapPin, Zap } from 'lucide-react';
import { BIRD_EMOJIS } from './BirdSelectModal';

export interface FixedBottomNavProps {
  activeSection: string;
  onScrollToSection: (sectionId: string) => void;
  selectedBird: BirdId;
  onOpenBirdSelectModal: () => void;
  locationName?: string;
}

export const FixedBottomNav: React.FC<FixedBottomNavProps> = ({
  activeSection,
  onScrollToSection,
  selectedBird,
  onOpenBirdSelectModal,
  locationName,
}) => {
  const { language, getBirdName } = useLanguage();

  const locationLabel = locationName?.trim()
    ? locationName.trim()
    : (language === 'ta' ? 'இடம்' : 'Location');

  // Equal 4-Column Layout in exact order requested:
  // 1. Date & Day (📅 Calendar)
  // 2. Location (📍 MapPin) - dynamic label reflecting selected location name
  // 3. Bird (Selected Bird Icon / Emoji)
  // 4. Activity (⚡ Zap)
  const navItems = [
    {
      id: 'section-date-day',
      label: language === 'ta' ? 'தேதி & நாள்' : 'Date & Day',
      Icon: Calendar,
      isBird: false,
    },
    {
      id: 'section-location',
      label: locationLabel,
      Icon: MapPin,
      isBird: false,
    },
    {
      id: 'section-bird',
      label: getBirdName(selectedBird) || (language === 'ta' ? 'பட்சி' : 'Bird'),
      Icon: null,
      isBird: true,
    },
    {
      id: 'section-activity',
      label: language === 'ta' ? 'செயல்பாடு' : 'Activity',
      Icon: Zap,
      isBird: false,
    },
  ];

  return (
    <nav
      id="fixed-bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-40 w-full bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_16px_rgba(0,0,0,0.5)] transition-colors duration-150 pb-[max(0.35rem,env(safe-area-inset-bottom))]"
      aria-label="Bottom Section Quick Navigation"
    >
      <div className="max-w-7xl mx-auto px-2 sm:px-6">
        <div className="grid grid-cols-4 w-full">
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                id={`bottom-nav-btn-${item.id}`}
                onClick={() => {
                  if (item.isBird) {
                    onOpenBirdSelectModal();
                  } else {
                    onScrollToSection(item.id);
                  }
                }}
                className={`relative flex flex-col items-center justify-center gap-1 py-2 sm:py-2.5 px-1 text-center transition-all duration-200 cursor-pointer touch-manipulation select-none ${
                  isActive
                    ? 'text-emerald-800 dark:text-emerald-300 font-extrabold bg-emerald-500/10 dark:bg-emerald-500/15'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-slate-900/60 font-medium'
                }`}
                title={item.isBird ? `${getBirdName(selectedBird)} (Click to change bird)` : item.label}
              >
                {/* Active Top Highlight Indicator */}
                {isActive && (
                  <span className="absolute top-0 left-2 right-2 h-[3px] rounded-full bg-emerald-600 dark:bg-emerald-400 shadow-xs" />
                )}

                {item.isBird ? (
                  <span
                    className={`leading-none select-none transition-all duration-200 shrink-0 flex items-center justify-center ${
                      isActive
                        ? 'text-xl sm:text-2xl scale-110 drop-shadow-xs'
                        : 'text-lg sm:text-xl'
                    }`}
                    aria-hidden="true"
                  >
                    {BIRD_EMOJIS[selectedBird] || '🐦'}
                  </span>
                ) : item.Icon ? (
                  <item.Icon
                    className={`transition-all duration-200 shrink-0 ${
                      isActive
                        ? 'w-5 h-5 sm:w-5.5 sm:h-5.5 text-emerald-700 dark:text-emerald-400 scale-110 drop-shadow-xs'
                        : 'w-4 h-4 sm:w-4.5 sm:h-4.5 text-slate-500 dark:text-slate-400'
                    }`}
                    fill={isActive ? 'currentColor' : 'none'}
                    strokeWidth={isActive ? 1.75 : 1.5}
                  />
                ) : null}

                <span
                  className={`text-[10px] sm:text-xs tracking-tight truncate max-w-full transition-colors ${
                    isActive
                      ? 'text-emerald-900 dark:text-emerald-300 font-extrabold'
                      : 'text-slate-600 dark:text-slate-400 font-medium'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
