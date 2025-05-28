// File: src/components/MiniMap.tsx
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';

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

  let tileUrl: string;
  let tileAttribution: string;
  let tileSubdomains: string | string[] = 'abc'; // Default

  // NOTE: For production, replace {YOUR_API_KEY} with an actual API key from Stadia Maps.
  const stadiaApiKey = "YOUR_STADIA_MAPS_API_KEY"; // Replace or remove for dev

  if (theme === 'dark') {
    // Stadia Alidade Smooth Dark
    // tileUrl = `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png?api_key=${stadiaApiKey}`;
    tileUrl = 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png'; // Dev URL
    tileAttribution = '© <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> © <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';
    tileSubdomains = ['a', 'b', 'c', 'd'];
  } else {
    // CartoDB Voyager for light theme
    tileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    tileAttribution = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>';
    tileSubdomains = 'abcd';
  }
  
  const mapId = `minimap-${React.useId()}`; 

  return (
    <div id={mapId} className={`w-full rounded-lg overflow-hidden shadow-md ${className}`}>
    <MapContainer
      key={theme + tileUrl} // Add tileUrl to key
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
        subdomains={tileSubdomains}
        maxZoom={19}
      />
      <Marker position={mapCenter} />
    </MapContainer>
    </div>
  );
};

export default MiniMap;