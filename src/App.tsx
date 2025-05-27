// src/App.tsx
import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import "./App.css";

// Tauri APIs
import { invoke } from "@tauri-apps/api/core";
import { save } from '@tauri-apps/plugin-dialog';
import { open } from '@tauri-apps/plugin-shell';
import { writeTextFile } from '@tauri-apps/plugin-fs'; // For saving ICS

// Fix Leaflet's default icon path issue
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

// Interface for EventData from Rust (matches models.rs)
interface EventData {
  id: string;
  title: string;
  url_suffix?: string;
  full_url?: string;
  date_time_summary?: string;
  list_date?: string;
  start_datetime?: string; // Will be string representation of NaiveDateTime from Rust
  end_datetime?: string;   // Will be string representation of NaiveDateTime from Rust
  datetime_str_raw_detail?: string;
  short_description?: string;
  full_description?: string;
  image_url?: string;
  list_specific_location?: string;
  specific_location_name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  list_price?: string;
  price?: string;
}

const EindhovenCentraalStation: LatLngExpression = [51.4416, 5.4697];

function ChangeView({ center, zoom }: { center: LatLngExpression; zoom: number }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

function App() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [mapCenter, setMapCenter] = useState<LatLngExpression>(EindhovenCentraalStation);
  const [mapZoom, setMapZoom] = useState<number>(13);

  useEffect(() => {
    const loadEvents = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log("Invoking fetch_events_rust...");
        const fetchedEvents = await invoke<EventData[]>("fetch_events_rust");
        console.log(`Fetched ${fetchedEvents.length} events from Rust.`);
        setEvents(fetchedEvents.filter(event => event.latitude && event.longitude)); // Filter for map display
         // If no events have lat/lon, show all for list view initially
        if (fetchedEvents.filter(event => event.latitude && event.longitude).length === 0 && fetchedEvents.length > 0) {
             setEvents(fetchedEvents); // Show all in list if none have coords
             console.warn("No events have latitude/longitude for map display. Showing all in list.");
        }

      } catch (e: any) {
        console.error("Failed to fetch events from Rust:", e);
        setError(`Failed to fetch events: ${e.message || e.toString()}`);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, []);

  const handleMarkerClick = (event: EventData) => {
    setSelectedEvent(event);
    if (event.latitude && event.longitude) {
      setMapCenter([event.latitude, event.longitude]);
      setMapZoom(15);
    }
  };

  const handleListItemClick = (event: EventData) => {
    setSelectedEvent(event);
    if (event.latitude && event.longitude) {
      setMapCenter([event.latitude, event.longitude]);
      setMapZoom(15);
    }
    const mapElement = document.getElementById('event-map');
    mapElement?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleAddToCalendar = async (event: EventData) => {
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
      console.error("Failed to add to calendar:", e);
      alert(`Error: ${e.message || e.toString() || 'Could not generate or save calendar file.'}`);
    }
  };
  
  const openEventUrl = async (url?: string) => {
    if (url) {
      try {
        await open(url);
      } catch (e) {
        console.error("Failed to open URL:", e);
        alert("Could not open the event link.");
      }
    }
  };

  if (loading) return <p className="p-4 text-center">Loading events from Rust backend...</p>;
  if (error) return <p className="p-4 text-center text-red-500">{error}</p>;

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-100">
      {/* Event List Panel */}
      <div className="md:w-1/3 lg:w-1/4 h-1/2 md:h-full overflow-y-auto p-4 bg-white shadow-lg">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Eindhoven Events ({events.length})</h2>
        {events.length === 0 && <p>No events found.</p>}
        <ul>
          {events.map((event) => ( // Using event.id from Rust as key
            <li key={event.id} 
                className={`p-3 mb-3 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer border-l-4 ${selectedEvent?.id === event.id ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}`}
                onClick={() => handleListItemClick(event)}>
              <h3 className="font-semibold text-lg text-blue-700">{event.title}</h3>
              {event.image_url && <img src={event.image_url} alt={event.title} className="my-2 rounded-md w-full h-32 object-cover"/>}
              <p className="text-sm text-gray-600">{event.date_time_summary || event.list_date}</p>
              <p className="text-sm text-gray-700 mt-1">{event.list_specific_location || event.specific_location_name}</p>
              {event.list_price && <p className="text-sm font-medium text-green-600 mt-1">{event.list_price}</p>}
            </li>
          ))}
        </ul>
      </div>

      {/* Map and Detail Panel */}
      <div className="md:w-2/3 lg:w-3/4 flex flex-col h-1/2 md:h-full">
        <div id="event-map" className="flex-grow h-2/3 md:h-full" style={{ minHeight: '300px' }}>
          <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: "100%", width: "100%" }}>
            <ChangeView center={mapCenter} zoom={mapZoom} />
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            {events.filter(e => e.latitude && e.longitude).map((event) => ( // Filter again just for markers
                <Marker key={event.id} position={[event.latitude!, event.longitude!]} eventHandlers={{ click: () => handleMarkerClick(event) }}>
                  <Popup>
                    <div className="w-64">
                      <h4 className="font-bold text-md mb-1">{event.title}</h4>
                      {event.image_url && <img src={event.image_url} alt={event.title} className="mb-2 rounded w-full h-24 object-cover"/>}
                      <p className="text-xs text-gray-700 mb-1">{event.date_time_summary || event.list_date}</p>
                      <p className="text-xs text-gray-700 mb-1">{event.address || event.list_specific_location}</p>
                      {event.price && <p className="text-xs font-semibold text-green-700 mb-1">{event.price}</p>}
                      <p className="text-xs text-gray-600 mb-2 overflow-hidden max-h-20">{event.short_description}</p>
                      <button onClick={() => handleAddToCalendar(event)} className="text-xs bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded mr-1">Add to Calendar</button>
                      {event.full_url && <button onClick={() => openEventUrl(event.full_url)} className="text-xs bg-gray-500 hover:bg-gray-600 text-white py-1 px-2 rounded">More Info</button>}
                    </div>
                  </Popup>
                </Marker>
            ))}
          </MapContainer>
        </div>
        
        {selectedEvent && (
          <div className="p-4 bg-white shadow-md overflow-y-auto h-1/3 md:h-auto md:max-h-1/3">
            <h3 className="text-xl font-bold mb-2 text-gray-800">{selectedEvent.title}</h3>
            {selectedEvent.image_url && <img src={selectedEvent.image_url} alt={selectedEvent.title} className="my-2 rounded-lg w-full max-w-md mx-auto h-48 object-cover"/>}
            {/* Dates might need formatting if they are strings from Rust NaiveDateTime */}
            <p><strong>Date:</strong> {selectedEvent.date_time_summary || selectedEvent.list_date || selectedEvent.start_datetime?.substring(0,10)}</p>
            <p><strong>Time:</strong> {selectedEvent.start_datetime ? new Date(selectedEvent.start_datetime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'N/A'}
                {selectedEvent.end_datetime && ` - ${new Date(selectedEvent.end_datetime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`}
            </p>
            <p><strong>Location:</strong> {selectedEvent.address || selectedEvent.specific_location_name || selectedEvent.list_specific_location}</p>
            <p><strong>Price:</strong> {selectedEvent.price || selectedEvent.list_price || 'N/A'}</p>
            <p className="mt-2"><strong>Description:</strong> {selectedEvent.full_description || selectedEvent.short_description || 'N/A'}</p>
            <div className="mt-4">
              <button onClick={() => handleAddToCalendar(selectedEvent)} className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded mr-2">
                Add to Calendar
              </button>
              {selectedEvent.full_url && 
                <button onClick={() => openEventUrl(selectedEvent.full_url)} className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded">
                  Visit Event Page
                </button>
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;