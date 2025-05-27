import React from 'react';
import { EventData } from '../types'; // We'll create this types file

interface EventListItemProps {
  event: EventData;
  onSelectEvent: (event: EventData) => void;
  isSelected: boolean;
}

const EventListItem: React.FC<EventListItemProps> = ({ event, onSelectEvent, isSelected }) => {
  return (
    <li
      className={`p-3 mb-3 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer border-l-4 
                  ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-slate-700' : 'border-gray-300 bg-gray-50 dark:border-slate-600 dark:bg-slate-800'} 
                  dark:hover:bg-slate-700`}
      onClick={() => onSelectEvent(event)}
    >
      <h3 className="font-semibold text-lg text-blue-700 dark:text-blue-400">{event.title}</h3>
      {event.image_url && (
        <img 
          src={event.image_url} 
          alt={event.title} 
          className="my-2 rounded-md w-full h-32 object-cover" 
          onError={(e) => (e.currentTarget.style.display = 'none')} // Hide if image fails to load
        />
      )}
      <p className="text-sm text-gray-600 dark:text-gray-300">{event.date_time_summary || event.list_date}</p>
      <p className="text-sm text-gray-700 dark:text-gray-400 mt-1">{event.list_specific_location || event.specific_location_name}</p>
      {event.list_price && <p className="text-sm font-medium text-green-600 dark:text-green-400 mt-1">{event.list_price}</p>}
    </li>
  );
};

export default EventListItem;