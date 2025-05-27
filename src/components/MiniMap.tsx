// File: src/components/MiniMap.tsx
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css'; // Ensure Leaflet CSS is loaded

// Fix Leaflet's default icon path issue (if not already globally fixed by EventMap)
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
}

// Component to smoothly update map view when center prop changes
const ChangeViewMini: React.FC<{ center: LatLngExpression; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true, duration: 0.5 });
  }, [map, center, zoom]);
  return null;
};

const MiniMap: React.FC<MiniMapProps> = ({ center, zoom = 15, className = "" }) => {
  // Ensure center is a valid LatLngExpression, fallback if not.
  const mapCenter = Array.isArray(center) && center.length === 2 && typeof center[0] === 'number' && typeof center[1] === 'number'
    ? center
    : [0, 0]; // Fallback center, though this shouldn't be hit if used correctly

  return (
    <div id={`minimap-${Math.random().toString(36).substring(7)}`} className={`h-48 w-full rounded-lg overflow-hidden shadow-md ${className}`}>
      <MapContainer center={mapCenter} zoom={zoom} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false} dragging={false} doubleClickZoom={false} touchZoom={false}>
        <ChangeViewMini center={mapCenter} zoom={zoom} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='© <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        />
        <Marker position={mapCenter} />
      </MapContainer>
    </div>
  );
};

export default MiniMap;