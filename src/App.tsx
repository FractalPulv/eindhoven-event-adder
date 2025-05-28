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
  const [overlayEvent, setOverlayEvent] = useState<EventData | null>(null);
  const [isFetchingAllDetails, setIsFetchingAllDetails] = useState(false);

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
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
      console.log("handleSelectEvent called for:", eventData.title);
      // Always set the event for the overlay.
      // If it's not detailed, we'll fetch details.
      setOverlayEvent(eventData); 

      // Adjust map view if the event has coordinates
      if (eventData.latitude && eventData.longitude) {
        setMapCenter([eventData.latitude, eventData.longitude]);
        // Zoom in more if we are already in map view and an event is clicked
        // or if we switch to map view because of an event selection (though this flow is less common now)
        if (currentView === "map") {
             setMapZoom(16); // Zoom in closer on specific event
        } else {
            // If switching to map view (not the current flow but defensive)
            // setMapZoom(16);
        }
      } else if (currentView === "map") { // If event has no coords and we are in map view, reset to default
        setMapCenter(EindhovenCentraalStation);
        setMapZoom(13);
      }


      // Fetch details if not already fetched or currently loading for this specific event
      if (!eventData.isDetailed && (!loadingDetailsFor || loadingDetailsFor !== eventData.id)) {
        setLoadingDetailsFor(eventData.id);
        try {
          console.log(
            `Fetching details (handleSelectEvent) for: ${eventData.title} (ID: ${eventData.id})`
          );
          const detailedEvent = await invoke<EventData>(
            "fetch_specific_event_details_rust",
            { eventSummary: eventData } // Pass the summary (eventData)
          );

          // Update the main events array (for grid item persistence & map updates)
          setEvents((prevEvents) =>
            prevEvents.map((e) =>
              e.id === detailedEvent.id
                ? { ...detailedEvent, isDetailed: true }
                : e
            )
          );
          // Update the event in the overlay with full details
          setOverlayEvent({ ...detailedEvent, isDetailed: true });
          console.log(
            `Successfully fetched details (handleSelectEvent) for: ${detailedEvent.title}`
          );
        } catch (e: any) {
          console.error(
            `Failed to fetch details for event ${eventData.id} in handleSelectEvent:`,
            e
          );
          // Overlay will show summary data if details fail.
        } finally {
          setLoadingDetailsFor(null);
        }
      } else if (eventData.isDetailed && overlayEvent?.id !== eventData.id) {
        // If it's already detailed but not the current overlay event, ensure overlay is updated
        setOverlayEvent(eventData);
      } else if (eventData.isDetailed && overlayEvent?.id === eventData.id && overlayEvent !== eventData){
        // If it's the same event but the object reference in `events` array got updated with more details elsewhere.
        setOverlayEvent(eventData);
      }
    },
    [currentView, loadingDetailsFor, overlayEvent] // Added overlayEvent to deps
  );

  const handleCloseOverlay = useCallback(() => {
    setOverlayEvent(null);
    // When closing overlay from map view, maybe reset zoom slightly? Optional.
    // if(currentView === 'map') {
    //   setMapZoom(13); // Reset to general view zoom
    //   setMapCenter(EindhovenCentraalStation); // Or last known general center
    // }
  }, [/* currentView */]); // currentView can be added if above logic is used

  const handleAddToCalendar = useCallback(
    async (event: EventData) => {
      if (!event) return;
      let eventForIcs = event;
      if (!event.isDetailed) {
        alert("Fetching event details for calendar. Please wait.");
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
    setIsFetchingAllDetails(true);
    setError(null);
    console.log("Starting to fetch all details...");

    const eventsToFetchDetailsFor = events.filter(event => !event.isDetailed);
    if (eventsToFetchDetailsFor.length === 0) {
        console.log("All events are already detailed.");
        setIsFetchingAllDetails(false);
        return;
    }

    // Create a temporary map to hold new detailed events to avoid many setEvents calls
    const updatedEventsData = new Map<string, EventData>();

    for (const eventSummary of eventsToFetchDetailsFor) {
        try {
            // setLoadingDetailsFor(eventSummary.id); // Visually indicate per-event fetching
            const detailedEvent = await invoke<EventData>("fetch_specific_event_details_rust", { eventSummary });
            updatedEventsData.set(detailedEvent.id, { ...detailedEvent, isDetailed: true });
            // Update events reactively in batches or one by one if preferred for UI feedback
            // For now, we collect all and update once. If you want per-item UI update:
            // setEvents(prev => prev.map(e => e.id === detailedEvent.id ? {...detailedEvent, isDetailed: true} : e));
        } catch (err) {
            console.error(`Failed to fetch details for ${eventSummary.id}:`, err);
            updatedEventsData.set(eventSummary.id, eventSummary); // Keep summary on error
        } finally {
            // setLoadingDetailsFor(null);
        }
    }
    
    setEvents(prevEvents => {
        const newEventsArray = prevEvents.map(event => 
            updatedEventsData.get(event.id) || event
        );
        // If the currently selected overlay event was part of the bulk update, refresh its data
        if (overlayEvent && updatedEventsData.has(overlayEvent.id)) {
          const refreshedOverlayEvent = updatedEventsData.get(overlayEvent.id);
          if (refreshedOverlayEvent) {
            setOverlayEvent(refreshedOverlayEvent);
          }
        }
        return newEventsArray;
    });

    console.log("Finished fetching all details.");
    setIsFetchingAllDetails(false);
  }, [events, overlayEvent]);


  const mapEvents = events.filter((e) => e.latitude && e.longitude);

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
            <div className="flex space-x-1 bg-gray-200 dark:bg-neutral-800 p-0.5 rounded-lg shadow-sm">
                <button
                    onClick={() => {
                        setCurrentView("list");
                        if (overlayEvent) handleCloseOverlay();
                    }}
                    className={`px-3 py-1 rounded-md font-medium transition-all duration-200 text-xs sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-800
                        ${
                            currentView === "list"
                            ? "bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-sm"
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-300/50 dark:hover:bg-neutral-700/50"
                        }`}
                >
                    List
                </button>
                <button
                    onClick={() => {
                        setCurrentView("map");
                        if (overlayEvent) handleCloseOverlay();
                    }}
                    className={`px-3 py-1 rounded-md font-medium transition-all duration-200 text-xs sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-800
                        ${
                            currentView === "map"
                            ? "bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-sm"
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-300/50 dark:hover:bg-neutral-700/50"
                        }`}
                >
                    Map
                </button>
            </div>
            {currentView === "map" && (
                 <button
                    onClick={handleFetchAllDetails}
                    disabled={isFetchingAllDetails || loading} // Disable if initial load is also happening
                    title="Fetch details for all events to show on map"
                    className={`p-1.5 rounded-md font-medium transition-all duration-200 text-xs sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-800
                                bg-gray-200 dark:bg-neutral-800 hover:bg-gray-300/70 dark:hover:bg-neutral-700/70 text-gray-700 dark:text-gray-300 shadow-sm
                                disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {isFetchingAllDetails ? (
                        <RefreshCwIcon className="w-4 h-4 animate-spin" />
                    ) : (
                        <RefreshCwIcon className="w-4 h-4" />
                    )}
                </button>
            )}
        </div>
        
        <div className="flex-1"></div>
      </header>

      <main className="flex-grow overflow-y-auto bg-gray-100 dark:bg-black relative">
        {loading && !isFetchingAllDetails && ( // Show initial loading only if not bulk fetching
          <p className="p-4 text-center dark:text-gray-300 text-base">
            Loading event summaries...
          </p>
        )}
        {error && (
          <p className="p-4 text-center text-red-500 dark:text-red-400 text-base">
            Error: {error}
          </p>
        )}

        {(!loading || events.length > 0) && !error && ( // Render if not initial loading OR if events exist (even during bulk fetch)
          <>
            {currentView === "list" && (
              <EventList
                events={events}
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
                  onMarkerClick={handleSelectEvent} // Pass handleSelectEvent here
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