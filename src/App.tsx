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

  const handleSelectEvent = useCallback(async (event: EventData | null) => {
    if (!event) {
      setSelectedEvent(null);
      return;
    }

    setSelectedEvent(event); 

    if (event.latitude && event.longitude) {
      setMapCenter([event.latitude, event.longitude]);
      if (currentView === 'map') setMapZoom(16); // Zoom in more on map view selection
    } else if (currentView === 'map') {
        // If event has no coords but map view is active, reset to default or previous valid center
        // For simplicity, just reset to Eindhoven general for now
        setMapCenter(EindhovenCentraalStation);
        setMapZoom(13);
    }


    if (!event.isDetailed && event.id !== loadingDetailsFor) {
      setLoadingDetailsFor(event.id);
      try {
        const detailedEvent = await invoke<EventData>("fetch_specific_event_details_rust", { eventSummary: event });
        setEvents(prevEvents => 
          prevEvents.map(e => e.id === detailedEvent.id ? { ...detailedEvent, isDetailed: true } : e)
        );
        setSelectedEvent({ ...detailedEvent, isDetailed: true });
      } catch (e: any) {
        console.error(`Failed to fetch details for event ${event.id}:`, e);
        setSelectedEvent(prevSelected => prevSelected && prevSelected.id === event.id ? { ...prevSelected, isDetailed: false } : prevSelected);
      } finally {
        setLoadingDetailsFor(null);
      }
    } else if (event.isDetailed) {
      setSelectedEvent(event);
    }
  }, [currentView, loadingDetailsFor]);

  const handleAddToCalendar = useCallback(async (event: EventData) => {
    if (!event) return;
    let eventForIcs = event;
    if (!event.isDetailed) {
      alert("Fetching event details for calendar. Please wait.");
      setLoadingDetailsFor(event.id);
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
        alert("Could not fetch event details for calendar. Please try selecting the event first.");
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
            onClick={() => setCurrentView('list')} 
            className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg font-medium transition-all duration-200 text-xs sm:text-sm shadow-sm hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800
                        ${currentView === 'list' 
                          ? 'bg-blue-600 text-white focus-visible:ring-blue-400' 
                          : 'bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-gray-200 focus-visible:ring-gray-400'}`}
          >List View</button>
          <button 
            onClick={() => setCurrentView('map')} 
            className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg font-medium transition-all duration-200 text-xs sm:text-sm shadow-sm hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800
                        ${currentView === 'map' 
                          ? 'bg-blue-600 text-white focus-visible:ring-blue-400' 
                          : 'bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-gray-200 focus-visible:ring-gray-400'}`}
          >Map View</button>
        </div>
      </header>

      <main className="flex-grow overflow-y-auto bg-gray-100 dark:bg-slate-900"> 
        {loading && <p className="p-4 text-center dark:text-gray-300 text-base">Loading event summaries...</p>}
        {error && <p className="p-4 text-center text-red-500 dark:text-red-400 text-base">Error: {error}</p>}
        
        {!loading && !error && (
          <>
            {currentView === 'list' && (
              <EventList 
                events={events} 
                selectedEvent={selectedEvent} 
                onSelectEvent={handleSelectEvent}
                loadingDetailsFor={loadingDetailsFor}
              />
            )}
            {currentView === 'map' && (
              <div className="h-full w-full"> 
                <EventMap 
                  events={mapEvents}
                  mapCenter={mapCenter} 
                  mapZoom={mapZoom} 
                  onMarkerClick={handleSelectEvent}
                  handleAddToCalendar={handleAddToCalendar} 
                  openEventUrl={openEventUrlInBrowser}   
                  theme={theme}
                />
              </div>
            )}
          </>
        )}
      </main>
      {loadingDetailsFor && !selectedEvent?.isDetailed && ( // More specific condition for global loader
        <div className="fixed bottom-4 right-4 bg-blue-500/90 dark:bg-blue-600/90 backdrop-blur-sm text-white p-2.5 rounded-lg shadow-xl z-50 text-xs font-medium">
          Loading details for "{events.find(e => e.id === loadingDetailsFor)?.title || 'event'}"...
        </div>
      )}
    </div>
  );
}
export default App;