import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'; // Removed Popup from imports
import L, { LatLngExpression, DivIcon } from 'leaflet';
import { EventData } from '../types';
import CustomEventMapMarker from './CustomEventMapMarker';

// Default Leaflet icons are now configured globally in main.tsx

interface EventMapProps {
  events: EventData[];
  mapCenter: LatLngExpression;
  mapZoom: number;
  onMarkerClick: (event: EventData) => void; // This will now be the primary action
  // handleAddToCalendar and openEventUrl are no longer needed here if we remove the popup
  // but they are used by App.tsx for the main overlay, so keep them if App.tsx needs them for other contexts
  // For clarity, I'll remove them from props if they are *only* for the removed popup.
  // App.tsx already has access to these functions for the EventDetailOverlay.
  theme: 'light' | 'dark';
}

function ChangeView({ center, zoom }: { center: LatLngExpression; zoom: number }) {
  const map = useMap();
  React.useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}

const EventMap: React.FC<EventMapProps> = ({ events, mapCenter, mapZoom, onMarkerClick, theme }) => {
  
  const tileUrl = theme === 'dark' 
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' 
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
  
  const tileAttribution = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>';

  const createCustomIcon = (event: EventData): DivIcon => {
    const html = ReactDOMServer.renderToString(
      <CustomEventMapMarker event={event} theme={theme} />
    );
    return L.divIcon({
      html: html,
      className: '', 
      iconAnchor: [15, 15], 
      popupAnchor: [0, -10] 
    });
  };

  return (
    <div id="event-map" className="flex-grow h-full" style={{ minHeight: '300px' }}>
      <MapContainer 
        center={mapCenter} 
        zoom={mapZoom} 
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
        <ChangeView center={mapCenter} zoom={mapZoom} />
        <TileLayer
          url={tileUrl}
          attribution={tileAttribution}
          subdomains={'abcd'}
          maxZoom={19}
        />
        {events.map((event) => (
          <Marker 
            key={event.id} 
            position={[event.latitude!, event.longitude!]} 
            icon={createCustomIcon(event)}
            eventHandlers={{ 
              click: () => {
                console.log("Marker clicked on EventMap, triggering onMarkerClick for:", event.title);
                onMarkerClick(event); // This will call handleSelectEvent in App.tsx
              }
            }}
          >
            {/* REMOVED THE <Popup> COMPONENT ENTIRELY */}
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default EventMap;