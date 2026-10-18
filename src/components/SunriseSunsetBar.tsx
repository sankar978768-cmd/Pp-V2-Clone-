import React, { useState, useEffect } from 'react';
import {
  Sun,
  Sunrise,
  Sunset,
  MapPin,
  Check,
  RotateCcw,
  Sparkles,
  Compass,
  X,
  Clock,
  Search,
} from 'lucide-react';
import { calculateSolarTimes } from '../utils/solarCalculator';
import { getLocationTimezoneInfo } from '../utils/timezoneService';
import { LocationSearchBar } from './LocationSearchBar';
import { Jama } from '../types';
import { getActBaseDurations } from '../utils/calculator';
import { useLanguage } from '../context/LanguageContext';

interface SunriseSunsetBarProps {
  sunriseTime: string;
  sunsetTime: string;
  nextSunriseTime: string;
  displaySunrise?: string;
  displaySunset?: string;
  displayNextSunrise?: string;
  isCustomSchedule: boolean;
  onApplySunriseSunset: (
    sunrise: string,
    sunset: string,
    nextSunrise: string,
    cityName?: string,
    lat?: number,
    lng?: number,
    timezone?: string,
    timezoneOffset?: number
  ) => void;
  onResetSchedule: () => void;
  locationName?: string;
  baseJamas?: Jama[];
  isOtherLocation?: boolean;
  timeDisplayMode?: 'local' | 'ist';
  onToggleTimeDisplayMode?: (mode: 'local' | 'ist') => void;
  tzAbbreviation?: string;
  timeDifferenceText?: string;
  localDayName?: string;
  localDateText?: string;
  localPakshaText?: string;
  localTimeText?: string;
}

export const SunriseSunsetBar: React.FC<SunriseSunsetBarProps> = ({
  sunriseTime,
  sunsetTime,
  nextSunriseTime,
  displaySunrise,
  displaySunset,
  displayNextSunrise,
  isCustomSchedule,
  onApplySunriseSunset,
  onResetSchedule,
  locationName,
  baseJamas,
  isOtherLocation = false,
  timeDisplayMode = 'local',
  onToggleTimeDisplayMode,
  tzAbbreviation = 'Local',
  timeDifferenceText,
  localDayName,
  localDateText,
  localPakshaText,
  localTimeText,
}) => {
  const { language, t } = useLanguage();
  // Pop UP Modal state for Location & Solar Settings
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Form states
  const [tempSunrise, setTempSunrise] = useState<string>(sunriseTime);
  const [tempSunset, setTempSunset] = useState<string>(sunsetTime);
  const [tempNextSunrise, setTempNextSunrise] = useState<string>(nextSunriseTime);
  const [tempCity, setTempCity] = useState<string>(locationName || '');
  const [geoLoading, setGeoLoading] = useState<boolean>(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [justApplied, setJustApplied] = useState<boolean>(false);

  // Close popup with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  // Synchronize when external props change
  useEffect(() => {
    setTempSunrise(sunriseTime);
    setTempSunset(sunsetTime);
    setTempNextSunrise(nextSunriseTime);
    if (locationName) setTempCity(locationName);
  }, [sunriseTime, sunsetTime, nextSunriseTime, locationName]);

  // Compute live duration metrics for temp values
  const parseMin = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const sMin = parseMin(tempSunrise);
  let setMin = parseMin(tempSunset);
  if (setMin <= sMin) setMin += 1440;
  let nextSMin = parseMin(tempNextSunrise);
  while (nextSMin <= setMin) nextSMin += 1440;

  const dayTotal = Math.max(0, setMin - sMin);
  const nightTotal = Math.max(0, nextSMin - setMin);
  const dayJamaDur = Math.round((dayTotal / 5) * 10) / 10;
  const nightJamaDur = Math.round((nightTotal / 5) * 10) / 10;

  const formatHoursMins = (minutes: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
  };

  const triggerLiveUpdate = (sr: string, ss: string, nsr: string, city?: string) => {
    const sM = parseMin(sr);
    let ssM = parseMin(ss);
    if (ssM <= sM) ssM += 1440;
    let nsrM = parseMin(nsr);
    while (nsrM <= ssM) nsrM += 1440;

    if (ssM > sM && nsrM > ssM) {
      onApplySunriseSunset(sr, ss, nsr, city);
    }
  };

  const handleApply = () => {
    if (dayTotal <= 0 || nightTotal <= 0) {
      return;
    }
    onApplySunriseSunset(tempSunrise, tempSunset, tempNextSunrise, tempCity || undefined);
    setJustApplied(true);
    setTimeout(() => {
      setJustApplied(false);
      setIsModalOpen(false);
    }, 900);
  };

  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      setGeoError(language === 'ta' ? 'ஜிபிஎஸ் வசதி ஆதரிக்கப்படவில்லை.' : 'Geolocation is not supported by your browser.');
      return;
    }

    setGeoLoading(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoLoading(false);
        const { latitude, longitude } = position.coords;
        const tzInfo = getLocationTimezoneInfo({ lat: latitude, lng: longitude });
        const times = calculateSolarTimes(latitude, longitude, new Date(), tzInfo.offsetMinutes);

        setTempSunrise(times.sunrise);
        setTempSunset(times.sunset);
        setTempNextSunrise(times.nextSunrise);
        const autoName = language === 'ta'
          ? `ஜிபிஎஸ் (${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°)`
          : `GPS (${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°)`;
        setTempCity(autoName);

        onApplySunriseSunset(
          times.sunrise,
          times.sunset,
          times.nextSunrise,
          autoName,
          latitude,
          longitude,
          tzInfo.timezoneName,
          tzInfo.offsetMinutes
        );
        setJustApplied(true);
        setTimeout(() => setJustApplied(false), 2000);
      },
      (error) => {
        setGeoLoading(false);
        setGeoError(error.message || (language === 'ta' ? 'ஜிபிஎஸ் பெற முடியவில்லை.' : 'Unable to retrieve location.'));
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  };

  return (
    <>
      {/* Primary Bar (Always visible) */}
      <div
        id="sunrise-sunset-custom-bar"
        className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden transition-all duration-200"
      >
        <div
          onClick={() => setIsModalOpen(true)}
          className="p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850/80 transition-colors select-none"
        >
          {/* Left Info: Current Sunrise & Sunset values */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
              <Sunrise className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                {isCustomSchedule ? (
                  <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    {language === 'ta' ? `தனிப்பயன் ${locationName ? `(${locationName})` : ''}` : `Custom Active ${locationName ? `(${locationName})` : ''}`}
                  </span>
                ) : (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                    {language === 'ta' ? 'நிலையான நேரம் (06:00 - 18:00)' : 'Standard (06:00 - 18:00)'}
                  </span>
                )}

                {/* Other Location Detected: IST vs Local Time Toggle */}
                {isOtherLocation && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 p-0.5 text-xs font-semibold shadow-2xs"
                    id="other-location-ist-toggle-group"
                  >
                    <button
                      type="button"
                      onClick={() => onToggleTimeDisplayMode?.('local')}
                      id="switch-time-local-btn"
                      className={`px-2.5 py-0.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                        timeDisplayMode === 'local'
                          ? 'bg-white dark:bg-slate-800 text-amber-800 dark:text-amber-300 font-bold shadow-2xs'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                      }`}
                      title={language === 'ta' ? 'இடத்தின் உள்ளூர் நேரம்' : 'Show times in location local time'}
                    >
                      <span>📍 {tzAbbreviation || 'Local'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleTimeDisplayMode?.('ist')}
                      id="switch-time-ist-btn"
                      className={`px-2.5 py-0.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                        timeDisplayMode === 'ist'
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-2xs'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                      }`}
                      title={language === 'ta' ? 'இந்திய நேரம் (IST) - நேரத்தை மட்டும் மாற்றும்' : 'Switch to IST (times only; date & day remain local)'}
                    >
                      <span>🇮🇳 IST</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Quick Times Summary Display */}
              {(() => {
                const effectiveSunrise = isOtherLocation && timeDisplayMode === 'ist' && displaySunrise ? displaySunrise : sunriseTime;
                const effectiveSunset = isOtherLocation && timeDisplayMode === 'ist' && displaySunset ? displaySunset : sunsetTime;
                return (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white mt-0.5 font-mono">
                    <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300">
                      <Sun className="w-3.5 h-3.5 text-amber-500" />
                      <span>{language === 'ta' ? 'உதயம்:' : 'Sunrise:'} <strong>{effectiveSunrise}</strong></span>
                    </span>
                    <span className="text-slate-400 dark:text-slate-600 hidden sm:inline">•</span>
                    <span className="flex items-center gap-1 text-purple-700 dark:text-purple-300">
                      <Sunset className="w-3.5 h-3.5 text-purple-500" />
                      <span>{language === 'ta' ? 'அஸ்தமனம்:' : 'Sunset:'} <strong>{effectiveSunset}</strong></span>
                    </span>
                    {isOtherLocation && timeDisplayMode === 'ist' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold">
                        (IST +05:30)
                      </span>
                    )}
                    <span className="text-slate-400 dark:text-slate-600 hidden sm:inline">•</span>
                    <span className="text-slate-500 dark:text-slate-400 text-xs font-normal">
                      {language === 'ta' ? 'பகல்:' : 'Day:'} {formatHoursMins(setMin - sMin)} ({dayJamaDur}m/{language === 'ta' ? 'சாமம்' : 'Jama'})
                    </span>
                  </div>
                );
              })()}

              {/* Informational banner when other location is detected */}
              {isOtherLocation && (
                <div className="text-[11px] font-medium text-amber-800 dark:text-amber-300 mt-1 flex items-center gap-1.5 flex-wrap">
                  <span>
                    {timeDisplayMode === 'ist'
                      ? (language === 'ta'
                          ? `🇮🇳 இந்திய நேரம் (IST) • உள்ளூர் நாள்: ${localDayName || ''}, ${localDateText || ''} (${localPakshaText || ''})`
                          : `🇮🇳 Times converted to IST • Local Day: ${localDayName || ''}, ${localDateText || ''} (${localPakshaText || ''})`)
                      : (language === 'ta'
                          ? `📍 உள்ளூர் நேரம்: ${localTimeText || ''} (${tzAbbreviation || 'Local'}) • நாள்: ${localDayName || ''}, ${localDateText || ''} (${localPakshaText || ''})`
                          : `📍 Local Time: ${localTimeText || ''} (${tzAbbreviation || 'Local'}) • Day: ${localDayName || ''}, ${localDateText || ''} (${localPakshaText || ''})`)}
                  </span>
                  {timeDifferenceText && (
                    <span className="text-slate-500 dark:text-slate-400 font-mono text-[10px]">
                      ({timeDifferenceText})
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Action: Open Pop Up & Quick Reset */}
          <div className="flex items-center gap-2 self-start md:self-center">
            {isCustomSchedule && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onResetSchedule();
                }}
                id="quick-reset-schedule-btn"
                title="Reset"
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-xs flex items-center gap-1 font-medium cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3 h-3 text-amber-500" />
                <span>{language === 'ta' ? 'இயல்பு நிலை' : 'Standard 6-6'}</span>
              </button>
            )}

            <button
              type="button"
              id="toggle-sunrise-sunset-editor-btn"
              onClick={(e) => {
                e.stopPropagation();
                setIsModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5 text-amber-500" />
              <span>
                {language === 'ta' ? 'சூரியோதய நேரம் மாற்று' : 'Custom Sunrise / Sunset'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Location Hidden Settings Modal / Pop UP */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
          onClick={() => setIsModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="location-settings-popup-title"
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl sm:max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Pop Up Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <h3
                    id="location-settings-popup-title"
                    className="font-bold text-sm sm:text-base text-slate-900 dark:text-white"
                  >
                    {language === 'ta'
                      ? 'சூரியோதயம் மற்றும் இட அமைப்புகள்'
                      : 'Location & Solar Settings (Custom Sunrise / Sunset)'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {language === 'ta'
                      ? '10 சாமங்களின் கால அளவை துல்லியமாக கணக்கிட இடம் அல்லது நேரத்தை தேர்வு செய்க'
                      : 'Search location, select from recents, or adjust solar timings'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                id="close-location-settings-popup-btn"
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                title={language === 'ta' ? 'மூடுக' : 'Close'}
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pop Up Scrollable Body: Strict Ordered Layout */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-5 max-h-[calc(92vh-130px)]">
              {geoError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs">
                  {geoError}
                </div>
              )}

              {/*
                1. Search Location for Sunrise & Sunset:
                2. Recent Searches (Last 5):
              */}
              <LocationSearchBar
                currentLocationName={tempCity}
                searchLabel={
                  <span className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                    <Search className="w-3.5 h-3.5 text-amber-500" />
                    <span>
                      {language === 'ta'
                        ? '1. சூரியோதயம் & அஸ்தமனத்திற்கான இடத் தேடல்:'
                        : '1. Search Location for Sunrise & Sunset:'}
                    </span>
                  </span>
                }
                recentLabel={
                  <span className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>
                      {language === 'ta'
                        ? '2. சமீபத்திய தேடல்கள் (கடைசி 5):'
                        : '2. Recent Searches (Last 5):'}
                    </span>
                  </span>
                }
                headerExtra={
                  <button
                    type="button"
                    onClick={handleDetectGPS}
                    disabled={geoLoading}
                    id="gps-detect-btn"
                    className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
                  >
                    <MapPin className="w-3.5 h-3.5 text-amber-500" />
                    <span>
                      {geoLoading
                        ? (language === 'ta' ? 'கண்டறியப்படுகிறது...' : 'Detecting...')
                        : (language === 'ta' ? 'எனது ஜிபிஎஸ் இடம்' : 'Use My GPS Location')}
                    </span>
                  </button>
                }
                onApplyLocationSchedule={(sr, ss, nsr, locName, lat, lng, tz, tzOff) => {
                  setTempSunrise(sr);
                  setTempSunset(ss);
                  setTempNextSunrise(nsr);
                  setTempCity(locName);
                  onApplySunriseSunset(sr, ss, nsr, locName, lat, lng, tz, tzOff);
                  setJustApplied(true);
                  setTimeout(() => setJustApplied(false), 2000);
                }}
                onResetStandard={() => {
                  onResetSchedule();
                  setTempSunrise('06:00');
                  setTempSunset('18:00');
                  setTempNextSunrise('06:00');
                  setTempCity('');
                }}
                isCustomActive={isCustomSchedule}
              />

              {/* 3. Custom Sunrise, Sunset & Next Day Timings */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 uppercase tracking-wider">
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                    <span>
                      {language === 'ta'
                        ? '3. தனிப்பயன் சூரியோதயம், அஸ்தமனம் & அடுத்த நாள் நேரங்கள்:'
                        : '3. Custom Sunrise, Sunset & Next Day Timings:'}
                    </span>
                  </h4>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    24h Solar
                  </span>
                </div>

                {/* 3 Time Input Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Sunrise (Today) */}
                  <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                        <Sun className="w-3.5 h-3.5 text-amber-500" />
                        <span>{language === 'ta' ? 'சூரியோதயம் (இன்று)' : 'Sunrise (Today)'}</span>
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Day Begins</span>
                    </div>
                    <input
                      type="time"
                      value={tempSunrise}
                      onChange={(e) => {
                        setTempSunrise(e.target.value);
                        triggerLiveUpdate(e.target.value, tempSunset, tempNextSunrise, tempCity);
                      }}
                      id="custom-sunrise-input"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white font-mono font-bold text-sm focus:outline-hidden focus:border-amber-500"
                    />
                  </div>

                  {/* Sunset (Today) */}
                  <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                        <Sunset className="w-3.5 h-3.5 text-purple-500" />
                        <span>{language === 'ta' ? 'அஸ்தமனம் (இன்று)' : 'Sunset (Today)'}</span>
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Night Begins</span>
                    </div>
                    <input
                      type="time"
                      value={tempSunset}
                      onChange={(e) => {
                        setTempSunset(e.target.value);
                        triggerLiveUpdate(tempSunrise, e.target.value, tempNextSunrise, tempCity);
                      }}
                      id="custom-sunset-input"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white font-mono font-bold text-sm focus:outline-hidden focus:border-purple-500"
                    />
                  </div>

                  {/* Next Sunrise (Tomorrow) */}
                  <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                        <Sunrise className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{language === 'ta' ? 'சூரியோதயம் (நாளை)' : 'Sunrise (Tomorrow)'}</span>
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Night Ends</span>
                    </div>
                    <input
                      type="time"
                      value={tempNextSunrise}
                      onChange={(e) => {
                        setTempNextSunrise(e.target.value);
                        triggerLiveUpdate(tempSunrise, tempSunset, e.target.value, tempCity);
                      }}
                      id="custom-next-sunrise-input"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white font-mono font-bold text-sm focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Calculated Duration Summary */}
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="text-slate-600 dark:text-slate-400">
                    <span>{language === 'ta' ? 'பகல் கால அளவு: ' : 'Calculated Day: '}</span>
                    <strong className="text-slate-900 dark:text-white font-mono">{formatHoursMins(dayTotal)}</strong>
                    <span className="text-slate-400 dark:text-slate-600 mx-1.5">•</span>
                    <span>{dayJamaDur}m/{language === 'ta' ? 'சாமம்' : 'Jama'}</span>
                  </div>

                  <div className="text-slate-600 dark:text-slate-400">
                    <span>{language === 'ta' ? 'இரவு கால அளவு: ' : 'Night: '}</span>
                    <strong className="text-slate-900 dark:text-white font-mono">{formatHoursMins(nightTotal)}</strong>
                    <span className="text-slate-400 dark:text-slate-600 mx-1.5">•</span>
                    <span>{nightJamaDur}m/{language === 'ta' ? 'சாமம்' : 'Jama'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Pop Up Footer Actions */}
            <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div>
                {isCustomSchedule && (
                  <button
                    type="button"
                    onClick={() => {
                      onResetSchedule();
                      setTempSunrise('06:00');
                      setTempSunset('18:00');
                      setTempNextSunrise('06:00');
                      setTempCity('');
                    }}
                    id="modal-reset-to-standard-btn"
                    className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    {language === 'ta' ? 'நிலையான நேரம் (06:00 - 18:00)' : 'Reset Standard (06:00 - 18:00)'}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
                >
                  {t('touchToClose') || 'Close'}
                </button>

                <button
                  type="button"
                  onClick={handleApply}
                  id="apply-solar-schedule-btn"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  {justApplied ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{language === 'ta' ? 'பயன்படுத்தப்பட்டது!' : 'Applied!'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 fill-slate-950" />
                      <span>{language === 'ta' ? '10 சாமங்களையும் கணக்கிடுக' : 'Recalculate All 10 Jamas'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
