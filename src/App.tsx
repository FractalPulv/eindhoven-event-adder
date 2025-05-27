// File: src/App.tsx
import React, { useState, useEffect, useCallback } from "react";
import { LatLngExpression } from 'leaflet';
import "./App.css";
import EventDetailOverlay from './components/EventDetailOverlay'; // Import the new overlay

// Tauri APIs
import { invoke } from "@tauri-apps/api/core";
import { save } from '@tauri-apps/plugin-dialog';
import { open } from '@tauri-apps/plugin-shell';
import { writeTextFile } from '@tauri-apps/plugin-fs';

// Components
import EventList from './components/EventList';
import EventMap from './components/EventMap';
import ThemeToggle from './components/ThemeToggle';

// Types
import { EventData } from './types';

const EindhovenCentraalStation: LatLngExpression = [51.4416, 5.4697];
type Theme = 'light' | 'dark';
type View = 'list' | 'map';

function App() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [mapCenter, setMapCenter] = useState<LatLngExpression>(EindhovenCentraalStation);
  const [mapZoom, setMapZoom] = useState<number>(13);
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });
  const [currentView, setCurrentView] = useState<View>('list');
  const [loadingDetailsFor, setLoadingDetailsFor] = useState<string | null>(null);
    const [overlayEvent, setOverlayEvent] = useState<EventData | null>(null); // New state for overlay

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    const loadEventSummaries = async () => {
      setLoading(true);
      setError(null);
      try {
        const fetchedSummaries = await invoke<EventData[]>("fetch_events_rust");
        setEvents(fetchedSummaries.map(event => ({ ...event, isDetailed: false })));
      } catch (e: any) {
        setError(`Failed to fetch event summaries: ${e.message || e.toString()}`);
        console.error("Fetch summaries error:", e);
      } finally {
        setLoading(false);
      }
    };
    loadEventSummaries();
  }, []);

   const handleSelectEvent = useCallback(async (eventData: EventData) => { // Renamed param for clarity
    // If this event is already the one in the overlay, do nothing or maybe close it (optional)
    // if (overlayEvent && overlayEvent.id === eventData.id) {
    //   // setOverlayEvent(null); // Option to toggle close
    //   return;
    // }
    
    // Set for overlay immediately, to show loading state if needed
    setOverlayEvent(eventData); 

    if (eventData.latitude && eventData.longitude) {
      setMapCenter([eventData.latitude, eventData.longitude]);
      if (currentView === 'map') setMapZoom(16);
    } else if (currentView === 'map') {
        setMapCenter(EindhovenCentraalStation);
        setMapZoom(13);
    }

    // Fetch details if not already fetched or currently loading
    if (!eventData.isDetailed && eventData.id !== loadingDetailsFor) {
      setLoadingDetailsFor(eventData.id);
      try {
        console.log(`Fetching details for overlay: ${eventData.title} (ID: ${eventData.id})`);
        const detailedEvent = await invoke<EventData>("fetch_specific_event_details_rust", { eventSummary: eventData });
        
        // Update the main events array (for grid item persistence)
        setEvents(prevEvents => 
          prevEvents.map(e => e.id === detailedEvent.id ? { ...detailedEvent, isDetailed: true } : e)
        );
        // Update the event in the overlay with full details
        setOverlayEvent({ ...detailedEvent, isDetailed: true });
        console.log(`Successfully fetched details for overlay: ${detailedEvent.title}`);

      } catch (e: any) {
        console.error(`Failed to fetch details for event ${eventData.id} for overlay:`, e);
        // If fetch fails, overlay might show summary or an error. Current event in overlay is still the summary.
        // Optionally, close overlay or show error message within it.
        // For now, we keep the summary in overlayEvent and clear loading.
      } finally {
        setLoadingDetailsFor(null);
      }
    } else if (eventData.isDetailed) {
      // If already detailed, ensure overlayEvent has the detailed version
      setOverlayEvent(eventData); 
    }
  }, [currentView, loadingDetailsFor, /* overlayEvent */]); // Removed overlayEvent from deps to prevent re-triggering on close

  const handleCloseOverlay = useCallback(() => {
    setOverlayEvent(null);
  }, []);

  const handleAddToCalendar = useCallback(async (event: EventData) => {
    // This logic can remain largely the same, but it now operates on the event from the overlay
    if (!event) return;
    let eventForIcs = event;
    if (!event.isDetailed) { // Should ideally always be detailed if coming from overlay, but good check
      alert("Fetching event details for calendar. Please wait.");
      setLoadingDetailsFor(event.id); // This state is now less directly tied to UI, but ok for logic
      try {
        eventForIcs = await invoke<EventData>("fetch_specific_event_details_rust", { eventSummary: event });
        setEvents(prevEvents => 
          prevEvents.map(e => e.id === eventForIcs.id ? { ...eventForIcs, isDetailed: true } : e)
        );
        // If the overlay is somehow showing a summary version, update it
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
      const icsContent = await invoke<string>("generate_ics_rust", { eventData: eventForIcs });
      const suggestedFilename = `${eventForIcs.title.replace(/[^a-z0-9]/gi, '_').substring(0, 50) || 'event'}.ics`;
      const filePath = await save({
        defaultPath: suggestedFilename,
        filters: [{ name: 'iCalendar File', extensions: ['ics'] }]
      });
      if (filePath) {
        await writeTextFile(filePath, icsContent);
        alert(`Event "${eventForIcs.title}" saved to ${filePath}`);
      }
    } catch (e: any) {
      alert(`Error creating calendar file: ${e.message || e.toString()}`);
      console.error("ICS Error:", e);
    }
  }, [selectedEvent]);
  
  const openEventUrlInBrowser = useCallback(async (url?: string) => {
    if (url) {
      try { await open(url); } 
      catch (e) { console.error("Open URL Error:", e); alert("Could not open the event link."); }
    }
  }, []);

  const mapEvents = events.filter(e => e.latitude && e.longitude);

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-gray-100 antialiased">
      <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
      
     <header className="p-3 bg-white dark:bg-slate-800/90 backdrop-blur-sm flex justify-between items-center shadow-lg sticky top-0 z-30 border-b border-gray-200 dark:border-slate-700/70">
        <h1 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-200">Eindhoven Event Viewer</h1>
        <div className="flex space-x-1.5 sm:space-x-2">
          <button 
            onClick={() => { setCurrentView('list'); if (overlayEvent) handleCloseOverlay(); }} // Close overlay on view switch
            className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg font-medium transition-all duration-200 text-xs sm:text-sm shadow-sm hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800
                        ${currentView === 'list' 
                          ? 'bg-blue-600 text-white focus-visible:ring-blue-400' 
                          : 'bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-gray-200 focus-visible:ring-gray-400'}`}
          >List View</button>
          <button 
            onClick={() => { setCurrentView('map'); if (overlayEvent) handleCloseOverlay(); }} // Close overlay on view switch
            className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg font-medium transition-all duration-200 text-xs sm:text-sm shadow-sm hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800
                        ${currentView === 'map' 
                          ? 'bg-blue-600 text-white focus-visible:ring-blue-400' 
                          : 'bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-gray-200 focus-visible:ring-gray-400'}`}
          >Map View</button>
        </div>
      </header>

      <main className="flex-grow overflow-y-auto bg-gray-100 dark:bg-slate-900 relative"> 
        {loading && <p className="p-4 text-center dark:text-gray-300 text-base">Loading event summaries...</p>}
        {error && <p className="p-4 text-center text-red-500 dark:text-red-400 text-base">Error: {error}</p>}
        
        {!loading && !error && (
          <>
           {currentView === 'list' && (
              <EventList 
                events={events} 
                onSelectEvent={handleSelectEvent}
                loadingDetailsFor={loadingDetailsFor}
                eventInOverlayId={overlayEvent?.id} // Pass the ID of the event in the overlay
              />
            )}
            {currentView === 'map' && (
              <div className="h-full w-full"> 
                <EventMap 
                  events={mapEvents}
                  mapCenter={mapCenter} 
                  mapZoom={mapZoom} 
                  onMarkerClick={handleSelectEvent} // This will now open the overlay
                  handleAddToCalendar={handleAddToCalendar} 
                  openEventUrl={openEventUrlInBrowser}   
                  theme={theme}
                />
              </div>
            )}
          </>
        )}
      </main>
      
      {/* Event Detail Overlay */}
      <EventDetailOverlay 
        event={overlayEvent}
        onClose={handleCloseOverlay}
        handleAddToCalendar={handleAddToCalendar}
        openEventUrl={openEventUrlInBrowser}
        theme={theme}
      />

      {/* Global loading indicator can be removed or simplified as overlay has its own indicators */}
      {/* {loadingDetailsFor && !overlayEvent?.isDetailed && (
        <div className="fixed bottom-4 right-4 bg-blue-500/90 dark:bg-blue-600/90 backdrop-blur-sm text-white p-2.5 rounded-lg shadow-xl z-50 text-xs font-medium">
          Loading details...
        </div>
      )} */}
    </div>
  );
}
export default App;