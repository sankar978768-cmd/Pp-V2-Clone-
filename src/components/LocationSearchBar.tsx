import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, X, RotateCcw, Compass, Loader2, Clock, Trash2, Check, Sun, Sunset } from 'lucide-react';
import {
  LocationSearchResult,
  RecentLocationSearch,
  searchLocations,
  computeLocationSolarTimes,
  getRecentSearches,
  saveRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
} from '../utils/locationService';
import { useLanguage } from '../context/LanguageContext';

interface LocationSearchBarProps {
  currentLocationName?: string;
  onApplyLocationSchedule: (
    sunrise: string,
    sunset: string,
    nextSunrise: string,
    locationName: string,
    lat?: number,
    lng?: number,
    timezone?: string,
    timezoneOffset?: number
  ) => void;
  onResetStandard?: () => void;
  isCustomActive?: boolean;
  searchLabel?: React.ReactNode;
  recentLabel?: React.ReactNode;
  headerExtra?: React.ReactNode;
}

export const LocationSearchBar: React.FC<LocationSearchBarProps> = ({
  currentLocationName,
  onApplyLocationSchedule,
  onResetStandard,
  isCustomActive,
  searchLabel,
  recentLabel,
  headerExtra,
}) => {
  const { language, t } = useLanguage();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [recentSearches, setRecentSearches] = useState<RecentLocationSearch[]>([]);
  const [activeLocationId, setActiveLocationId] = useState<string>('');

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load recent searches on mount
  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle Search Input Change with Debounce
  const handleQueryChange = (text: string) => {
    setSearchQuery(text);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (text.trim().length < 2) {
      setResults([]);
      setIsSearching(false);
      setIsDropdownOpen(false);
      return;
    }

    setIsSearching(true);
    setIsDropdownOpen(true);

    debounceTimerRef.current = setTimeout(async () => {
      const items = await searchLocations(text);
      setResults(items);
      setIsSearching(false);
    }, 350);
  };

  const handleSelectResult = (location: LocationSearchResult) => {
    const solar = computeLocationSolarTimes(location);
    const locDisplayName = language === 'ta' && location.tamilName ? location.tamilName : location.name;

    // Save to 5 recent searches
    const updatedRecents = saveRecentSearch({
      id: location.id,
      name: location.name,
      tamilName: location.tamilName,
      country: location.country,
      admin1: location.admin1,
      lat: location.lat,
      lng: location.lng,
      timezone: solar.tzInfo.timezoneName || location.timezone,
      timezoneOffset: solar.tzInfo.offsetMinutes / 60,
      sunrise: solar.sunrise,
      sunset: solar.sunset,
      nextSunrise: solar.nextSunrise,
    });

    setRecentSearches(updatedRecents);
    setActiveLocationId(location.id);
    setIsDropdownOpen(false);
    setSearchQuery('');

    // Trigger parent schedule update
    onApplyLocationSchedule(
      solar.sunrise,
      solar.sunset,
      solar.nextSunrise,
      locDisplayName,
      location.lat,
      location.lng,
      solar.tzInfo.timezoneName || location.timezone,
      solar.tzInfo.offsetMinutes
    );
  };

  const handleSelectRecent = (item: RecentLocationSearch) => {
    // Recalculate for current date in case day has changed
    const solar = computeLocationSolarTimes(item);
    const locDisplayName = language === 'ta' && item.tamilName ? item.tamilName : item.name;

    setActiveLocationId(item.id);
    onApplyLocationSchedule(
      solar.sunrise,
      solar.sunset,
      solar.nextSunrise,
      locDisplayName,
      item.lat,
      item.lng,
      solar.tzInfo.timezoneName || item.timezone,
      solar.tzInfo.offsetMinutes
    );
  };

  const handleRemoveRecent = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = removeRecentSearch(id);
    setRecentSearches(updated);
  };

  const handleClearAllRecents = () => {
    clearRecentSearches();
    setRecentSearches([]);
  };

  const handleStandardReset = () => {
    setActiveLocationId('standard');
    if (onResetStandard) {
      onResetStandard();
    }
  };

  return (
    <div ref={containerRef} className="space-y-3" id="location-search-section">
      {/* Search Header & Input */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
          <label
            htmlFor="location-search-input"
            className="block text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5"
          >
            {searchLabel ? (
              searchLabel
            ) : (
              <>
                <Search className="w-3.5 h-3.5 text-amber-500" />
                <span>{t('locationSearchLabel')}</span>
              </>
            )}
          </label>
          {headerExtra}
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            {isSearching ? (
              <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </div>

          <input
            id="location-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => {
              if (searchQuery.trim().length >= 2 && results.length > 0) {
                setIsDropdownOpen(true);
              }
            }}
            placeholder={t('searchLocationPlaceholder')}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors shadow-xs"
            autoComplete="off"
          />

          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setResults([]);
                setIsDropdownOpen(false);
              }}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Search Dropdown Results */}
          {isDropdownOpen && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
              {isSearching ? (
                <div className="p-3 text-center text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                  <span>{t('searchingText')}</span>
                </div>
              ) : results.length > 0 ? (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {results.map((loc) => {
                    const solar = computeLocationSolarTimes(loc);
                    const displayName = language === 'ta' && loc.tamilName ? loc.tamilName : loc.name;
                    const regionDetails = [loc.admin1, loc.country].filter(Boolean).join(', ');

                    return (
                      <li key={loc.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectResult(loc)}
                          className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
                              <MapPin className="w-3.5 h-3.5" />
                            </div>
                            <div className="truncate">
                              <div className="font-bold text-slate-900 dark:text-white truncate text-xs sm:text-sm">
                                {displayName}
                              </div>
                              {regionDetails && (
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                  {regionDetails}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Solar Preview */}
                          <div className="text-right shrink-0 font-mono text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-2">
                            <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300">
                              <Sun className="w-3.5 h-3.5 text-amber-500" />
                              <span>{solar.sunrise}</span>
                            </span>
                            <span className="text-slate-400 dark:text-slate-600">•</span>
                            <span className="flex items-center gap-1 text-purple-700 dark:text-purple-300">
                              <Sunset className="w-3.5 h-3.5 text-purple-500" />
                              <span>{solar.sunset}</span>
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="p-3 text-center text-xs text-slate-500 dark:text-slate-400">
                  {t('noLocationsFound')}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 5 Recent Searches Section */}
      <div className="space-y-1.5" id="recent-location-searches-container">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            {recentLabel ? (
              recentLabel
            ) : (
              <>
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>{t('recentSearchesTitle')}</span>
              </>
            )}
          </span>

          <div className="flex items-center gap-2">
            {/* Standard Reset button */}
            <button
              type="button"
              onClick={handleStandardReset}
              id="standard-preset-chip-btn"
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all cursor-pointer ${
                !isCustomActive
                  ? 'bg-amber-500/15 border-amber-500/50 text-amber-800 dark:text-amber-300 font-bold'
                  : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-800'
              }`}
            >
              {t('standardSunTimeBtn')}
            </button>

            {recentSearches.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllRecents}
                id="clear-all-recent-searches-btn"
                className="text-[11px] text-slate-500 hover:text-rose-500 flex items-center gap-1 transition-colors cursor-pointer"
                title={t('clearRecentSearchesBtn')}
              >
                <Trash2 className="w-3 h-3" />
                <span>{t('clearRecentSearchesBtn')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Recent Search Chips (Up to 5) */}
        {recentSearches.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2 pt-1">
            {recentSearches.map((rec) => {
              const displayName = language === 'ta' && rec.tamilName ? rec.tamilName : rec.name;
              const isSelected = currentLocationName === displayName || activeLocationId === rec.id;

              return (
                <div
                  key={rec.id}
                  onClick={() => handleSelectRecent(rec)}
                  id={`recent-search-${rec.id}`}
                  className={`group relative p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between select-none ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500/50 shadow-xs text-slate-900 dark:text-white'
                      : 'bg-white dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
                  }`}
                >
                  {/* Top: Location Name & Delete Button */}
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <MapPin
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isSelected ? 'text-amber-500' : 'text-slate-400 group-hover:text-amber-500'
                        }`}
                      />
                      <span className="font-bold text-xs truncate" title={displayName}>
                        {displayName}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleRemoveRecent(e, rec.id)}
                      className="text-slate-400 hover:text-rose-500 p-0.5 rounded transition-colors cursor-pointer"
                      title="Remove"
                      aria-label={`Remove ${displayName}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Bottom: Sunrise & Sunset */}
                  <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] font-mono">
                    <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300 font-semibold">
                      <Sun className="w-3 h-3 text-amber-500" />
                      <span>{rec.sunrise}</span>
                    </span>
                    <span className="text-slate-300 dark:text-slate-600">•</span>
                    <span className="flex items-center gap-1 text-purple-700 dark:text-purple-300 font-semibold">
                      <Sunset className="w-3 h-3 text-purple-500" />
                      <span>{rec.sunset}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-2 text-center text-xs text-slate-500 bg-slate-100 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800/50">
            {t('noRecentSearchesText')}
          </div>
        )}
      </div>
    </div>
  );
};
