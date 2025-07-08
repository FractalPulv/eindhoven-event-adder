// File: src/App.tsx
import React, { useState, useEffect, useCallback } from "react";
import { LatLngExpression } from "leaflet";
import "./App.css";
import EventDetailOverlay from "./components/EventDetailOverlay";

// Tauri APIs
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { open } from "@tauri-apps/plugin-shell";
import { writeTextFile } from "@tauri-apps/plugin-fs";

// Components
import EventList from "./components/EventList";
import EventMap from "./components/EventMap";
import ThemeToggle from "./components/ThemeToggle";
import { RefreshCwIcon } from "./components/Icons";

// Types
import { EventData } from "./types";

const EindhovenCentraalStation: LatLngExpression = [51.4416, 5.4697];
type Theme = "light" | "dark";
type View = "list" | "map";

function App() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<LatLngExpression>(
    EindhovenCentraalStation
  );
  const [mapZoom, setMapZoom] = useState<number>(13);
  const [theme, setTheme] = useState<Theme>(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "dark";
    }
    return "light";
  });
  const [currentView, setCurrentView] = useState<View>("list");
  const [loadingDetailsFor, setLoadingDetailsFor] = useState<string | null>(
    null
  );
  const [overlayEvent, setOverlayEvent] = useState<EventData | null>(
    null
  );
  const [isFetchingAllDetails, setIsFetchingAllDetails] = useState(false);
  const [filterFreeEvents, setFilterFreeEvents] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>("date-asc"); // Default sort by date ascending

  useEffect(() => {
    // console.log("Theme effect running, theme is:", theme); // For debugging
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      // console.log("Applied dark class to HTML element"); // For debugging
    } else {
      document.documentElement.classList.remove("dark");
      // console.log("Removed dark class from HTML element"); // For debugging
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  };

  useEffect(() => {
    const loadEventSummaries = async () => {
      setLoading(true);
      setError(null);
      try {
        const fetchedSummaries = await invoke<EventData[]>("fetch_events_rust");
        setEvents(
          fetchedSummaries.map((event) => ({ ...event, isDetailed: false }))
        );
      } catch (e: any) {
        setError(
          `Failed to fetch event summaries: ${e.message || e.toString()}`
        );
        console.error("Fetch summaries error:", e);
      } finally {
        setLoading(false);
      }
    };
    loadEventSummaries();
  }, []);

  const handleSelectEvent = useCallback(
    async (eventData: EventData) => {
      setOverlayEvent(eventData); 

      if (eventData.latitude && eventData.longitude) {
        setMapCenter([eventData.latitude, eventData.longitude]);
        if (currentView === "map") {
             setMapZoom(16); 
        }
      } else if (currentView === "map") {
        setMapCenter(EindhovenCentraalStation);
        setMapZoom(13);
      }

      if (!eventData.isDetailed && (!loadingDetailsFor || loadingDetailsFor !== eventData.id)) {
        setLoadingDetailsFor(eventData.id);
        try {
          const detailedEvent = await invoke<EventData>(
            "fetch_specific_event_details_rust",
            { eventSummary: eventData }
          );
          setEvents((prevEvents) =>
            prevEvents.map((e) =>
              e.id === detailedEvent.id
                ? { ...detailedEvent, isDetailed: true }
                : e
            )
          );
          setOverlayEvent({ ...detailedEvent, isDetailed: true });
        } catch (e: any) {
          console.error(`Failed to fetch details for event ${eventData.id}:`,e);
        } finally {
          setLoadingDetailsFor(null);
        }
      } else if (eventData.isDetailed && overlayEvent?.id !== eventData.id) {
        setOverlayEvent(eventData);
      } else if (eventData.isDetailed && overlayEvent?.id === eventData.id && overlayEvent !== eventData){
        setOverlayEvent(eventData);
      }
    },
    [currentView, loadingDetailsFor, overlayEvent]
  );

  const handleCloseOverlay = useCallback(() => {
    setOverlayEvent(null);
  }, []);

  const handleAddToCalendar = useCallback(
    async (event: EventData) => {
      // ... (implementation remains the same, already uses dark-aware alerts if needed)
      if (!event) return;
      let eventForIcs = event;
      if (!event.isDetailed) {
        alert("Fetching event details for calendar. Please wait."); // Standard alert
        setLoadingDetailsFor(event.id);
        try {
          eventForIcs = await invoke<EventData>(
            "fetch_specific_event_details_rust",
            { eventSummary: event }
          );
          setEvents((prevEvents) =>
            prevEvents.map((e) =>
              e.id === eventForIcs.id ? { ...eventForIcs, isDetailed: true } : e
            )
          );
          if (overlayEvent?.id === eventForIcs.id) {
            setOverlayEvent({ ...eventForIcs, isDetailed: true });
          }
        } catch (e) {
          setLoadingDetailsFor(null);
          alert("Could not fetch event details for calendar generation.");
          return;
        } finally {
          setLoadingDetailsFor(null);
        }
      }

      if (!eventForIcs.start_datetime) {
        alert("Precise start time not available for this event.");
        return;
      }

      try {
        const icsContent = await invoke<string>("generate_ics_rust", {
          eventData: eventForIcs,
        });
        const suggestedFilename = `${
          eventForIcs.title.replace(/[^a-z0-9]/gi, "_").substring(0, 50) ||
          "event"
        }.ics`;
        const filePath = await save({
          defaultPath: suggestedFilename,
          filters: [{ name: "iCalendar File", extensions: ["ics"] }],
        });
        if (filePath) {
          await writeTextFile(filePath, icsContent);
          alert(`Event "${eventForIcs.title}" saved to ${filePath}`);
        }
      } catch (e: any) {
        alert(`Error creating calendar file: ${e.message || e.toString()}`);
        console.error("ICS Error:", e);
      }
    },
    [overlayEvent]
  );

  const openEventUrlInBrowser = useCallback(async (url?: string) => {
    // ... (implementation remains the same)
    if (url) {
      try {
        await open(url);
      } catch (e) {
        console.error("Open URL Error:", e);
        alert("Could not open the event link.");
      }
    }
  }, []);

  const handleFetchAllDetails = useCallback(async () => {
    // ... (implementation remains the same)
    setIsFetchingAllDetails(true);
    setError(null);
    const eventsToFetchDetailsFor = events.filter(event => !event.isDetailed);
    if (eventsToFetchDetailsFor.length === 0) {
        setIsFetchingAllDetails(false);
        return;
    }
    const updatedEventsData = new Map<string, EventData>();
    for (const eventSummary of eventsToFetchDetailsFor) {
        try {
            const detailedEvent = await invoke<EventData>("fetch_specific_event_details_rust", { eventSummary });
            updatedEventsData.set(detailedEvent.id, { ...detailedEvent, isDetailed: true });
        } catch (err) {
            console.error(`Failed to fetch details for ${eventSummary.id}:`, err);
            updatedEventsData.set(eventSummary.id, eventSummary);
        }
    }
    setEvents(prevEvents => {
        const newEventsArray = prevEvents.map(event => 
            updatedEventsData.get(event.id) || event
        );
        if (overlayEvent && updatedEventsData.has(overlayEvent.id)) {
          const refreshedOverlayEvent = updatedEventsData.get(overlayEvent.id);
          if (refreshedOverlayEvent) setOverlayEvent(refreshedOverlayEvent);
        }
        return newEventsArray;
    });
    setIsFetchingAllDetails(false);
  }, [events, overlayEvent]);

  const mapEvents = events.filter((e) => e.latitude && e.longitude);

  const filteredAndSortedEvents = React.useMemo(() => {
    let currentEvents = [...events];

    // 1. Filtering
    if (filterFreeEvents) {
      currentEvents = currentEvents.filter(event => {
        const priceString = event.price || event.list_price;
        return priceString && (priceString.toLowerCase().includes("free") || priceString.trim() === "€ 0,00");
      });
    }

    // 2. Sorting
    currentEvents.sort((a, b) => {
      switch (sortBy) {
        case "date-asc":
          {
            const dateA = a.start_datetime || a.list_date;
            const dateB = b.start_datetime || b.list_date;
            if (!dateA && !dateB) return 0;
            if (!dateA) return 1;
            if (!dateB) return -1;
            return new Date(dateA).getTime() - new Date(dateB).getTime();
          }
        case "date-desc":
          {
            const dateA = a.start_datetime || a.list_date;
            const dateB = b.start_datetime || b.list_date;
            if (!dateA && !dateB) return 0;
            if (!dateA) return 1;
            if (!dateB) return -1;
            return new Date(dateB).getTime() - new Date(dateA).getTime();
          }
        case "price-asc":
          {
            const priceA = parseFloat((a.price || a.list_price || "0").replace("€", "").replace(",", ".").trim());
            const priceB = parseFloat((b.price || b.list_price || "0").replace("€", "").replace(",", ".").trim());
            return priceA - priceB;
          }
        case "price-desc":
          {
            const priceA = parseFloat((a.price || a.list_price || "0").replace("€", "").replace(",", ".").trim());
            const priceB = parseFloat((b.price || b.list_price || "0").replace("€", "").replace(",", ".").trim());
            return priceB - priceA;
          }
        default:
          return 0;
      }
    });

    return currentEvents;
  }, [events, filterFreeEvents, sortBy]);

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-black text-gray-900 dark:text-gray-100 antialiased">
      <ThemeToggle theme={theme} toggleTheme={toggleTheme} />

      <header className="p-3 bg-white dark:bg-neutral-950/90 backdrop-blur-sm flex items-center justify-between shadow-lg sticky top-0 z-30 border-b border-gray-200 dark:border-neutral-800/70">
        <div className="flex-1">
            <h1 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-200">
                Eindhoven Event Viewer
            </h1>
        </div>
        
        <div className="flex-none flex items-center space-x-2">
            {/* Filter and Sort Controls */}
            <div className="flex items-center space-x-2">
                <label htmlFor="free-events-filter" className="flex items-center cursor-pointer text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                    <input
                        type="checkbox"
                        id="free-events-filter"
                        checked={filterFreeEvents}
                        onChange={(e) => setFilterFreeEvents(e.target.checked)}
                        className="mr-1 rounded text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400"
                    />
                    Free Events
                </label>

                <select
                    id="sort-by"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-2 py-1 rounded-md bg-gray-200 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                >
                    <option value="date-asc">Date (Asc)</option>
                    <option value="date-desc">Date (Desc)</option>
                    <option value="price-asc">Price (Asc)</option>
                    <option value="price-desc">Price (Desc)</option>
                </select>
            </div>

            <div className="flex space-x-1 bg-gray-200 dark:bg-neutral-800 p-0.5 rounded-lg shadow-sm">
                {/* View Toggle Buttons with dark mode styling */}
                <button
                    onClick={() => { setCurrentView("list"); if (overlayEvent) handleCloseOverlay(); }}
                    className={`px-3 py-1 rounded-md font-medium transition-all duration-200 text-xs sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-800
                        ${ currentView === "list"
                            ? "bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-sm"
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-300/50 dark:hover:bg-neutral-700/50"
                        }`}
                > List </button>
                <button
                    onClick={() => { setCurrentView("map"); if (overlayEvent) handleCloseOverlay(); }}
                    className={`px-3 py-1 rounded-md font-medium transition-all duration-200 text-xs sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-800
                        ${ currentView === "map"
                            ? "bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-sm"
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-300/50 dark:hover:bg-neutral-700/50"
                        }`}
                > Map </button>
            </div>
            {currentView === "map" && (
                 <button
                    onClick={handleFetchAllDetails}
                    disabled={isFetchingAllDetails || loading}
                    title="Fetch details for all events"
                    className="p-1.5 rounded-md font-medium transition-all duration-200 text-xs sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-800 bg-gray-200 dark:bg-neutral-800 hover:bg-gray-300/70 dark:hover:bg-neutral-700/70 text-gray-700 dark:text-gray-300 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isFetchingAllDetails ? <RefreshCwIcon className="w-4 h-4 animate-spin" /> : <RefreshCwIcon className="w-4 h-4" />}
                </button>
            )}
        </div>
        <div className="flex-1"></div>
      </header>

      <main className="flex-grow overflow-y-auto bg-gray-100 dark:bg-black relative">
        {loading && !isFetchingAllDetails && (
          <p className="p-4 text-center text-gray-700 dark:text-gray-300 text-base">
            Loading event summaries...
          </p>
        )}
        {error && (
          <p className="p-4 text-center text-red-500 dark:text-red-400 text-base">
            Error: {error}
          </p>
        )}

        {(!loading || events.length > 0) && !error && (
          <>
            {currentView === "list" && (
              <EventList
                events={filteredAndSortedEvents}
                onSelectEvent={handleSelectEvent}
                loadingDetailsFor={loadingDetailsFor}
                eventInOverlayId={overlayEvent?.id}
              />
            )}
            {currentView === "map" && (
              <div className="h-full w-full">
                <EventMap
                  events={mapEvents}
                  mapCenter={mapCenter}
                  mapZoom={mapZoom}
                  onMarkerClick={handleSelectEvent}
                  theme={theme}
                />
              </div>
            )}
          </>
        )}
      </main>

      <EventDetailOverlay
        event={overlayEvent}
        onClose={handleCloseOverlay}
        handleAddToCalendar={handleAddToCalendar}
        openEventUrl={openEventUrlInBrowser}
        theme={theme}
      />
    </div>
  );
}
export default App;