// File: src/components/EventCalendar.tsx
import React from 'react';
import { EventData } from '../types';
import EventListItem from './EventListItem';
import { format, startOfWeek, addDays, isSameDay, min, max, eachDayOfInterval, parse, differenceInDays } from 'date-fns';

// Helper function to parse various list_date formats
const parseListDateRange = (dateString?: string) => {
  let startDate: Date | null = null;
  let endDate: Date | null = null;

  if (!dateString) return { startDate, endDate };

  // Try to parse single date (e.g., "09 Jul 2025")
  try {
    const parsed = parse(dateString, "dd MMM yyyy", new Date());
    if (!isNaN(parsed.getTime())) {
      startDate = parsed;
      endDate = parsed;
      return { startDate, endDate };
    }
  } catch (e) { /* ignore */ }

  // Try to parse date range (e.g., "12 Jul 2025 up to 13 Jul 2025")
  const rangeMatch = dateString.match(/(\d{1,2} \w{3} \d{4}) up to (\d{1,2} \w{3} \d{4})/);
  if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
    try {
      const parsedStart = parse(rangeMatch[1], "dd MMM yyyy", new Date());
      const parsedEnd = parse(rangeMatch[2], "dd MMM yyyy", new Date());
      if (!isNaN(parsedStart.getTime()) && !isNaN(parsedEnd.getTime())) {
        startDate = parsedStart;
        endDate = parsedEnd;
        return { startDate, endDate };
      }
    } catch (e) { /* ignore */ }
  }

  // For recurring events like "Every Thursday", we don't assign a concrete date for now
  // console.warn("Could not parse list_date into a concrete date range:", dateString);
  return { startDate: null, endDate: null };
};

interface EventCalendarProps {
  events: EventData[];
  onSelectEvent: (event: EventData) => void;
  loadingDetailsFor: string | null;
  eventInOverlayId: string | null;
}

const stringToHash = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

const EventCalendar: React.FC<EventCalendarProps> = ({
  events,
  onSelectEvent,
  loadingDetailsFor,
  eventInOverlayId,
}) => {
  const allEventDates = events
    .map((event) => {
      if (event.start_datetime) {
        const parsedDate = new Date(event.start_datetime);
        return isNaN(parsedDate.getTime()) ? null : parsedDate;
      } else if (event.list_date) {
        const { startDate } = parseListDateRange(event.list_date);
        return startDate;
      }
      return null;
    })
    .filter(Boolean) as Date[];
  console.log("All Event Dates:", allEventDates);

  let calendarDays: Date[] = [];
  if (allEventDates.length > 0) {
    const minDate = min(allEventDates);
    const maxDate = max(allEventDates);
    console.log("Min Date:", minDate, "Max Date:", maxDate);
    calendarDays = eachDayOfInterval({
      start: startOfWeek(minDate, { weekStartsOn: 1 }), // Start from Monday of the first event's week
      end: addDays(maxDate, 7), // Extend a week beyond the last event to show some empty days
    });
    console.log("Calendar Days:", calendarDays);
  }

  const colorPalette = [
    { light: "bg-blue-500", dark: "dark:bg-blue-700" },
    { light: "bg-green-500", dark: "dark:bg-green-700" },
    { light: "bg-purple-500", dark: "dark:bg-purple-700" },
    { light: "bg-indigo-500", dark: "dark:bg-indigo-700" },
    { light: "bg-yellow-500", dark: "dark:bg-yellow-700" },
    { light: "bg-red-500", dark: "dark:bg-red-700" },
    { light: "bg-pink-500", dark: "dark:bg-pink-700" },
  ];

  const eventColors = React.useMemo(() => {
    const colors = new Map<string, { light: string; dark: string }>();
    for (const event of events) {
      if (!colors.has(event.id)) {
        const hash = stringToHash(event.id);
        const assignedColor = colorPalette[hash % colorPalette.length];
        colors.set(event.id, assignedColor);
        console.log(`Event ID: ${event.id}, Hash: ${hash}, Assigned Color: ${assignedColor.light}`);
      }
    }
    return colors;
  }, [events]);

  const groupedEvents = calendarDays.reduce((acc, day) => {
    const dayKey = format(day, 'yyyy-MM-dd');
    acc[dayKey] = events.filter(event => {
      let effectiveStartDate: Date | null = null;
      let effectiveEndDate: Date | null = null;

      if (event.start_datetime) {
        const parsed = new Date(event.start_datetime);
        if (!isNaN(parsed.getTime())) {
          effectiveStartDate = parsed;
          effectiveEndDate = parsed;
        }
      } else if (event.list_date) {
        const { startDate, endDate } = parseListDateRange(event.list_date);
        effectiveStartDate = startDate;
        effectiveEndDate = endDate;
      }

      if (effectiveStartDate && effectiveEndDate) {
        // Check if the current calendar day is within the event's date range
        return day >= effectiveStartDate && day <= effectiveEndDate;
      }
      return false;
    });
    return acc;
  }, {} as Record<string, EventData[]>);
  console.log("Grouped Events:", groupedEvents);

  return (
    <div className="p-4 flex flex-col h-full">
      <div className="grid grid-cols-7 gap-4 sticky top-0 bg-gray-100 dark:bg-black z-10 p-3 rounded-lg shadow-md">
        {Array.from({ length: 7 }).map((_, i) => {
          const day = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), i);
          return (
            <h2 key={i} className="text-lg font-semibold text-gray-800 dark:text-gray-200 text-center">
              {format(day, 'EEE')}
            </h2>
          );
        })}
      </div>
      <div className="flex-grow overflow-y-auto custom-scrollbar">
        <div className="grid grid-cols-7 gap-4">
          {/* Group calendarDays into weeks and render only non-empty weeks */}
          {Array.from({ length: Math.ceil(calendarDays.length / 7) }).map((_, weekIndex) => {
            const weekStart = weekIndex * 7;
            const weekDays = calendarDays.slice(weekStart, weekStart + 7);
            
            // Check if this week has any events
            const hasEventsInWeek = weekDays.some(day => groupedEvents[format(day, 'yyyy-MM-dd')]?.length > 0);

            if (!hasEventsInWeek) {
              return null; // Skip rendering this empty week
            }

            return weekDays.map((day) => (
              <div key={format(day, 'yyyy-MM-dd')} className="flex flex-col bg-white dark:bg-neutral-900 rounded-lg shadow-md p-2">
                <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2 border-b pb-1 border-gray-200 dark:border-neutral-700">
                  {format(day, 'MMM d')}
                </h3>
                <div className="flex-grow overflow-y-auto custom-scrollbar">
                  {groupedEvents[format(day, 'yyyy-MM-dd')]?.length > 0 ? (
                    groupedEvents[format(day, 'yyyy-MM-dd')]
                      .sort((a, b) => {
                        const timeA = a.start_datetime ? new Date(a.start_datetime).getTime() : Infinity;
                        const timeB = b.start_datetime ? new Date(b.start_datetime).getTime() : Infinity;
                        return timeA - timeB;
                      })
                      .map((event) => {
                        let eventEffectiveStartDate: Date | null = null;
                        let eventEffectiveEndDate: Date | null = null;

                        if (event.start_datetime) {
                          const parsed = new Date(event.start_datetime);
                          if (!isNaN(parsed.getTime())) {
                            eventEffectiveStartDate = parsed;
                            eventEffectiveEndDate = parsed;
                          }
                        } else if (event.list_date) {
                          const { startDate, endDate } = parseListDateRange(event.list_date);
                          eventEffectiveStartDate = startDate;
                          eventEffectiveEndDate = endDate;
                        }

                        const isContinuation = eventEffectiveStartDate ? !isSameDay(eventEffectiveStartDate, day) : false;
                        
                        let currentDayIndex: number | undefined;
                        let totalDays: number | undefined;

                        if (eventEffectiveStartDate && eventEffectiveEndDate) {
                          totalDays = differenceInDays(eventEffectiveEndDate, eventEffectiveStartDate) + 1;
                          currentDayIndex = differenceInDays(day, eventEffectiveStartDate) + 1;
                        }

                        return (
                          <EventListItem
                            key={event.id}
                            event={event}
                            onSelectEvent={onSelectEvent}
                            isLoadingDetails={loadingDetailsFor === event.id}
                            isInOverlay={eventInOverlayId === event.id}
                            isContinuation={isContinuation}
                            currentDayIndex={currentDayIndex}
                            totalDays={totalDays}
                            eventColor={eventColors.get(event.id)}
                            hideDateInCalendar={true}
                            isCalendarView={true}
                          />
                        );
                      })
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">No events</p>
                  )}
                </div>
              </div>
            ));
          })}
        </div>
      </div>
    </div>
  );
};

export default EventCalendar;
