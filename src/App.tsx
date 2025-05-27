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
// import EventDetail from './components/EventDetail'; // Temporarily unused as per simplified view
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
  const [currentView, setCurrentView] = useState<View>('list'); // Default to List View

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
    const loadEvents = async () => {
      setLoading(true);
      setError(null);
      try {
        const fetchedEvents = await invoke<EventData[]>("fetch_events_rust");
        setEvents(fetchedEvents);
      } catch (e: any) {
        setError(`Failed to fetch events: ${e.message || e.toString()}`);
        console.error("Fetch error:", e);
      } finally {
        setLoading(false);
      }
    };
    loadEvents();
  }, []);

  const handleSelectEvent = useCallback((event: EventData | null) => {
    setSelectedEvent(event);
    if (event && event.latitude && event.longitude) {
      setMapCenter([event.latitude, event.longitude]);
      if (currentView === 'map') setMapZoom(15); 
    }
  }, [currentView]);

  const handleAddToCalendar = useCallback(async (event: EventData) => {
    if (!event) return;
    try {
      const icsContent = await invoke<string>("generate_ics_rust", { eventData: event });
      const suggestedFilename = `${event.title.replace(/[^a-z0-9]/gi, '_') || 'event'}.ics`;
      const filePath = await save({
        defaultPath: suggestedFilename,
        filters: [{ name: 'iCalendar File', extensions: ['ics'] }]
      });
      if (filePath) {
        await writeTextFile(filePath, icsContent);
        alert(`Event "${event.title}" saved to ${filePath}`);
      }
    } catch (e: any) {
      alert(`Error: ${e.message || e.toString() || 'Could not generate or save calendar file.'}`);
      console.error("ICS Error:", e);
    }
  }, []);
  
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

  const mapEvents = events.filter(e => e.latitude && e.longitude);

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-slate-800">
      <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
      
      <header className="p-3 bg-gray-200 dark:bg-slate-700 flex justify-between items-center shadow-md sticky top-0 z-20">
        <h1 className="text-xl font-bold text-gray-700 dark:text-gray-200">Eindhoven Event Viewer</h1>
        <div className="flex space-x-2">
          <button 
            onClick={() => setCurrentView('list')} 
            className={`px-4 py-2 rounded font-medium transition-colors text-sm
                        ${currentView === 'list' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-300 hover:bg-gray-400 dark:bg-slate-600 dark:hover:bg-slate-500 dark:text-gray-100'}`}
          >
            List View
          </button>
          <button 
            onClick={() => setCurrentView('map')} 
            className={`px-4 py-2 rounded font-medium transition-colors text-sm
                        ${currentView === 'map' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-300 hover:bg-gray-400 dark:bg-slate-600 dark:hover:bg-slate-500 dark:text-gray-100'}`}
          >
            Map View
          </button>
        </div>
      </header>

      <main className="flex-grow overflow-y-auto"> {/* Main content area */}
        {loading && <p className="p-4 text-center dark:text-white text-lg">Loading events...</p>}
        {error && <p className="p-4 text-center text-red-500 dark:text-red-400 text-lg">Error: {error}</p>}
        
        {!loading && !error && (
          <>
            {currentView === 'list' && (
              <EventList 
                events={events} 
                selectedEvent={selectedEvent} 
                onSelectEvent={handleSelectEvent}
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
      {/* The EventDetail component is not rendered here in this simplified layout */}
      {/* If you want a modal or a dedicated detail panel later, it can be added here,
          conditionally rendered based on `selectedEvent`. For example:
      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-30">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <button onClick={() => handleSelectEvent(null)} className="float-right text-red-500 font-bold">Close</button>
            <EventDetail event={selectedEvent} handleAddToCalendar={handleAddToCalendar} openEventUrl={openEventUrlInBrowser} />
          </div>
        </div>
      )} 
      */}
    </div>
  );
}

export default App;