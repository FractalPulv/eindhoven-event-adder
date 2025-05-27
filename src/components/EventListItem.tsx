// File: src/components/EventListItem.tsx
import React from 'react';
import { EventData } from '../types';
import { CalendarIcon, ClockIcon, PinIcon, EuroIcon } from './Icons'; // Import new icons

interface EventListItemProps {
  event: EventData;
  onSelectEvent: (event: EventData) => void;
  isSelected: boolean;
  isLoadingDetails?: boolean;
}

// Helper to format NaiveDateTime string (assuming it's like "YYYY-MM-DDTHH:MM:SS")
// (Keep your existing formatDate and formatTime helpers as they are good)
const formatDate = (dateTimeStr?: string): string => {
  if (!dateTimeStr) return 'N/A';
  try {
    const date = new Date(dateTimeStr.replace(' ', 'T')); // Ensure 'T' separator for cross-browser
     if (isNaN(date.getTime())) return dateTimeStr; // Return original if parsing failed
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', month: 'long', day: 'numeric' 
    });
  } catch (e) {
    return dateTimeStr; // Fallback
  }
};

const formatTime = (dateTimeStr?: string): string => {
  if (!dateTimeStr) return 'N/A';
  try {
    // Replace space with 'T' if your Rust NaiveDateTime string is "YYYY-MM-DD HH:MM:SS"
    // If it's already "YYYY-MM-DDTHH:MM:SS", this replace won't harm.
    const date = new Date(dateTimeStr.replace(' ', 'T')); 
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleTimeString(undefined, { 
      hour: 'numeric', minute: '2-digit', hour12: false 
    });
  } catch (e) {
    return 'N/A'; // Fallback
  }
};

const InfoRow: React.FC<{ icon: React.ReactNode; text: string | React.ReactNode; className?: string }> = ({ icon, text, className = "" }) => {
  if (!text || text === 'N/A' || (typeof text === 'string' && text.includes('N/A (click to load)'))) {
    // Optionally hide row or show placeholder if text is N/A and not essential
    // For now, we'll render it to show "N/A" or loading prompt
  }
  return (
    <div className={`flex items-center space-x-2 text-sm ${className}`}>
      <span className="flex-shrink-0 w-5 h-5 text-gray-500 dark:text-gray-400">{icon}</span>
      <span className="text-gray-700 dark:text-gray-300">{text}</span>
    </div>
  );
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
  
  const displayPrice = event.isDetailed && event.price 
                       ? event.price 
                       : (event.list_price || 'N/A');
  
  const displayDescription = event.isDetailed && event.full_description
                             ? event.full_description
                             : (event.short_description || 'No description available.');

  return (
    <li
      className={`p-4 rounded-xl shadow-lg hover:shadow-xl transition-all cursor-pointer flex flex-col md:flex-row items-start space-x-0 md:space-x-4 relative overflow-hidden
                  ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-slate-750' : 'bg-white dark:bg-slate-800'} 
                  dark:hover:bg-slate-700`}
      onClick={() => onSelectEvent(event)}
    >
      {isLoadingDetails && (
        <div className="absolute inset-0 bg-slate-400 bg-opacity-20 dark:bg-slate-900 dark:bg-opacity-40 backdrop-blur-sm flex items-center justify-center rounded-xl z-10">
          <p className="text-slate-700 dark:text-slate-200 text-sm font-medium bg-white/70 dark:bg-slate-700/70 px-3 py-1 rounded-full shadow">Loading details...</p>
        </div>
      )}
      
      {/* Image Container */}
      {event.image_url ? (
        <img 
          src={event.image_url} 
          alt={event.title} 
          className="w-full md:w-48 h-40 md:h-auto object-cover rounded-lg mb-4 md:mb-0 flex-shrink-0 self-center md:self-start" 
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      ) : (
         <div className="w-full md:w-48 h-40 bg-gray-200 dark:bg-slate-700 rounded-lg mb-4 md:mb-0 flex-shrink-0 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400 self-center md:self-start">
           <p>Image Not Available</p>
         </div>
      )}
      
      {/* Content Container */}
      <div className="flex-grow flex flex-col justify-between w-full">
        <div>
          <h3 className="font-bold text-xl text-blue-600 dark:text-blue-400 mb-2">{event.title}</h3>
          
          <div className="space-y-2 mb-3">
            {displayDate !== 'N/A' && <InfoRow icon={<CalendarIcon />} text={displayDate} />}
            {displayTime !== 'Time N/A (click to load)' && displayTime !== 'N/A' && <InfoRow icon={<ClockIcon />} text={displayTime} />}
            {displayLocation !== 'N/A' && <InfoRow icon={<PinIcon />} text={displayLocation} />}
            {displayPrice !== 'N/A' && <InfoRow icon={<EuroIcon />} text={displayPrice} className="text-green-600 dark:text-green-400 font-medium" />}
          </div>
        </div>

        {displayDescription && displayDescription !== 'No description available.' && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 leading-relaxed line-clamp-3 md:line-clamp-2">
            {displayDescription}
          </p>
        )}
      </div>
    </li>
  );
};

export default EventListItem;