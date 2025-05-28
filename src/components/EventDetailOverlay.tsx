// File: src/components/EventDetailOverlay.tsx
import React, { useEffect, useState, useRef } from "react";
import { EventData } from "../types";
import { CalendarIcon, ClockIcon, PinIcon, EuroIcon, XMarkIcon } from "./Icons"; // Assuming XMarkIcon is your close icon
import EventHero from "./EventHero";
import EventInfoGrid from "./EventInfoGrid";
import EventContentSections from "./EventContentSections";
import EventActionsFooter from "./EventActionsFooter";

interface EventDetailOverlayProps {
  event: EventData | null;
  onClose: () => void;
  handleAddToCalendar: (event: EventData) => Promise<void>;
  openEventUrl: (url?: string) => Promise<void>;
  theme: "light" | "dark";
}

// Updated formatDate to include weekday
const formatDate = (dateTimeStr?: string): { main: string; sub?: string } => {
  if (!dateTimeStr) return { main: "N/A" };
  try {
    const date = new Date(dateTimeStr.replace(" ", "T"));
    if (isNaN(date.getTime())) return { main: dateTimeStr };
    const mainDate = date.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    // We don't have a direct "This weekend" type of data, so sub will be omitted for date for now
    return { main: mainDate };
  } catch (e) {
    return { main: dateTimeStr };
  }
};

const formatTime = (dateTimeStr?: string): string => {
  if (!dateTimeStr) return "N/A";
  try {
    const date = new Date(dateTimeStr.replace(" ", "T"));
    if (isNaN(date.getTime())) return "N/A";
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
    });
  } catch (e) {
    return "N/A";
  }
};

const calculateDuration = (
  startStr?: string,
  endStr?: string
): string | null => {
  if (!startStr || !endStr) return null;
  try {
    const startDate = new Date(startStr.replace(" ", "T"));
    const endDate = new Date(endStr.replace(" ", "T"));
    if (
      isNaN(startDate.getTime()) ||
      isNaN(endDate.getTime()) ||
      endDate <= startDate
    )
      return null;

    let diffMs = endDate.getTime() - startDate.getTime();
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0 && minutes === 0) return null;
    let durationString = "";
    if (hours > 0) durationString += `${hours} hour${hours > 1 ? "s" : ""}`;
    if (minutes > 0) {
      if (hours > 0) durationString += " ";
      durationString += `${minutes} minute${minutes > 1 ? "s" : ""}`;
    }
    return durationString ? `${durationString} duration` : null;
  } catch (e) {
    return null;
  }
};

// New InfoItem component to match the design (icon, main text, optional sub-text)
const InfoRowItem: React.FC<{
  icon: React.ReactNode;
  mainText: string | React.ReactNode;
  subText?: string | React.ReactNode;
  className?: string;
}> = ({ icon, mainText, subText, className }) => {
  if (!mainText || mainText === "N/A") return null;
  return (
    <div className={`flex items-start space-x-3 ${className}`}>
      <div className="flex-shrink-0 w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-1 opacity-80">
        {icon}
      </div>
      <div className="flex-grow">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
          {mainText}
        </p>
        {subText && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{subText}</p>
        )}
      </div>
    </div>
  );
};

const INITIAL_HERO_HEIGHT_DESKTOP = 320; // md:h-80
const INITIAL_HERO_HEIGHT_TABLET = 288; // sm:h-72
const INITIAL_HERO_HEIGHT_MOBILE = 240; // h-60
const MIN_HERO_HEIGHT = 100; // Minimum height the hero can shrink to
const SCROLL_RANGE_FOR_EFFECT = 150; // How many pixels of scroll to achieve full shrink/blur

const EventDetailOverlay: React.FC<EventDetailOverlayProps> = ({
  event: eventProp,
  onClose,
  handleAddToCalendar,
  openEventUrl,
  theme,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const scrollableContentRef = useRef<HTMLDivElement>(null);

  // Determine initial hero height based on window width (simplified)
  const getInitialHeroHeight = () => {
    if (typeof window !== "undefined") {
      if (window.innerWidth >= 768) return INITIAL_HERO_HEIGHT_DESKTOP;
      if (window.innerWidth >= 640) return INITIAL_HERO_HEIGHT_TABLET;
    }
    return INITIAL_HERO_HEIGHT_MOBILE;
  };
  const [currentHeroHeight, setCurrentHeroHeight] = useState(
    getInitialHeroHeight()
  );
  // Optional: add state for hero blur
  // const [heroBlur, setHeroBlur] = useState(0);

  useEffect(() => {
    // Recalculate initial hero height on window resize
    const handleResize = () => {
      setCurrentHeroHeight(getInitialHeroHeight());
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // --- PASTE getRelativeDateInfo HERE ---
const getRelativeDateInfo = (dateStr?: string): string | undefined => {
  if (!dateStr) return undefined;
  try {
    const eventDate = new Date(dateStr.replace(' ', 'T'));
    if (isNaN(eventDate.getTime())) return undefined;

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const eventDateStart = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());

    const diffTime = eventDateStart.getTime() - todayStart.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays === -1) return "Yesterday";

    const eventDayOfWeek = eventDate.getDay(); // 0 = Sunday, 6 = Saturday
    if ((eventDayOfWeek === 0 || eventDayOfWeek === 6) && diffDays > 1 && diffDays < 7) {
      return "This weekend";
    }

    if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
    
    return undefined;
  } catch (e) {
    console.error("Error in getRelativeDateInfo:", e);
    return undefined;
  }
};
// --- END OF getRelativeDateInfo ---

  useEffect(() => {
    if (eventProp) {
      setIsVisible(true);
      document.body.style.overflow = "hidden";
      // Reset scroll position of content area when a new event is shown
      if (scrollableContentRef.current) {
        scrollableContentRef.current.scrollTop = 0;
      }
      setCurrentHeroHeight(getInitialHeroHeight()); // Reset hero height
      // setHeroBlur(0); // Reset blur
    } else {
      setIsVisible(false);
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [eventProp]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && eventProp) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [eventProp, onClose]);

  // Parallax scroll effect for Hero
  useEffect(() => {
    const scrollNode = scrollableContentRef.current;
    if (!scrollNode || !eventProp) return;

    const handleScroll = () => {
      const scrollTop = scrollNode.scrollTop;
      const scrollRatio = Math.min(1, scrollTop / SCROLL_RANGE_FOR_EFFECT);
      const initialH = getInitialHeroHeight();

      const newHeight = Math.max(
        MIN_HERO_HEIGHT,
        initialH - (initialH - MIN_HERO_HEIGHT) * scrollRatio
      );
      setCurrentHeroHeight(newHeight);

      // Optional: Apply blur
      // const newBlur = Math.min(5, 5 * scrollRatio); // Max blur 5px
      // setHeroBlur(newBlur);
    };

    scrollNode.addEventListener("scroll", handleScroll);
    return () => scrollNode.removeEventListener("scroll", handleScroll);
  }, [eventProp]); // Re-attach if eventProp changes (though scrollNode itself shouldn't change often)

  if (!eventProp && !isVisible) {
    return null;
  }

  const currentEvent = eventProp; // Use for rendering to avoid flicker during close animation

  // Data formatting for sub-components
  const { main: dateMainText } = currentEvent?.start_datetime
    ? formatDate(currentEvent.start_datetime)
    : {
        main:
          currentEvent?.list_date ||
          currentEvent?.date_time_summary ||
          "Date N/A",
      };
  const dateSubTextRelative = getRelativeDateInfo(currentEvent?.start_datetime);

  const startTimeStr = currentEvent?.start_datetime
    ? formatTime(currentEvent.start_datetime)
    : null;
  const endTimeStr = currentEvent?.end_datetime
    ? formatTime(currentEvent.end_datetime)
    : null;
  const durationSubText = calculateDuration(
    currentEvent?.start_datetime,
    currentEvent?.end_datetime
  );
  const timeMainText = startTimeStr
    ? `${startTimeStr}${endTimeStr ? ` - ${endTimeStr}` : ""}`
    : "Time N/A";

  let locationMainText =
    currentEvent?.specific_location_name ||
    currentEvent?.list_specific_location ||
    "Location N/A";
  let locationSubText = currentEvent?.address;
  if (
    locationSubText &&
    locationSubText.includes(locationMainText) &&
    locationSubText !== locationMainText
  ) {
    locationSubText = locationSubText
      .replace(locationMainText, "")
      .replace(/^,\s*/, "");
  } else if (locationSubText === locationMainText) {
    locationSubText = undefined;
  }
  if (locationMainText === "Location N/A" && locationSubText) {
    locationMainText = locationSubText;
    locationSubText = undefined;
  }

  const priceMainText =
    currentEvent?.price || currentEvent?.list_price || "Price N/A";
  const descriptionMainText =
    currentEvent?.full_description ||
    currentEvent?.short_description ||
    "No description available.";

  const eventLocationForMap =
    currentEvent?.latitude && currentEvent?.longitude && currentEvent?.id
      ? {
          lat: currentEvent.latitude,
          lon: currentEvent.longitude,
          id: currentEvent.id,
        }
      : undefined;

  return (
    <div
      className={`fixed inset-0 z-40 flex items-center justify-center
                  ${isVisible ? "pointer-events-auto" : "pointer-events-none"}`}
      onClick={handleClose}
    >
      <div
        className={`absolute inset-0 bg-black/60 dark:bg-black/75 backdrop-blur-lg
                    transition-opacity duration-300 ease-in-out
                    ${isVisible ? "opacity-100" : "opacity-0"}`}
      ></div>

      <div
        className={`relative bg-gray-50 dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col overflow-hidden
                    transition-all duration-300 ease-in-out
                    ${
                      isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"
                    }`}
        onClick={(e) => e.stopPropagation()}
      >
        <EventHero
          title={currentEvent?.title}
          imageUrl={currentEvent?.image_url}
          shortDescription={currentEvent?.short_description}
          onClose={handleClose}
          currentHeroHeight={currentHeroHeight}
          // heroStyle={{ filter: `blur(${heroBlur}px)` }} // If using blur
        />

        <div
          ref={scrollableContentRef}
          className="overflow-y-auto flex-grow p-5 sm:p-6 space-y-6 bg-white dark:bg-slate-800"
        >
          <EventInfoGrid
            dateMainText={dateMainText}
            dateSubText={dateSubTextRelative}
            timeMainText={timeMainText}
            timeSubText={durationSubText}
            locationMainText={locationMainText}
            locationSubText={locationSubText}
            priceMainText={priceMainText}
          />
          <EventContentSections
            description={descriptionMainText}
            eventLocation={eventLocationForMap}
            theme={theme}
          />
        </div>

        <EventActionsFooter
          currentEvent={currentEvent}
          handleAddToCalendar={handleAddToCalendar}
          openEventUrl={openEventUrl}
        />
      </div>
    </div>
  );
};

// Re-exporting these as they were in the original for completeness,
// but ideally they'd be in dateUtils.ts and imported.
export { formatDate, formatTime, calculateDuration };
export default EventDetailOverlay;
