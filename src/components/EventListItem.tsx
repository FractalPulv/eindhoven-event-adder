// File: src/components/EventListItem.tsx
import React from "react";
import { EventData } from "../types";
import { CalendarIcon, PinIcon, EuroIcon } from "./Icons";
import Tilt from 'react-parallax-tilt';
interface EventListItemProps {
  event: EventData;
  onSelectEvent: (event: EventData) => void;
  isSelectedInGrid?: boolean;
  isLoadingDetails?: boolean;
}

const formatDate = (dateTimeStr?: string): string => {
  if (!dateTimeStr) return "N/A";
  try {
    const date = new Date(dateTimeStr.replace(" ", "T"));
    if (isNaN(date.getTime())) return dateTimeStr;
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch (e) {
    return dateTimeStr;
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

const GridInfoRow: React.FC<{
  icon: React.ReactNode;
  text?: string | null;
  className?: string;
  title?: string;
}> = ({ icon, text, className = "", title }) => {
  if (!text || text === "N/A") return null;
  return (
    <div
      className={`flex items-center space-x-1.5 text-xs ${className}`}
      title={title}
    >
      <span className="flex-shrink-0 w-3.5 h-3.5 text-gray-500 dark:text-gray-400">
        {icon}
      </span>
      <span
        className="text-gray-600 dark:text-gray-300 leading-snug truncate"
        style={{ maxWidth: "calc(100% - 20px)" }}
      >
        {text}
      </span>
    </div>
  );
};

const EventListItem: React.FC<EventListItemProps> = ({
  event,
  onSelectEvent,
  isSelectedInGrid,
  isLoadingDetails,
}) => {
  const itemDate =
    event.isDetailed && event.start_datetime
      ? formatDate(event.start_datetime)
      : event.list_date || event.date_time_summary || null;

  const itemTime =
    event.isDetailed && event.start_datetime
      ? formatTime(event.start_datetime) +
        (event.end_datetime ? ` - ${formatTime(event.end_datetime)}` : "")
      : null;

  const displayDateTimeOnCard =
    itemDate && itemTime
      ? `${itemDate} • ${itemTime}`
      : itemDate || itemTime
      ? itemDate || itemTime
      : event.date_time_summary || event.list_date || "Date/Time N/A";

  const displayLocationOnCard =
    event.list_specific_location ||
    event.specific_location_name ||
    (event.isDetailed && event.address
      ? event.address.split(",")[0]
      : "Location N/A");
  const displayPriceOnCard =
    event.list_price || (event.isDetailed && event.price) || "Price N/A";

  const currentTheme = document.documentElement.classList.contains("dark")
    ? "dark"
    : "light";
  const imagePlaceholderSvg =
    "data:image/svg+xml;charset=UTF-8,%3Csvg width='120' height='120' viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='120' height='120' fill='%23E5E7EB'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23A0AEC0' font-family='sans-serif' font-size='10px'%3EImage%3C/text%3E%3C/svg%3E";
  const darkImagePlaceholderSvg =
    "data:image/svg+xml;charset=UTF-8,%3Csvg width='120' height='120' viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='120' height='120' fill='%231f2937'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%234b5563' font-family='sans-serif' font-size='10px'%3EImage%3C/text%3E%3C/svg%3E"; // Updated placeholder dark bg to a dark gray

  return (
    <Tilt
      className="w-full h-full"
    >
      <div
        className={`group relative flex flex-col overflow-hidden rounded-xl bg-white dark:bg-neutral-900/80 backdrop-blur-sm 
                  shadow-lg hover:shadow-xl focus-within:shadow-xl
                  transition-all duration-300 ease-in-out cursor-pointer h-full 
                  ${
                    isSelectedInGrid
                      ? "ring-2 ring-blue-500 dark:ring-blue-400"
                      : "border border-gray-200 dark:border-neutral-800/70" // Adjusted dark border
                  }
                  ${
                    isLoadingDetails && isSelectedInGrid
                      ? "opacity-60 animate-pulse"
                      : ""
                  }`}
        onClick={
          !(isLoadingDetails && isSelectedInGrid)
            ? () => onSelectEvent(event)
            : undefined
        }
        tabIndex={0}
        onKeyPress={(e) => {
          if (e.key === "Enter" || e.key === " ") onSelectEvent(event);
        }}
      >
        <div className="w-full h-36 sm:h-40 flex-shrink-0 bg-gray-100 dark:bg-neutral-800"> {/* Adjusted dark bg for image container */}
          {event.image_url ? (
            <img
              src={event.image_url}
              alt={event.title}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                const target = e.currentTarget;
                target.onerror = null;
                target.src =
                  currentTheme === "dark"
                    ? darkImagePlaceholderSvg
                    : imagePlaceholderSvg;
                target.alt = "Image error";
              }}
            />
          ) : (
            <img
              src={
                currentTheme === "dark"
                  ? darkImagePlaceholderSvg
                  : imagePlaceholderSvg
              }
              alt="No image"
              className="w-full h-full object-cover"
              loading="lazy"
            />
          )}
        </div>

        <div className="p-3 sm:p-4 flex-grow flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-sm sm:text-base text-blue-600 dark:text-blue-400 mb-1.5 leading-tight group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors line-clamp-2">
              {event.title}
            </h3>

            <div className="space-y-1 text-xs">
              {displayDateTimeOnCard !== "Date/Time N/A" && (
                <GridInfoRow
                  icon={<CalendarIcon />}
                  text={displayDateTimeOnCard}
                  title={event.datetime_str_raw_detail || "Date and Time"}
                />
              )}
              {displayLocationOnCard !== "Location N/A" && (
                <GridInfoRow
                  icon={<PinIcon />}
                  text={displayLocationOnCard}
                  title="Location"
                />
              )}
              {displayPriceOnCard !== "Price N/A" && (
                <GridInfoRow
                  icon={<EuroIcon />}
                  text={displayPriceOnCard}
                  className="text-green-600 dark:text-green-400"
                  title="Price"
                />
              )}
            </div>
          </div>

          {event.short_description &&
            (!isSelectedInGrid || !event.isDetailed) && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 leading-relaxed line-clamp-2">
                {event.short_description}
              </p>
            )}
        </div>
      </div>
    </Tilt>
  );
};

export default EventListItem;