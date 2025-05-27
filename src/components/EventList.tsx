// File: src/components/EventList.tsx
import React from 'react';
import { EventData } from '../types';
import EventListItem from './EventListItem';

interface EventListProps {
  events: EventData[];
  // selectedEvent: EventData | null; // This prop might be for the overlay's event
  onSelectEvent: (event: EventData) => void;
  loadingDetailsFor: string | null;
  // Add a new prop for the event currently in the overlay to highlight the grid item
  eventInOverlayId?: string | null; 
}

const EventList: React.FC<EventListProps> = ({ events, onSelectEvent, loadingDetailsFor, eventInOverlayId }) => {
  const isLoadingSummaries = events.length === 0 && loadingDetailsFor === null && !selectedEvent; // A simple check if initial load might be happening
  
  return (
    <div className="overflow-y-auto p-3 sm:p-4 bg-gray-100 dark:bg-slate-900 flex-grow"> 
      <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-gray-800 dark:text-gray-100 px-1">
        Eindhoven Events <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({events.length})</span>
      </h2>
      
      {events.length === 0 && !isLoadingSummaries && ( // Check if not loading summaries
          <p className="text-gray-600 dark:text-gray-300 px-1">No events found.</p>
      )}

      {/* Grid layout for event items */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
        {events.map((event) => (
          <EventListItem
            key={event.id}
            event={event}
            onSelectEvent={onSelectEvent}
            isSelectedInGrid={eventInOverlayId === event.id} // Pass this down
            isLoadingDetails={loadingDetailsFor === event.id}
          />
        ))}
      </div>
    </div>
  );
};

export default EventList;