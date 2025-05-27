import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';
// Removed 'leaflet/dist/leaflet.css' import, now in main.tsx
import { EventData } from '../types';

// Fix Leaflet's default icon path issue (already present and correct)
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

interface EventMapProps {
  events: EventData[];
  mapCenter: LatLngExpression;
  mapZoom: number;
  onMarkerClick: (event: EventData) => void;
  handleAddToCalendar: (event: EventData) => Promise<void>;
  openEventUrl: (url?: string) => Promise<void>;
  theme: 'light' | 'dark';
}

function ChangeView({ center, zoom }: { center: LatLngExpression; zoom: number }) {
  const map = useMap();
  React.useEffect(() => { // Added useEffect to prevent multiple setView calls during render
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}

const EventMap: React.FC<EventMapProps> = ({ events, mapCenter, mapZoom, onMarkerClick, handleAddToCalendar, openEventUrl, theme }) => {
  
  const tileUrl = theme === 'dark' 
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' 
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'; // Voyager is a good light alternative to Positron
  
  const tileAttribution = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>';

  return (
    // Removed dark-map-tiles class, using specific dark tiles now
    <div id="event-map" className="flex-grow h-full" style={{ minHeight: '300px' }}>
      <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: "100%", width: "100%" }}>
        <ChangeView center={mapCenter} zoom={mapZoom} />
        <TileLayer
          url={tileUrl}
          attribution={tileAttribution}
          subdomains={theme === 'dark' ? 'abcd' : 'abcd'} // CartoDB often uses abcd subdomains
          maxZoom={19}
        />
        {events.filter(e => e.latitude && e.longitude).map((event) => (
          <Marker 
            key={event.id} 
            position={[event.latitude!, event.longitude!]} 
            eventHandlers={{ click: () => onMarkerClick(event) }}
          >
            <Popup>
              <div className="w-64 p-3 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-transparent dark:border-slate-700">
                <h4 className="font-semibold text-base mb-2 text-gray-800 dark:text-white truncate">{event.title}</h4>
                {event.image_url && 
                  <img 
                    src={event.image_url} 
                    alt={event.title} 
                    className="mb-2 rounded-md w-full h-28 object-cover" // Slightly taller image
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />}
                
                <div className="space-y-1.5 text-xs mb-3">
                  {(event.date_time_summary || event.list_date) && 
                    <p className="flex items-center text-gray-600 dark:text-gray-300">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>
                      {event.date_time_summary || event.list_date}
                    </p>}
                  {(event.address || event.list_specific_location) && 
                    <p className="flex items-start text-gray-600 dark:text-gray-300">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1.5 flex-shrink-0 mt-px" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                      {event.address || event.list_specific_location}
                    </p>}
                  {event.price && 
                    <p className="flex items-center font-medium text-green-600 dark:text-green-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.5 2.5 0 00-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0 2a10 10 0 100-20 10 10 0 000 20z" clipRule="evenodd" /></svg>
                      {event.price}
                    </p>}
                </div>

                {event.short_description && 
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-3">{event.short_description}</p>}
                
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => handleAddToCalendar(event)} 
                    className="w-full text-xs bg-blue-500 hover:bg-blue-600 text-white py-1.5 px-2 rounded-md transition-colors focus:ring-2 focus:ring-blue-300 focus:outline-none"
                  >
                    Add to Calendar
                  </button>
                  {event.full_url && 
                    <button 
                      onClick={() => openEventUrl(event.full_url)} 
                      className="w-full text-xs bg-slate-500 hover:bg-slate-600 text-white py-1.5 px-2 rounded-md transition-colors focus:ring-2 focus:ring-slate-300 focus:outline-none"
                    >
                      More Info
                    </button>}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default EventMap;