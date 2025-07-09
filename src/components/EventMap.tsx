import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L, { LatLngExpression, DivIcon } from 'leaflet';
import { EventData } from '../types';
import CustomEventMapMarker from './CustomEventMapMarker';

interface EventMapProps {
  events: EventData[];
  mapCenter: LatLngExpression;
  mapZoom: number;
  onMarkerClick: (event: EventData) => void;
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
  
  let tileUrl: string;
  let tileAttribution: string;
  let tileSubdomains: string | string[] = 'abc'; // Default

  // NOTE: For production, replace {YOUR_API_KEY} with an actual API key from Stadia Maps.
  // For development, this URL without a key might work for a bit or show a watermark.

  if (theme === 'dark') {
    // Stadia Alidade Smooth Dark
    // If you have an API key:
    // tileUrl = `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png?api_key=${stadiaApiKey}`;
    // If trying without an API key for development (check their ToS):
    tileUrl = 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png';
    tileAttribution = '© <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> © <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors';
    tileSubdomains = ['a', 'b', 'c', 'd']; // Stadia often uses subdomains
  } else {
    // CartoDB Voyager for light theme
    tileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    tileAttribution = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>';
    tileSubdomains = 'abcd';
  }

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
        key={theme + tileUrl} // Add tileUrl to key to ensure remount on URL change
        center={mapCenter} 
        zoom={mapZoom} 
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
        <ChangeView center={mapCenter} zoom={mapZoom} />
        <TileLayer
          url={tileUrl}
          attribution={tileAttribution}
          subdomains={tileSubdomains}
          maxZoom={19} // Stadia supports up to zoom 20
        />
        {events.map((event) => (
          <Marker 
            key={event.id} 
            position={[event.latitude!, event.longitude!]} 
            icon={createCustomIcon(event)}
            eventHandlers={{ 
              click: () => {
                onMarkerClick(event);
              }
            }}
          >
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default EventMap;