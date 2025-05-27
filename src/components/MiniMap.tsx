// File: src/components/MiniMap.tsx
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';
// Removed 'leaflet/dist/leaflet.css' import, now in main.tsx

// Fix Leaflet's default icon path issue (already present and correct)
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

interface MiniMapProps {
  center: LatLngExpression;
  zoom?: number;
  className?: string;
  theme: 'light' | 'dark'; // Add theme prop
}

// Component to smoothly update map view when center prop changes
const ChangeViewMini: React.FC<{ center: LatLngExpression; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true, duration: 0.5 });
  }, [map, center, zoom]);
  return null;
};

const MiniMap: React.FC<MiniMapProps> = ({ center, zoom = 15, className = "", theme }) => {
  const mapCenter = Array.isArray(center) && center.length === 2 && typeof center[0] === 'number' && typeof center[1] === 'number'
    ? center
    : [0, 0];

  const tileUrl = theme === 'dark' 
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' 
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
  
  const tileAttribution = '© <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors © <a href="https://carto.com/attributions">CARTO</a>';

  // Unique ID for the map container to prevent issues if multiple minimaps are on page, though key in EventListItem should handle this for React's VDOM
  const mapId = `minimap-${React.useId()}`; 

  return (
    <div id={mapId} className={`w-full rounded-lg overflow-hidden shadow-md ${className}`}> {/* Ensure className for height (e.g. h-48) is passed */}
      <MapContainer 
        center={mapCenter} 
        zoom={zoom} 
        style={{ height: "100%", width: "100%" }} 
        scrollWheelZoom={false} 
        dragging={false} 
        doubleClickZoom={false} 
        touchZoom={false}
        attributionControl={false} // Smaller map, less clutter
      >
        <ChangeViewMini center={mapCenter} zoom={zoom} />
        <TileLayer
          url={tileUrl}
          attribution={tileAttribution}
          subdomains='abcd'
          maxZoom={19}
        />
        <Marker position={mapCenter} />
      </MapContainer>
    </div>
  );
};

export default MiniMap;