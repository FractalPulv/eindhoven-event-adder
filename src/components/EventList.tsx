// File: src/components/EventList.tsx
import React from 'react';
import { EventData } from '../types';
import EventListItem from './EventListItem';

interface EventListProps {
  events: EventData[];
  selectedEvent: EventData | null;
  onSelectEvent: (event: EventData) => void;
}

const EventList: React.FC<EventListProps> = ({ events, selectedEvent, onSelectEvent }) => {
  return (
    <div className="w-full h-full overflow-y-auto p-4 md:p-6 bg-gray-100 dark:bg-slate-800"> 
      <h2 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 text-gray-800 dark:text-gray-100">
        Eindhoven Events ({events.length})
      </h2>
      {events.length === 0 && <p className="text-gray-600 dark:text-gray-300">No events found.</p>}
      <ul className="space-y-4"> {/* Adds spacing between list items */}
        {events.map((event) => (
          <EventListItem
            key={event.id}
            event={event}
            onSelectEvent={onSelectEvent}
            isSelected={selectedEvent?.id === event.id}
          />
        ))}
      </ul>
    </div>
  );
};

export default EventList;