// File: src/components/EventList.tsx
import React from 'react';
import { EventData } from '../types';
import EventListItem from './EventListItem';

interface EventListProps {
  events: EventData[];
  onSelectEvent: (event: EventData) => void;
  loadingDetailsFor: string | null;
  eventInOverlayId?: string | null; 
}

const EventList: React.FC<EventListProps> = ({ events, onSelectEvent, loadingDetailsFor, eventInOverlayId }) => {
  const isLoadingSummaries = events.length === 0 && loadingDetailsFor === null; // Simplified check
  
  return (
    <div className="overflow-y-auto p-3 sm:p-4 bg-gray-100 dark:bg-black flex-grow"> 
      <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-gray-800 dark:text-gray-100 px-1">
        Eindhoven Events <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({events.length})</span>
      </h2>
      
      {events.length === 0 && !isLoadingSummaries && (
          <p className="text-gray-600 dark:text-gray-300 px-1">No events found.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
        {events.map((event) => (
          <EventListItem
            key={event.id}
            event={event}
            onSelectEvent={onSelectEvent}
            isSelectedInGrid={eventInOverlayId === event.id}
            isLoadingDetails={loadingDetailsFor === event.id}
          />
        ))}
      </div>
    </div>
  );
};

export default EventList;