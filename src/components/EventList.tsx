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
    <div className="md:w-1/3 lg:w-1/4 h-1/2 md:h-full overflow-y-auto p-4 bg-white dark:bg-slate-900 shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">Eindhoven Events ({events.length})</h2>
      {events.length === 0 && <p className="dark:text-gray-300">No events found.</p>}
      <ul>
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