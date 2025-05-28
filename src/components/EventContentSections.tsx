// src/components/EventContentSections.tsx
import React from 'react';
import MiniMap from './MiniMap'; // Assuming MiniMap is correctly set up
import { EventData } from '../types';

interface EventContentSectionsProps {
  description?: string;
  eventLocation?: { lat: number; lon: number; id: string };
  theme: 'light' | 'dark';
}

const EventContentSections: React.FC<EventContentSectionsProps> = ({ description, eventLocation, theme }) => {
  return (
    <>
      {description && description !== 'No description available.' && (
        <div className="pt-2">
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-2">About This Event</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
            {description}
          </p>
        </div>
      )}

      {eventLocation && (
        <div className="pt-2">
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-2">Location Map</h3>
          <MiniMap 
            key={`${eventLocation.id}-overlaymap-${theme}`}
            center={[eventLocation.lat, eventLocation.lon]} 
            zoom={15}
            className="h-56 sm:h-64 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700"
            theme={theme}
          />
        </div>
      )}
    </>
  );
};

export default EventContentSections;