// File: src/components/EventListItem.tsx
import React from 'react';
import { EventData } from '../types';

interface EventListItemProps {
  event: EventData;
  onSelectEvent: (event: EventData) => void;
  isSelected: boolean;
  isLoadingDetails?: boolean; // New prop
}

// Helper to format NaiveDateTime string (assuming it's like "YYYY-MM-DDTHH:MM:SS")
const formatDateTime = (dateTimeStr?: string): string => {
  if (!dateTimeStr) return 'N/A';
  try {
    const date = new Date(dateTimeStr.replace(' ', 'T')); // Ensure ISO-like format for Date constructor
    if (isNaN(date.getTime())) return dateTimeStr; // Return original if parsing failed
    return date.toLocaleString(undefined, { 
      month: 'short', day: 'numeric', 
      hour: 'numeric', minute: '2-digit', hour12: false 
    });
  } catch (e) {
    console.warn("Error formatting date:", dateTimeStr, e);
    return dateTimeStr; // Fallback to original string
  }
};
const formatDate = (dateTimeStr?: string): string => {
  if (!dateTimeStr) return 'N/A';
  try {
    const date = new Date(dateTimeStr.replace(' ', 'T'));
     if (isNaN(date.getTime())) return dateTimeStr;
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', month: 'long', day: 'numeric' 
    });
  } catch (e) {
    return dateTimeStr;
  }
};
const formatTime = (dateTimeStr?: string): string => {
  if (!dateTimeStr) return 'N/A';
  try {
    const date = new Date(dateTimeStr.replace(' ', 'T'));
    if (isNaN(date.getTime())) return 'N/A'; // Important check
    return date.toLocaleTimeString(undefined, { 
      hour: 'numeric', minute: '2-digit', hour12: false 
    });
  } catch (e) {
    return 'N/A';
  }
};


const EventListItem: React.FC<EventListItemProps> = ({ event, onSelectEvent, isSelected, isLoadingDetails }) => {
  const displayDate = event.isDetailed && event.start_datetime 
                      ? formatDate(event.start_datetime) 
                      : (event.list_date || event.date_time_summary || 'N/A');
  
  const displayTime = event.isDetailed && event.start_datetime
                      ? `${formatTime(event.start_datetime)}${event.end_datetime ? ` - ${formatTime(event.end_datetime)}` : ''}`
                      : 'Time N/A (click to load)';

  const displayLocation = event.isDetailed && event.address 
                          ? event.address 
                          : (event.list_specific_location || event.specific_location_name || 'N/A');

  return (
    <li
      className={`p-4 mb-4 rounded-lg shadow-md hover:shadow-lg transition-all cursor-pointer border-l-4 flex flex-col sm:flex-row items-start space-x-0 sm:space-x-4 relative
                  ${isSelected ? 'border-blue-500 bg-blue-100 dark:bg-slate-700' : 'border-gray-300 bg-white dark:border-slate-600 dark:bg-slate-800'} 
                  dark:hover:bg-slate-700`}
      onClick={() => onSelectEvent(event)}
    >
      {isLoadingDetails && (
        <div className="absolute inset-0 bg-black bg-opacity-10 dark:bg-opacity-50 flex items-center justify-center rounded-lg z-10">
          <p className="text-white text-sm bg-black bg-opacity-50 px-2 py-1 rounded">Loading details...</p>
        </div>
      )}
      {event.image_url && (
        <img 
          src={event.image_url} 
          alt={event.title} 
          className="w-full sm:w-32 md:w-40 h-32 object-cover rounded-md mb-3 sm:mb-0 flex-shrink-0" 
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
      {!event.image_url && (
         <div className="w-full sm:w-32 md:w-40 h-32 bg-gray-200 dark:bg-slate-700 rounded-md mb-3 sm:mb-0 flex-shrink-0 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400">
           Image N/A
         </div>
      )}
      <div className="flex-grow">
        <h3 className="font-semibold text-lg text-blue-700 dark:text-blue-400 mb-1">{event.title}</h3>
        
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
          <span className="font-medium">Date:</span> {displayDate}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
          <span className="font-medium">Time:</span> {displayTime}
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-400 mb-1">
          <span className="font-medium">Location:</span> {displayLocation}
        </p>
        {(event.price || event.list_price) && (
          <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">
            <span className="font-medium text-gray-700 dark:text-gray-400">Price:</span> {event.isDetailed && event.price ? event.price : (event.list_price || 'N/A')}
          </p>
        )}
        {(event.full_description || event.short_description) && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
            {event.isDetailed && event.full_description ? event.full_description : (event.short_description || 'N/A')}
          </p>
        )}
      </div>
    </li>
  );
};

export default EventListItem;