import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { EventData } from '../types';

// Fix Leaflet's default icon path issue
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
  map.setView(center, zoom);
  return null;
}

const EventMap: React.FC<EventMapProps> = ({ events, mapCenter, mapZoom, onMarkerClick, handleAddToCalendar, openEventUrl, theme }) => {
  return (
    <div id="event-map" className={`flex-grow h-2/3 md:h-full ${theme === 'dark' ? 'dark-map-tiles' : ''}`} style={{ minHeight: '300px' }}>
      <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: "100%", width: "100%" }}>
        <ChangeView center={mapCenter} zoom={mapZoom} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {events.filter(e => e.latitude && e.longitude).map((event) => (
          <Marker key={event.id} position={[event.latitude!, event.longitude!]} eventHandlers={{ click: () => onMarkerClick(event) }}>
            <Popup>
              <div className="w-64 dark:bg-slate-800 dark:text-gray-200 p-1 rounded-md"> {/* Popup styling for dark mode */}
                <h4 className="font-bold text-md mb-1 dark:text-white">{event.title}</h4>
                {event.image_url && 
                  <img 
                    src={event.image_url} 
                    alt={event.title} 
                    className="mb-2 rounded w-full h-24 object-cover"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />}
                <p className="text-xs text-gray-700 dark:text-gray-300 mb-1">{event.date_time_summary || event.list_date}</p>
                <p className="text-xs text-gray-700 dark:text-gray-300 mb-1">{event.address || event.list_specific_location}</p>
                {event.price && <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1">{event.price}</p>}
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 overflow-hidden max-h-20">{event.short_description}</p>
                <button onClick={() => handleAddToCalendar(event)} className="text-xs bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded mr-1">Add to Calendar</button>
                {event.full_url && <button onClick={() => openEventUrl(event.full_url)} className="text-xs bg-gray-500 hover:bg-gray-600 text-white py-1 px-2 rounded">More Info</button>}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default EventMap;