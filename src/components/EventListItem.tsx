// File: src/components/EventListItem.tsx
import React from 'react';
import { EventData } from '../types';
import { CalendarIcon, ClockIcon, PinIcon, EuroIcon } from './Icons';
import MiniMap from './MiniMap'; // Import the new MiniMap component

interface EventListItemProps {
  event: EventData;
  onSelectEvent: (event: EventData) => void;
  isSelected: boolean;
  isLoadingDetails?: boolean;
}

const formatDate = (dateTimeStr?: string): string => {
  if (!dateTimeStr) return 'N/A';
  try {
    const date = new Date(dateTimeStr.replace(' ', 'T'));
     if (isNaN(date.getTime())) return dateTimeStr;
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch (e) { return dateTimeStr; }
};

const formatTime = (dateTimeStr?: string): string => {
  if (!dateTimeStr) return 'N/A';
  try {
    const date = new Date(dateTimeStr.replace(' ', 'T'));
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: false });
  } catch (e) { return 'N/A'; }
};

const InfoRow: React.FC<{ icon: React.ReactNode; text: string | React.ReactNode; className?: string }> = ({ icon, text, className = "" }) => {
  if (!text || text === 'N/A' || (typeof text === 'string' && text.includes('N/A (click to load)'))) {
    // Don't render if no meaningful text, unless it's a loading prompt we want to show
     if (typeof text === 'string' && text.includes('N/A (click to load)')) {
        // Allow "Time N/A (click to load)"
     } else if (!text || text === 'N/A') {
        return null; // Hide row if text is "N/A" and not the loading prompt
     }
  }
  return (
    <div className={`flex items-start space-x-2 text-sm ${className}`}> {/* items-start for multi-line text */}
      <span className="flex-shrink-0 w-5 h-5 text-gray-500 dark:text-gray-400 pt-0.5">{icon}</span>
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

  const hasCoordinates = typeof event.latitude === 'number' && typeof event.longitude === 'number';

  return (
    <li
      className={`p-4 rounded-xl shadow-lg hover:shadow-xl transition-all cursor-pointer flex flex-col items-start relative overflow-hidden
                  ${isSelected ? 'ring-2 ring-blue-500 bg-blue-100 dark:bg-slate-700 dark:ring-blue-400' : 'bg-white dark:bg-slate-800'} 
                  dark:hover:bg-slate-700`} // Removed md:flex-row for now to stack image, content, and map vertically
      onClick={() => onSelectEvent(event)}
    >
      {isLoadingDetails && (
        <div className="absolute inset-0 bg-slate-400 bg-opacity-20 dark:bg-slate-900 dark:bg-opacity-40 backdrop-blur-sm flex items-center justify-center rounded-xl z-20"> {/* Increased z-index */}
          <p className="text-slate-700 dark:text-slate-200 text-sm font-medium bg-white/70 dark:bg-slate-700/70 px-3 py-1 rounded-full shadow">Loading details...</p>
        </div>
      )}
      
      <div className="flex flex-col md:flex-row w-full items-start space-x-0 md:space-x-4"> {/* Inner flex for image and main content */}
        {event.image_url ? (
          <img 
            src={event.image_url} 
            alt={event.title} 
            className="w-full md:w-48 h-40 object-cover rounded-lg mb-4 md:mb-0 flex-shrink-0 self-center md:self-start" 
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full md:w-48 h-40 bg-gray-200 dark:bg-slate-700 rounded-lg mb-4 md:mb-0 flex-shrink-0 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400 self-center md:self-start">
            <p>Image Not Available</p>
          </div>
        )}
        
        <div className="flex-grow flex flex-col justify-between w-full">
          <div>
            <h3 className="font-bold text-xl text-blue-600 dark:text-blue-400 mb-2">{event.title}</h3>
            <div className="space-y-1.5 mb-3"> {/* Reduced space-y slightly */}
              {displayDate !== 'N/A' && <InfoRow icon={<CalendarIcon />} text={displayDate} />}
              {displayTime !== 'Time N/A (click to load)' && displayTime !== 'N/A' && <InfoRow icon={<ClockIcon />} text={displayTime} />}
              {displayLocation !== 'N/A' && <InfoRow icon={<PinIcon />} text={displayLocation} />}
              {displayPrice !== 'N/A' && <InfoRow icon={<EuroIcon />} text={displayPrice} className="text-green-600 dark:text-green-400 font-medium" />}
            </div>
          </div>
          {displayDescription && displayDescription !== 'No description available.' && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed line-clamp-3"> {/* Consistent line clamp */}
              {displayDescription}
            </p>
          )}
        </div>
      </div>

      {/* Conditionally render MiniMap for selected item with coordinates */}
      {isSelected && event.isDetailed && hasCoordinates && (
        <div className="w-full mt-4 transition-all duration-300 ease-in-out">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Location Map:</h4>
          <MiniMap 
            key={event.id} /* Add key to force re-render if event changes */
            center={[event.latitude!, event.longitude!]} 
            zoom={15} 
          />
        </div>
      )}
    </li>
  );
};

export default EventListItem;