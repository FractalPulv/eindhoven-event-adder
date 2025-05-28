// File: src/components/MiniMap.tsx
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';

// REMOVE these imports and the L.Icon.Default.mergeOptions block
// import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
// import iconUrl from 'leaflet/dist/images/marker-icon.png';
// import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
// L.Icon.Default.mergeOptions({ ... }); // REMOVE THIS

interface MiniMapProps {
  center: LatLngExpression;
  zoom?: number;
  className?: string;
  theme: 'light' | 'dark';
}

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

  const mapId = `minimap-${React.useId()}`; 

  return (
    <div id={mapId} className={`w-full rounded-lg overflow-hidden shadow-md ${className}`}>
    <MapContainer
      center={mapCenter}
      zoom={zoom}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom={false}
      dragging={false}
      doubleClickZoom={false}
      touchZoom={false}
      attributionControl={false}
    >
      <ChangeViewMini center={mapCenter} zoom={zoom} />
      <TileLayer
        url={tileUrl}
        attribution={tileAttribution}
        subdomains='abcd'
        maxZoom={19}
      />
      <Marker position={mapCenter} /> {/* It will now use the globally configured default icon */}
    </MapContainer>
    </div>
  );
};

export default MiniMap;