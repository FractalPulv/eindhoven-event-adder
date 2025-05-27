// File: src/components/EventListItem.tsx
import React from 'react';
import { EventData } from '../types';

interface EventListItemProps {
  event: EventData;
  onSelectEvent: (event: EventData) => void;
  isSelected: boolean;
}

const EventListItem: React.FC<EventListItemProps> = ({ event, onSelectEvent, isSelected }) => {
  return (
    <li
      className={`p-4 mb-4 rounded-lg shadow-md hover:shadow-lg transition-all cursor-pointer border-l-4 flex flex-col sm:flex-row items-start space-x-0 sm:space-x-4
                  ${isSelected ? 'border-blue-500 bg-blue-100 dark:bg-slate-700' : 'border-gray-300 bg-white dark:border-slate-600 dark:bg-slate-800'} 
                  dark:hover:bg-slate-700`}
      onClick={() => onSelectEvent(event)}
    >
      {event.image_url && (
        <img 
          src={event.image_url} 
          alt={event.title} 
          className="w-full sm:w-32 md:w-40 h-32 object-cover rounded-md mb-3 sm:mb-0 flex-shrink-0" 
          onError={(e) => {
            // Hide the image element if it fails to load
            e.currentTarget.style.display = 'none';
            // Optionally, you could replace it with a placeholder element here
          }}
        />
      )}
      {!event.image_url && ( // Fallback for when there's no image_url
         <div className="w-full sm:w-32 md:w-40 h-32 bg-gray-200 dark:bg-slate-700 rounded-md mb-3 sm:mb-0 flex-shrink-0 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400">
           Image N/A
         </div>
      )}
      <div className="flex-grow">
        <h3 className="font-semibold text-lg text-blue-700 dark:text-blue-400 mb-1">{event.title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
          <span className="font-medium">Date:</span> {event.date_time_summary || event.list_date || 'N/A'}
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-400 mb-1">
          <span className="font-medium">Location:</span> {event.list_specific_location || event.specific_location_name || 'N/A'}
        </p>
        {event.list_price && (
          <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">
            <span className="font-medium text-gray-700 dark:text-gray-400">Price:</span> {event.list_price}
          </p>
        )}
        {event.short_description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
            {event.short_description}
          </p>
        )}
      </div>
    </li>
  );
};

export default EventListItem;