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
import EventDetail from './components/EventDetail';
import ThemeToggle from './components/ThemeToggle';

// Types
import { EventData } from './types';

const EindhovenCentraalStation: LatLngExpression = [51.4416, 5.4697];
type Theme = 'light' | 'dark';

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
        setEvents(fetchedEvents); // Show all events in list initially
      } catch (e: any) {
        setError(`Failed to fetch events: ${e.message || e.toString()}`);
      } finally {
        setLoading(false);
      }
    };
    loadEvents();
  }, []);

  const handleSelectEvent = useCallback((event: EventData) => {
    setSelectedEvent(event);
    if (event.latitude && event.longitude) {
      setMapCenter([event.latitude, event.longitude]);
      setMapZoom(15);
    }
    // Optional: Scroll detail view into focus if on smaller screens
    const detailElement = document.getElementById('event-detail-section'); // Add this ID to the container of EventDetail
    detailElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);


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
    }
  }, []);
  
  const openEventUrlInBrowser = useCallback(async (url?: string) => {
    if (url) {
      try {
        await open(url);
      } catch (e) {
        alert("Could not open the event link.");
      }
    }
  }, []);

  if (loading) return <p className="p-4 text-center dark:text-white">Loading events from Rust backend...</p>;
  if (error) return <p className="p-4 text-center text-red-500 dark:text-red-400">{error}</p>;

  // Filter events for map display separately, list shows all
  const mapEvents = events.filter(e => e.latitude && e.longitude);

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-100 dark:bg-slate-800">
      <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
      <EventList events={events} selectedEvent={selectedEvent} onSelectEvent={handleSelectEvent} />
      
      <div className="md:w-2/3 lg:w-3/4 flex flex-col h-1/2 md:h-full">
        <EventMap 
            events={mapEvents} 
            mapCenter={mapCenter} 
            mapZoom={mapZoom} 
            onMarkerClick={handleSelectEvent}
            handleAddToCalendar={handleAddToCalendar}
            openEventUrl={openEventUrlInBrowser}
            theme={theme}
        />
        <div id="event-detail-section"> {/* ID for scrolling into view */}
            <EventDetail 
                event={selectedEvent} 
                handleAddToCalendar={handleAddToCalendar}
                openEventUrl={openEventUrlInBrowser}
            />
        </div>
      </div>
    </div>
  );
}

export default App;