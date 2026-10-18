import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BirdId, Jama, PakshaType, DayOfWeek } from './types';
import { BIRDS } from './data/panchaPakshiData';
import { recalculateJamas } from './utils/calculator';
import { getBaseJamasForDay, PANCHA_PAKSHI_DAYS } from './data/panchaPakshiRegistry';
import { OFFLINE_CITIES } from './utils/locationService';
import {
  getLocationTimezoneInfo,
  getTargetLocationCurrentMoment,
  getTzAbbreviation,
  getTimeDifferenceFromIstText,
  convertTimeToIst,
  convertJamasToIst,
} from './utils/timezoneService';
import { calculateSolarTimes } from './utils/solarCalculator';
import { FixedTopHeader } from './components/FixedTopHeader';
import { FixedBottomNav } from './components/FixedBottomNav';
import { PakshaDaySelector } from './components/PakshaDaySelector';
import { BirdSelector } from './components/BirdSelector';
import { SunriseSunsetBar } from './components/SunriseSunsetBar';
import { CurrentStatusBanner } from './components/CurrentStatusBanner';
import { JamaCard } from './components/JamaCard';
import { MasterTableView } from './components/MasterTableView';
import { TimeLookupModal } from './components/TimeLookupModal';
import { RealTimeCalendarModal } from './components/RealTimeCalendarModal';
import { BirdSelectModal } from './components/BirdSelectModal';
import { ActivityChartView } from './components/ActivityChartView';
import { getLunarDayInfo } from './utils/lunarCalendar';
import { useLanguage } from './context/LanguageContext';
import { useTheme } from './context/ThemeContext';
import {
  Sun,
  Moon,
  Table,
  Layers,
  TrendingUp,
} from 'lucide-react';

const DAYS_MAP: DayOfWeek[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export default function App() {
  const {
    language,
    setLanguage,
    t,
    getBirdName,
    getPakshaName,
    getDayName,
  } = useLanguage();

  const { theme, setTheme, isDark } = useTheme();

  const [selectedBird, setSelectedBird] = useState<BirdId>(() => {
    const saved = localStorage.getItem('pancha_selected_bird');
    if (saved && (saved in BIRDS)) return saved as BirdId;
    return 'vulture';
  });

  // Custom schedule state (if user changes sunrise/sunset) with localStorage persistence
  const [sunriseTime, setSunriseTime] = useState<string>(() => {
    return localStorage.getItem('pancha_sunrise') || '06:00';
  });
  const [sunsetTime, setSunsetTime] = useState<string>(() => {
    return localStorage.getItem('pancha_sunset') || '18:00';
  });
  const [nextSunriseTime, setNextSunriseTime] = useState<string>(() => {
    return localStorage.getItem('pancha_next_sunrise') || '06:00';
  });
  const [locationName, setLocationName] = useState<string>(() => {
    return localStorage.getItem('pancha_location_name') || '';
  });
  const [locationLat, setLocationLat] = useState<number | null>(() => {
    const val = localStorage.getItem('pancha_location_lat');
    return val ? parseFloat(val) : null;
  });
  const [locationLng, setLocationLng] = useState<number | null>(() => {
    const val = localStorage.getItem('pancha_location_lng');
    return val ? parseFloat(val) : null;
  });
  const [locationTimezone, setLocationTimezone] = useState<string>(() => {
    return localStorage.getItem('pancha_location_tz') || 'Asia/Kolkata';
  });
  const [locationTimezoneOffset, setLocationTimezoneOffset] = useState<number>(() => {
    const val = localStorage.getItem('pancha_location_tz_offset');
    if (val !== null) return parseInt(val, 10);
    const loc = localStorage.getItem('pancha_location_name');
    if (loc) {
      const match = OFFLINE_CITIES.find(
        (c) => c.name.toLowerCase() === loc.toLowerCase() || c.tamilName === loc
      );
      if (match) {
        const tzInfo = getLocationTimezoneInfo(match);
        return tzInfo.offsetMinutes;
      }
    }
    return 330; // default IST (+5:30)
  });
  const [isCustomSchedule, setIsCustomSchedule] = useState<boolean>(() => {
    return localStorage.getItem('pancha_is_custom') === 'true';
  });

  // Time Display Mode: 'local' (target location solar time) or 'ist' (Indian Standard Time +05:30)
  const [timeDisplayMode, setTimeDisplayMode] = useState<'local' | 'ist'>(() => {
    const saved = localStorage.getItem('pancha_time_display_mode');
    return saved === 'ist' ? 'ist' : 'local';
  });

  // Active Paksha and Day state (defaults to real-time astronomical running Pirai and Day)
  const [selectedPaksha, setSelectedPaksha] = useState<PakshaType>(() => {
    const saved = localStorage.getItem('pancha_selected_paksha');
    if (saved === 'valarpirai' || saved === 'theipirai') return saved as PakshaType;
    return getLunarDayInfo(new Date()).paksha;
  });
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(() => {
    const saved = localStorage.getItem('pancha_selected_day');
    if (saved) return saved as DayOfWeek;
    return getLunarDayInfo(new Date()).dayOfWeek;
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(() => {
    const saved = localStorage.getItem('pancha_selected_calendar_date');
    if (saved) {
      const d = new Date(saved);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  });
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isBirdSelectModalOpen, setIsBirdSelectModalOpen] = useState(false);
  const [customDaysVersion, setCustomDaysVersion] = useState<number>(0);

  const [activeTab, setActiveTab] = useState<'jamas' | 'chart' | 'master'>('jamas');
  const [jamaFilter, setJamaFilter] = useState<'all' | 'day' | 'night'>('all');
  const [isLookupModalOpen, setIsLookupModalOpen] = useState(false);

  // Detect whether current custom location is outside Indian Standard Time (+05:30)
  const isOtherLocation = useMemo(() => {
    return Boolean(isCustomSchedule && Math.abs(locationTimezoneOffset - 330) > 1);
  }, [isCustomSchedule, locationTimezoneOffset]);

  // Standard timezone abbreviation for the target location (e.g. 'EDT', 'BST', 'JST', 'SGT')
  const tzAbbreviation = useMemo(() => {
    return getTzAbbreviation(locationTimezone, locationTimezoneOffset, selectedCalendarDate || new Date());
  }, [locationTimezone, locationTimezoneOffset, selectedCalendarDate]);

  // Time difference relative to IST text
  const timeDifferenceText = useMemo(() => {
    return getTimeDifferenceFromIstText(locationTimezoneOffset, language);
  }, [locationTimezoneOffset, language]);

  // Save selections to localStorage
  useEffect(() => {
    localStorage.setItem('pancha_selected_bird', selectedBird);
  }, [selectedBird]);

  useEffect(() => {
    localStorage.setItem('pancha_selected_paksha', selectedPaksha);
  }, [selectedPaksha]);

  useEffect(() => {
    localStorage.setItem('pancha_selected_day', selectedDay);
  }, [selectedDay]);

  // Active Day Configuration lookup
  const activeDayId = `${selectedPaksha}_${selectedDay}`;
  const dayMeta = PANCHA_PAKSHI_DAYS.find((d) => d.id === activeDayId);

  // Base Jamas for current day
  const baseJamasResult = useMemo(() => {
    return getBaseJamasForDay(activeDayId);
  }, [activeDayId, customDaysVersion]);

  // If user hasn't explicitly set custom schedule, sync with day default sunrise/sunset
  useEffect(() => {
    if (!isCustomSchedule && baseJamasResult.defaultSunset) {
      setSunriseTime(baseJamasResult.defaultSunrise || '06:00');
      setSunsetTime(baseJamasResult.defaultSunset || '18:00');
      setNextSunriseTime(baseJamasResult.defaultNextSunrise || '06:00');
    }
  }, [activeDayId, isCustomSchedule, baseJamasResult.defaultSunrise, baseJamasResult.defaultSunset, baseJamasResult.defaultNextSunrise]);

  // Recalculate solar times if user browses to a different calendar date for their saved location
  useEffect(() => {
    if (isCustomSchedule && locationLat !== null && locationLng !== null && selectedCalendarDate) {
      const solar = calculateSolarTimes(locationLat, locationLng, selectedCalendarDate, locationTimezoneOffset);
      setSunriseTime(solar.sunrise);
      setSunsetTime(solar.sunset);
      setNextSunriseTime(solar.nextSunrise);
    }
  }, [selectedCalendarDate, isCustomSchedule, locationLat, locationLng, locationTimezoneOffset]);

  // Recalculated Jamas in that location's local solar time
  const localJamasList: Jama[] = useMemo(() => {
    if (isCustomSchedule) {
      return recalculateJamas(sunriseTime, sunsetTime, nextSunriseTime, baseJamasResult.jamas);
    }
    return baseJamasResult.jamas;
  }, [isCustomSchedule, sunriseTime, sunsetTime, nextSunriseTime, baseJamasResult.jamas]);

  // Display Jamas: If location is outside IST and IST mode is active, convert clock times into IST (+05:30)
  // CRITICAL: Astrological order, bird activities, stars, and durations remain 100% anchored to local day!
  const displayJamasList: Jama[] = useMemo(() => {
    if (isOtherLocation && timeDisplayMode === 'ist') {
      return convertJamasToIst(localJamasList, locationTimezoneOffset);
    }
    return localJamasList;
  }, [isOtherLocation, timeDisplayMode, localJamasList, locationTimezoneOffset]);

  // Display Sunrise, Sunset, and Next Sunrise (converted to IST if IST mode is active)
  const displaySunrise = useMemo(() => {
    if (isOtherLocation && timeDisplayMode === 'ist') {
      return convertTimeToIst(sunriseTime, locationTimezoneOffset, true);
    }
    return sunriseTime;
  }, [isOtherLocation, timeDisplayMode, sunriseTime, locationTimezoneOffset]);

  const displaySunset = useMemo(() => {
    if (isOtherLocation && timeDisplayMode === 'ist') {
      return convertTimeToIst(sunsetTime, locationTimezoneOffset, true);
    }
    return sunsetTime;
  }, [isOtherLocation, timeDisplayMode, sunsetTime, locationTimezoneOffset]);

  const displayNextSunrise = useMemo(() => {
    if (isOtherLocation && timeDisplayMode === 'ist') {
      return convertTimeToIst(nextSunriseTime, locationTimezoneOffset, true);
    }
    return nextSunriseTime;
  }, [isOtherLocation, timeDisplayMode, nextSunriseTime, locationTimezoneOffset]);

  // Live real-time clock ticker updated every 15s
  const [currentUtcMillis, setCurrentUtcMillis] = useState<number>(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentUtcMillis(Date.now());
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Compute live current clock minutes in target local time and in IST
  const liveClocks = useMemo(() => {
    const ref = new Date(currentUtcMillis);
    const utcMinutes = ref.getUTCHours() * 60 + ref.getUTCMinutes() + ref.getUTCSeconds() / 60;

    let targetLocalMin = (utcMinutes + locationTimezoneOffset) % 1440;
    if (targetLocalMin < 0) targetLocalMin += 1440;

    let istMin = (utcMinutes + 330) % 1440;
    if (istMin < 0) istMin += 1440;

    const targetMoment = getTargetLocationCurrentMoment(locationTimezoneOffset, ref);

    return {
      targetLocalMinutes: Math.floor(targetLocalMin),
      istMinutes: Math.floor(istMin),
      targetMoment,
    };
  }, [currentUtcMillis, locationTimezoneOffset]);

  // Active clock minute matching the current display mode
  const activeCurrentMinutes = useMemo(() => {
    if (isOtherLocation && timeDisplayMode === 'ist') {
      return liveClocks.istMinutes;
    }
    return liveClocks.targetLocalMinutes;
  }, [isOtherLocation, timeDisplayMode, liveClocks]);

  // Find running Jama based on current time
  const runningJamaNumber = useMemo(() => {
    if (!displayJamasList || displayJamasList.length === 0) return 1;
    const cycleStartMin = displayJamasList[0]?.startMinutesFromMidnight ?? 360;
    const effectiveMinutes = activeCurrentMinutes < cycleStartMin ? activeCurrentMinutes + 1440 : activeCurrentMinutes;

    for (const j of displayJamasList) {
      if (effectiveMinutes >= j.startMinutesFromMidnight && effectiveMinutes < j.endMinutesFromMidnight) {
        return j.jamaNumber;
      }
    }
    return displayJamasList[0]?.jamaNumber ?? 1;
  }, [displayJamasList, activeCurrentMinutes]);

  // Expanded Jama: ONLY the running Jama expands by default, other jamas are contracted!
  const [expandedJamaNumber, setExpandedJamaNumber] = useState<number | null>(null);

  // Keep expandedJamaNumber synchronized with runningJamaNumber
  useEffect(() => {
    setExpandedJamaNumber(runningJamaNumber);
  }, [runningJamaNumber, activeDayId]);

  const currentBirdInfo = BIRDS[selectedBird];
  const currentBirdDisplayName = getBirdName(selectedBird);

  // When any location is selected: calculate local time, local date, day of week, and lunar Paksha
  const handleApplySunriseSunset = (
    sRise: string,
    sSet: string,
    nRise: string,
    locName?: string,
    lat?: number,
    lng?: number,
    timezone?: string,
    timezoneOffsetMinutes?: number
  ) => {
    let finalOffset = timezoneOffsetMinutes;
    let finalTz = timezone;
    let finalLat = lat;
    let finalLng = lng;

    // If offset or coords are missing, attempt lookup from offline cities
    if (typeof finalOffset !== 'number' && locName) {
      const foundCity = OFFLINE_CITIES.find(
        (c) => c.name.toLowerCase() === locName.toLowerCase() || c.tamilName === locName
      );
      if (foundCity) {
        finalLat = foundCity.lat;
        finalLng = foundCity.lng;
        const tzInfo = getLocationTimezoneInfo(foundCity);
        finalOffset = tzInfo.offsetMinutes;
        finalTz = tzInfo.timezoneName;
      }
    }

    if (typeof finalOffset !== 'number' && finalLat !== undefined && finalLng !== undefined) {
      const tzInfo = getLocationTimezoneInfo({ lat: finalLat, lng: finalLng, timezone });
      finalOffset = tzInfo.offsetMinutes;
      finalTz = tzInfo.timezoneName;
    }

    if (typeof finalOffset !== 'number') {
      finalOffset = 330;
    }

    setLocationTimezoneOffset(finalOffset);
    if (finalTz) setLocationTimezone(finalTz);
    if (finalLat !== undefined) setLocationLat(finalLat);
    if (finalLng !== undefined) setLocationLng(finalLng);

    localStorage.setItem('pancha_location_tz_offset', String(finalOffset));
    if (finalTz) localStorage.setItem('pancha_location_tz', finalTz);
    if (finalLat !== undefined) localStorage.setItem('pancha_location_lat', String(finalLat));
    if (finalLng !== undefined) localStorage.setItem('pancha_location_lng', String(finalLng));

    // Calculate the exact local time, local calendar date, day of week, and lunar Paksha according to that location's timezone
    const targetMoment = getTargetLocationCurrentMoment(finalOffset, new Date());
    const localDay = DAYS_MAP[targetMoment.dayOfWeek];
    const localLunar = getLunarDayInfo(targetMoment.localDate);
    const localPaksha = localLunar.paksha;

    // The Pancha Pakshi 14-day calculation cycle automatically sets its active day and bird order to the location's local day
    setSelectedDay(localDay);
    setSelectedPaksha(localPaksha);
    setSelectedCalendarDate(targetMoment.localDate);

    localStorage.setItem('pancha_selected_day', localDay);
    localStorage.setItem('pancha_selected_paksha', localPaksha);
    localStorage.setItem('pancha_selected_calendar_date', targetMoment.localDate.toISOString());

    // Sunrise, sunset, and next sunrise calculated in that location's local solar time
    let effectiveSRise = sRise;
    let effectiveSSet = sSet;
    let effectiveNRise = nRise;

    if (finalLat !== undefined && finalLng !== undefined) {
      const solar = calculateSolarTimes(finalLat, finalLng, targetMoment.localDate, finalOffset);
      effectiveSRise = solar.sunrise;
      effectiveSSet = solar.sunset;
      effectiveNRise = solar.nextSunrise;
    }

    setSunriseTime(effectiveSRise);
    setSunsetTime(effectiveSSet);
    setNextSunriseTime(effectiveNRise);
    setLocationName(locName || '');
    setIsCustomSchedule(true);

    localStorage.setItem('pancha_sunrise', effectiveSRise);
    localStorage.setItem('pancha_sunset', effectiveSSet);
    localStorage.setItem('pancha_next_sunrise', effectiveNRise);
    localStorage.setItem('pancha_location_name', locName || '');
    localStorage.setItem('pancha_is_custom', 'true');
  };

  const handleResetSchedule = () => {
    const defaultSR = baseJamasResult.defaultSunrise || '06:00';
    const defaultSS = baseJamasResult.defaultSunset || '18:00';
    const defaultNSR = baseJamasResult.defaultNextSunrise || '06:00';
    setSunriseTime(defaultSR);
    setSunsetTime(defaultSS);
    setNextSunriseTime(defaultNSR);
    setLocationName('');
    setLocationLat(null);
    setLocationLng(null);
    setLocationTimezone('Asia/Kolkata');
    setLocationTimezoneOffset(330);
    setTimeDisplayMode('local');
    setIsCustomSchedule(false);

    localStorage.removeItem('pancha_sunrise');
    localStorage.removeItem('pancha_sunset');
    localStorage.removeItem('pancha_next_sunrise');
    localStorage.removeItem('pancha_location_name');
    localStorage.removeItem('pancha_location_lat');
    localStorage.removeItem('pancha_location_lng');
    localStorage.removeItem('pancha_location_tz');
    localStorage.removeItem('pancha_location_tz_offset');
    localStorage.removeItem('pancha_time_display_mode');
    localStorage.removeItem('pancha_is_custom');
  };

  const handleToggleTimeDisplayMode = (mode: 'local' | 'ist') => {
    setTimeDisplayMode(mode);
    localStorage.setItem('pancha_time_display_mode', mode);
  };

  const handleSelectPakshaAndDay = (paksha: PakshaType, day: DayOfWeek, date?: Date) => {
    setSelectedPaksha(paksha);
    setSelectedDay(day);
    if (date) {
      setSelectedCalendarDate(date);
      localStorage.setItem('pancha_selected_calendar_date', date.toISOString());
    }
  };

  const handleCustomDayUploaded = (_dayId: string, _jamas: Jama[]) => {
    setCustomDaysVersion((v) => v + 1);
  };

  const displayedJamas: Jama[] = displayJamasList.filter((j: Jama) => {
    if (jamaFilter === 'day') return j.isDay;
    if (jamaFilter === 'night') return !j.isDay;
    return true;
  });

  // Active section for 4-column navigation
  const [activeSection, setActiveSection] = useState<string>('section-date-day');
  const isScrollingByUserRef = useRef(false);
  const scrollTimeoutRef = useRef<number | null>(null);

  // Smooth-scroll directly to section with header offset compensation
  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    isScrollingByUserRef.current = true;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = window.setTimeout(() => {
      isScrollingByUserRef.current = false;
    }, 700);

    const el = document.getElementById(sectionId);
    if (!el) return;
    const header = document.getElementById('fixed-top-header');
    const headerHeight = header ? header.getBoundingClientRect().height : 100;
    const elementPosition = el.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - headerHeight - 12;

    window.scrollTo({
      top: Math.max(0, offsetPosition),
      behavior: 'smooth',
    });
  };

  // Scroll spy to update active section when user scrolls
  useEffect(() => {
    const handleScroll = () => {
      if (isScrollingByUserRef.current) return;
      const header = document.getElementById('fixed-top-header');
      const headerHeight = header ? header.getBoundingClientRect().height : 100;
      const scrollPos = window.scrollY + headerHeight + 50;

      const sectionIds = ['section-date-day', 'section-location', 'section-bird', 'section-activity'];
      for (let i = sectionIds.length - 1; i >= 0; i--) {
        const id = sectionIds[i];
        const el = document.getElementById(id);
        if (el) {
          const top = el.offsetTop;
          if (scrollPos >= top) {
            setActiveSection(id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF6EE] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-[#1B4332] selection:text-white transition-colors duration-150">
      {/* Pinned FixedTopHeader: Stays permanently fixed at the top of the viewport (fixed top-0 z-40) */}
      <FixedTopHeader
        selectedPaksha={selectedPaksha}
        selectedDay={selectedDay}
        selectedCalendarDate={selectedCalendarDate}
        locationName={locationName}
        dayMeta={dayMeta}
        runningJamaNumber={runningJamaNumber}
        onScrollToSection={scrollToSection}
        selectedBird={selectedBird}
        onSelectBird={(id) => setSelectedBird(id)}
        onOpenCalendarModal={() => setIsCalendarModalOpen(true)}
        onOpenLookupModal={() => setIsLookupModalOpen(true)}
        theme={theme}
        setTheme={setTheme}
        language={language}
        setLanguage={setLanguage}
        isOtherLocation={isOtherLocation}
        timeDisplayMode={timeDisplayMode}
        onToggleTimeDisplayMode={handleToggleTimeDisplayMode}
        tzAbbreviation={tzAbbreviation}
      />

      {/* Main Content Body with top & bottom padding compensating for fixed header and bottom nav */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 lg:p-6 space-y-4 sm:space-y-5 pt-24 sm:pt-28 pb-24 sm:pb-20">
        {/* Section 1: Date & Day (Paksha & Day selector) */}
        <section id="section-date-day" aria-label="Date & Day Selector" className="scroll-mt-24 sm:scroll-mt-28">
          <PakshaDaySelector
            selectedPaksha={selectedPaksha}
            selectedDay={selectedDay}
            onSelectPakshaAndDay={handleSelectPakshaAndDay}
            onCustomDayUploaded={handleCustomDayUploaded}
            onOpenCalendar={() => setIsCalendarModalOpen(true)}
            selectedDate={selectedCalendarDate}
          />
        </section>

        {/* Section 2: Location (Sunrise, sunset & custom location calculations) */}
        <section id="section-location" aria-label="Sunrise, Sunset & Location" className="scroll-mt-24 sm:scroll-mt-28">
          <SunriseSunsetBar
            sunriseTime={sunriseTime}
            sunsetTime={sunsetTime}
            nextSunriseTime={nextSunriseTime}
            displaySunrise={displaySunrise}
            displaySunset={displaySunset}
            displayNextSunrise={displayNextSunrise}
            isCustomSchedule={isCustomSchedule}
            onApplySunriseSunset={handleApplySunriseSunset}
            onResetSchedule={handleResetSchedule}
            locationName={locationName}
            baseJamas={baseJamasResult.jamas}
            isOtherLocation={isOtherLocation}
            timeDisplayMode={timeDisplayMode}
            onToggleTimeDisplayMode={handleToggleTimeDisplayMode}
            tzAbbreviation={tzAbbreviation}
            timeDifferenceText={timeDifferenceText}
            localDayName={liveClocks.targetMoment.dayName}
            localDateText={liveClocks.targetMoment.dateString}
            localPakshaText={getPakshaName(selectedPaksha)}
            localTimeText={liveClocks.targetMoment.timeString}
          />
        </section>

        {/* Section 3: Bird (Bird selector and real-time status banner) */}
        <section id="section-bird" aria-label="Bird Selection & Status" className="scroll-mt-24 sm:scroll-mt-28 space-y-4 sm:space-y-5">
          <BirdSelector
            selectedBird={selectedBird}
            onSelectBird={(id) => setSelectedBird(id)}
            dayMeta={dayMeta}
            paksha={selectedPaksha}
          />

          <CurrentStatusBanner
            selectedBird={selectedBird}
            customJamas={displayJamasList}
            currentMinutes={activeCurrentMinutes}
            isOtherLocation={isOtherLocation}
            timeDisplayMode={timeDisplayMode}
            tzAbbreviation={tzAbbreviation}
            locationName={locationName}
          />
        </section>

        {/* Section 4: Activity (10 Jamas cards, activity chart, and master table) */}
        <section id="section-activity" aria-label="Jamas & Activity Cycles" className="scroll-mt-24 sm:scroll-mt-28 space-y-4 sm:space-y-5">
          {/* Navigation Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E8DFCE] dark:border-slate-800 pb-3">
            {/* Main Views */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-xs font-semibold">
              <button
                onClick={() => setActiveTab('jamas')}
                id="tab-jamas-btn"
                className={`px-4 py-2.5 min-h-[44px] rounded-2xl flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                  activeTab === 'jamas'
                    ? 'bg-[#1B4332] text-white font-bold shadow-xs'
                    : 'text-slate-700 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-[#EFE7D8] dark:hover:bg-slate-900'
                }`}
              >
                <Layers className="w-4 h-4" strokeWidth={1.5} />
                <span>{t('tabJamas')}</span>
              </button>

              <button
                onClick={() => setActiveTab('chart')}
                id="tab-chart-btn"
                className={`px-4 py-2.5 min-h-[44px] rounded-2xl flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                  activeTab === 'chart'
                    ? 'bg-[#1B4332] text-white font-bold shadow-xs'
                    : 'text-slate-700 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-[#EFE7D8] dark:hover:bg-slate-900'
                }`}
              >
                <TrendingUp className="w-4 h-4" strokeWidth={1.5} />
                <span>{t('tabChart')}</span>
              </button>

              <button
                onClick={() => setActiveTab('master')}
                id="tab-master-btn"
                className={`px-4 py-2.5 min-h-[44px] rounded-2xl flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                  activeTab === 'master'
                    ? 'bg-[#1B4332] text-white font-bold shadow-xs'
                    : 'text-slate-700 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-[#EFE7D8] dark:hover:bg-slate-900'
                }`}
              >
                <Table className="w-4 h-4" strokeWidth={1.5} />
                <span>{t('tabMaster')}</span>
              </button>
            </div>

            {/* Sub-Filter for Day/Night when in Jamas tab */}
            {activeTab === 'jamas' && (
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-[#E8DFCE] dark:border-slate-800 text-xs self-start sm:self-auto shadow-2xs">
                <button
                  onClick={() => setJamaFilter('all')}
                  id="jama-filter-all-btn"
                  className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer font-bold ${
                    jamaFilter === 'all'
                      ? 'bg-[#FAF6EE] dark:bg-slate-800 text-slate-900 dark:text-white border border-[#E8DFCE] dark:border-slate-700'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {t('filterAllJamas')}
                </button>
                <button
                  onClick={() => setJamaFilter('day')}
                  id="jama-filter-day-btn"
                  className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 font-bold ${
                    jamaFilter === 'day'
                      ? 'bg-[#C29738] text-slate-950 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>{t('filterDayJamas')}</span>
                </button>
                <button
                  onClick={() => setJamaFilter('night')}
                  id="jama-filter-night-btn"
                  className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 font-bold ${
                    jamaFilter === 'night'
                      ? 'bg-[#133E46] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>{t('filterNightJamas')}</span>
                </button>
              </div>
            )}
          </div>

          {/* Tab Contents */}
          {activeTab === 'jamas' && (
            <section aria-label="10 Jamas Cards" className="space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 px-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span>
                    {t('showingJamasFor')}{' '}
                    <strong className="text-slate-950 dark:text-white font-bold">{currentBirdDisplayName}</strong>
                  </span>
                  <span className="text-slate-400 dark:text-slate-600 hidden sm:inline">•</span>
                  <span className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>
                      {language === 'ta'
                        ? `நடப்பு சாமம் ${runningJamaNumber} (தற்போது விரிக்கப்பட்டுள்ளது)`
                        : `Running Jama ${runningJamaNumber} (Currently Expanded)`}
                    </span>
                  </span>

                  {isOtherLocation && timeDisplayMode === 'ist' && (
                    <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-bold bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      🇮🇳 IST Display (+05:30)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setExpandedJamaNumber(runningJamaNumber)}
                    id="expand-running-jama-only-btn"
                    className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer font-medium ${
                      expandedJamaNumber === runningJamaNumber
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-800 dark:text-amber-300 font-bold'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 shadow-2xs'
                    }`}
                    title={t('runningJamaExpandedOnly')}
                  >
                    {t('expandRunningOnlyBtn')}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (expandedJamaNumber === -1) {
                        setExpandedJamaNumber(runningJamaNumber);
                      } else {
                        setExpandedJamaNumber(-1); // -1 signifies expand all
                      }
                    }}
                    id="expand-all-jamas-btn"
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer font-medium transition-colors shadow-2xs"
                  >
                    {expandedJamaNumber === -1 ? t('contractAllBtn') : t('expandAllBtn')}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {displayedJamas.map((jama: Jama) => {
                  const isCardExpanded =
                    expandedJamaNumber === -1
                      ? true
                      : expandedJamaNumber === jama.jamaNumber;

                  return (
                    <JamaCard
                      key={jama.jamaNumber}
                      jama={jama}
                      selectedBird={selectedBird}
                      currentMinutes={activeCurrentMinutes}
                      isExpanded={isCardExpanded}
                      onToggleExpand={() => {
                        setExpandedJamaNumber((prev) =>
                          prev === jama.jamaNumber ? null : jama.jamaNumber
                        );
                      }}
                      cycleStartMinutes={displayJamasList[0]?.startMinutesFromMidnight ?? 360}
                      paksha={selectedPaksha}
                    />
                  );
                })}
              </div>
            </section>
          )}

          {activeTab === 'chart' && (
            <ActivityChartView
              selectedBird={selectedBird}
              customJamas={displayJamasList}
              sunriseTime={displaySunrise}
              sunsetTime={displaySunset}
              nextSunriseTime={displayNextSunrise}
              onSelectBird={(birdId) => setSelectedBird(birdId)}
            />
          )}

          {activeTab === 'master' && (
            <MasterTableView
              selectedBird={selectedBird}
              customJamas={displayJamasList}
            />
          )}
        </section>
      </main>

      {/* Time Lookup & Sunrise/Sunset Modal */}
      <TimeLookupModal
        isOpen={isLookupModalOpen}
        onClose={() => setIsLookupModalOpen(false)}
        selectedBird={selectedBird}
        customJamas={displayJamasList}
        onApplySunriseSunset={handleApplySunriseSunset}
        currentSunrise={sunriseTime}
        currentSunset={sunsetTime}
        currentNextSunrise={nextSunriseTime}
        isCustomSchedule={isCustomSchedule}
        onResetSchedule={handleResetSchedule}
        locationName={locationName}
      />

      {/* Real-Time Astronomical & Panchang Calendar Modal */}
      <RealTimeCalendarModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        currentPaksha={selectedPaksha}
        currentDay={selectedDay}
        onSelectPakshaAndDay={handleSelectPakshaAndDay}
        selectedDate={selectedCalendarDate}
      />

      {/* Bird Selection Popup Modal */}
      <BirdSelectModal
        isOpen={isBirdSelectModalOpen}
        onClose={() => setIsBirdSelectModalOpen(false)}
        selectedBird={selectedBird}
        onSelectBird={(id) => setSelectedBird(id)}
      />

      {/* Equal 4-Column Layout Fixed Bottom Navigation Bar */}
      <FixedBottomNav
        activeSection={activeSection}
        onScrollToSection={scrollToSection}
        selectedBird={selectedBird}
        onOpenBirdSelectModal={() => setIsBirdSelectModalOpen(true)}
        locationName={locationName}
      />
    </div>
  );
}
