// File: src/components/EventDetailOverlay.tsx
import React, { useEffect, useState, useRef } from "react";
import { EventData } from "../types";
import { XMarkIcon } from "./Icons";
import EventHero from "./EventHero";
import EventInfoGrid from "./EventInfoGrid";
import EventContentSections from "./EventContentSections";
import EventActionsFooter from "./EventActionsFooter";
import { getRelativeDateInfo } from "../utils/dateUtils";

interface EventDetailOverlayProps {
  event: EventData | null;
  onClose: () => void;
  handleAddToCalendar: (event: EventData) => Promise<void>;
  openEventUrl: (url?: string) => Promise<void>;
  theme: "light" | "dark";
}

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

const INITIAL_HERO_HEIGHT_DESKTOP = 320;
const INITIAL_HERO_HEIGHT_TABLET = 288;
const INITIAL_HERO_HEIGHT_MOBILE = 240;
const MIN_HERO_HEIGHT = 100;
const SCROLL_RANGE_FOR_EFFECT = 150;

const EventDetailOverlay: React.FC<EventDetailOverlayProps> = ({
  event: eventProp,
  onClose,
  handleAddToCalendar,
  openEventUrl,
  theme,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const scrollableContentRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const handleResize = () => {
      setCurrentHeroHeight(getInitialHeroHeight());
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (eventProp) {
      setIsVisible(true);
      document.body.style.overflow = "hidden";
      if (scrollableContentRef.current) {
        scrollableContentRef.current.scrollTop = 0;
      }
      setCurrentHeroHeight(getInitialHeroHeight());
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
    };

    scrollNode.addEventListener("scroll", handleScroll);
    return () => scrollNode.removeEventListener("scroll", handleScroll);
  }, [eventProp]);

  if (!eventProp && !isVisible) {
    return null;
  }

  const currentEvent = eventProp;

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
        className={`absolute inset-0 bg-black/70 dark:bg-black/80 backdrop-blur-md 
                    transition-opacity duration-300 ease-in-out
                    ${isVisible ? "opacity-100" : "opacity-0"}`}
      ></div>

      <div
        className={`relative bg-gray-50 dark:bg-neutral-950 rounded-xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col overflow-hidden
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
        />

        <div
          ref={scrollableContentRef}
          className="overflow-y-auto flex-grow p-5 sm:p-6 space-y-6 bg-white dark:bg-neutral-900" // Updated dark bg
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
          openExternalUrl={openEventUrl}
        />
      </div>
    </div>
  );
};

export { formatDate, formatTime, calculateDuration };
export default EventDetailOverlay;