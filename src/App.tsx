// File: src/App.tsx
import React, { useState, useEffect, useCallback } from "react";
import { LatLngExpression } from 'leaflet';
import "./App.css";

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
  const [loading, setLoading] = useState(true); // For initial summary load
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
  const [loadingDetailsFor, setLoadingDetailsFor] = useState<string | null>(null); // Store ID of event being detailed

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

  // Fetch initial event summaries
  useEffect(() => {
    const loadEventSummaries = async () => {
      setLoading(true);
      setError(null);
      try {
        const fetchedSummaries = await invoke<EventData[]>("fetch_events_rust");
        // Mark them as not detailed initially
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

  const handleSelectEvent = useCallback(async (event: EventData | null) => {
    if (!event) {
      setSelectedEvent(null);
      return;
    }

    setSelectedEvent(event); // Select immediately for UI responsiveness

    if (event.latitude && event.longitude) {
      setMapCenter([event.latitude, event.longitude]);
      if (currentView === 'map') setMapZoom(15);
    }

    // Check if details need to be fetched
    if (!event.isDetailed && event.id !== loadingDetailsFor) {
      setLoadingDetailsFor(event.id);
      try {
        console.log(`Fetching details for: ${event.title} (ID: ${event.id})`);
        // Pass the summary event object to the backend
        const detailedEvent = await invoke<EventData>("fetch_specific_event_details_rust", { eventSummary: event });
        
        setEvents(prevEvents => 
          prevEvents.map(e => e.id === detailedEvent.id ? { ...detailedEvent, isDetailed: true } : e)
        );
        setSelectedEvent({ ...detailedEvent, isDetailed: true }); // Update selected event with full details
        console.log(`Successfully fetched details for: ${detailedEvent.title}`);

      } catch (e: any) {
        console.error(`Failed to fetch details for event ${event.id}:`, e);
        // Optionally, set an error message for this specific event or a general detail fetch error
        // For now, the event in the list remains a summary
        setSelectedEvent(prevSelected => prevSelected && prevSelected.id === event.id ? { ...prevSelected, isDetailed: false } : prevSelected); // Revert isDetailed if fetch failed
      } finally {
        setLoadingDetailsFor(null);
      }
    } else if (event.isDetailed) {
      console.log(`Details already fetched for: ${event.title}`);
      setSelectedEvent(event); // Ensure selectedEvent is the detailed one if already fetched
    }
  }, [currentView, loadingDetailsFor]);

  const handleAddToCalendar = useCallback(async (event: EventData) => {
    if (!event) return;
    // Ensure we have detailed data for ICS, especially start_datetime
    let eventForIcs = event;
    if (!event.isDetailed) {
      alert("Fetching event details for calendar. Please wait a moment and try again if it fails.");
      setLoadingDetailsFor(event.id); // Indicate loading
      try {
        eventForIcs = await invoke<EventData>("fetch_specific_event_details_rust", { eventSummary: event });
        setEvents(prevEvents => 
          prevEvents.map(e => e.id === eventForIcs.id ? { ...eventForIcs, isDetailed: true } : e)
        );
        if (selectedEvent?.id === eventForIcs.id) {
          setSelectedEvent({ ...eventForIcs, isDetailed: true });
        }
      } catch (e) {
        setLoadingDetailsFor(null);
        alert("Could not fetch event details for calendar generation. Please try selecting the event first.");
        return;
      } finally {
        setLoadingDetailsFor(null);
      }
    }
    
    if (!eventForIcs.start_datetime) {
        alert("Precise start time not available for this event, cannot add to calendar yet.");
        return;
    }

    try {
      const icsContent = await invoke<string>("generate_ics_rust", { eventData: eventForIcs });
      const suggestedFilename = `${eventForIcs.title.replace(/[^a-z0-9]/gi, '_') || 'event'}.ics`;
      const filePath = await save({
        defaultPath: suggestedFilename,
        filters: [{ name: 'iCalendar File', extensions: ['ics'] }]
      });
      if (filePath) {
        await writeTextFile(filePath, icsContent);
        alert(`Event "${eventForIcs.title}" saved to ${filePath}`);
      }
    } catch (e: any) {
      alert(`Error creating calendar file: ${e.message || e.toString() || 'Could not generate or save calendar file.'}`);
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
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-slate-800">
      <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
      
      <header className="p-3 bg-gray-200 dark:bg-slate-700 flex justify-between items-center shadow-md sticky top-0 z-20">
        <h1 className="text-xl font-bold text-gray-700 dark:text-gray-200">Eindhoven Event Viewer</h1>
        <div className="flex space-x-2">
          <button 
            onClick={() => setCurrentView('list')} 
            className={`px-4 py-2 rounded font-medium transition-colors text-sm ${currentView === 'list' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-300 hover:bg-gray-400 dark:bg-slate-600 dark:hover:bg-slate-500 dark:text-gray-100'}`}
          >List View</button>
          <button 
            onClick={() => setCurrentView('map')} 
            className={`px-4 py-2 rounded font-medium transition-colors text-sm ${currentView === 'map' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-300 hover:bg-gray-400 dark:bg-slate-600 dark:hover:bg-slate-500 dark:text-gray-100'}`}
          >Map View</button>
        </div>
      </header>

      <main className="flex-grow overflow-y-auto">
        {loading && <p className="p-4 text-center dark:text-white text-lg">Loading event summaries...</p>}
        {error && <p className="p-4 text-center text-red-500 dark:text-red-400 text-lg">Error: {error}</p>}
        
        {!loading && !error && (
          <>
            {currentView === 'list' && (
              <EventList 
                events={events} 
                selectedEvent={selectedEvent} 
                onSelectEvent={handleSelectEvent}
                loadingDetailsFor={loadingDetailsFor} // Pass loading state
              />
            )}
            {currentView === 'map' && (
              <div className="h-full w-full"> 
                <EventMap 
                  events={mapEvents}
                  mapCenter={mapCenter} 
                  mapZoom={mapZoom} 
                  onMarkerClick={handleSelectEvent} // This will now trigger detail fetching
                  handleAddToCalendar={handleAddToCalendar} 
                  openEventUrl={openEventUrlInBrowser}   
                  theme={theme}
                />
              </div>
            )}
          </>
        )}
      </main>
      {/* Optional: A global loading indicator for detail fetching if not handled per item
      {loadingDetailsFor && (
        <div className="fixed bottom-4 right-4 bg-blue-500 text-white p-3 rounded-lg shadow-lg z-50">
          Loading details for {events.find(e => e.id === loadingDetailsFor)?.title || 'event'}...
        </div>
      )}
      */}
    </div>
  );
}
export default App;