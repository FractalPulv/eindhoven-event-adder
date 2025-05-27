// File: src/components/EventListItem.tsx
import React from 'react';
import { EventData } from '../types';
import { CalendarIcon, ClockIcon, PinIcon, EuroIcon } from './Icons';
import MiniMap from './MiniMap';

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
    // Using short month, numeric day, and year for compactness
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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

const InfoRow: React.FC<{ icon: React.ReactNode; text: string | React.ReactNode; className?: string; title?: string }> = ({ icon, text, className = "", title }) => {
  if (!text || text === 'N/A' || (typeof text === 'string' && (text.includes('N/A') && !text.includes('Click to load')) ) ) {
    if (typeof text === 'string' && text.includes('Click to load')) {
      // Allow prompt to show
    } else {
      return null; // Don't render if no meaningful text (unless it's the specific loading prompt)
    }
  }
  return (
    <div className={`flex items-center space-x-1.5 text-xs ${className}`} title={title}> {/* Smaller space, text-xs */}
      <span className="flex-shrink-0 w-3.5 h-3.5 text-gray-500 dark:text-gray-400">{icon}</span>
      <span className="text-gray-600 dark:text-gray-300 leading-snug truncate" style={{ maxWidth: 'calc(100% - 20px)' }}>{text}</span> {/* Truncate long text */}
    </div>
  );
};

const EventListItem: React.FC<EventListItemProps> = ({ event, onSelectEvent, isSelected, isLoadingDetails }) => {
  const rawDate = event.isDetailed && event.start_datetime 
                  ? formatDate(event.start_datetime) 
                  : (event.list_date || event.date_time_summary || null);
  
  const rawTime = event.isDetailed && event.start_datetime
                  ? `${formatTime(event.start_datetime)}${event.end_datetime ? ` - ${formatTime(event.end_datetime)}` : ''}`
                  : null;

  // Combine Date and Time for inline display
  const displayDateTime: string | React.ReactNode | null = 
    (rawDate && rawTime) ? `${rawDate}  •  ${rawTime}` : 
    (rawDate || rawTime) ? (rawDate || rawTime) : 
    (isSelected && !event.isDetailed && !isLoadingDetails) ? <span className="italic text-gray-400 dark:text-gray-500">Click to load date/time</span> :
    (isLoadingDetails && isSelected) ? <span className="italic text-gray-400 dark:text-gray-500">Loading details...</span> : null;


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
  
  const imagePlaceholderSvg = "data:image/svg+xml;charset=UTF-8,%3Csvg width='120' height='120' viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='120' height='120' fill='%23E5E7EB'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23A0AEC0' font-family='sans-serif' font-size='10px'%3EImage%3C/text%3E%3C/svg%3E";
  const darkImagePlaceholderSvg = "data:image/svg+xml;charset=UTF-8,%3Csvg width='120' height='120' viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='120' height='120' fill='%232D3748'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23718096' font-family='sans-serif' font-size='10px'%3EImage%3C/text%3E%3C/svg%3E";

  const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';

  return (
    <div // Changed li to div as it will be a grid item
      className={`group relative flex flex-col overflow-hidden rounded-xl bg-white dark:bg-slate-800/80 backdrop-blur-sm
                  shadow-lg hover:shadow-xl focus-within:shadow-xl
                  transition-all duration-300 ease-in-out cursor-pointer h-full 
                  ${isSelected ? 'ring-2 ring-blue-500 dark:ring-blue-400' : 'border border-gray-200 dark:border-slate-700/70'}
                  ${isLoadingDetails ? 'opacity-60 pointer-events-none animate-pulse' : ''}`}
      onClick={!isLoadingDetails ? () => onSelectEvent(event) : undefined}
      tabIndex={0}
      onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectEvent(event);}}
    >
      {/* Image Section - Top part of the card */}
      <div className="w-full h-36 sm:h-40 md:h-44 flex-shrink-0 bg-gray-100 dark:bg-slate-700"> {/* Added bg for placeholder area */}
        {event.image_url ? (
          <img 
            src={event.image_url} 
            alt={event.title} 
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.currentTarget;
              target.onerror = null; 
              target.src = currentTheme === 'dark' ? darkImagePlaceholderSvg : imagePlaceholderSvg;
              target.alt = "Image failed to load";
            }}
          />
        ) : (
          <img 
            src={currentTheme === 'dark' ? darkImagePlaceholderSvg : imagePlaceholderSvg}
            alt="No image available"
            className="w-full h-full object-cover"
          />
        )}
      </div>
      
      {/* Content Section - Below image */}
      <div className="p-3 sm:p-4 flex-grow flex flex-col justify-between">
        <div> {/* Container for title and info rows to control spacing from description */}
            <h3 className="font-semibold text-sm sm:text-base text-blue-600 dark:text-blue-400 mb-2 leading-tight group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors line-clamp-2">
            {event.title}
            </h3>
            
            <div className="space-y-1.5 mb-2.5 text-xs">
                {displayDateTime && <InfoRow icon={<CalendarIcon />} text={displayDateTime} title={event.datetime_str_raw_detail || "Date and Time"} /> }
                {displayLocation !== 'N/A' && <InfoRow icon={<PinIcon />} text={displayLocation} title="Location" />}
                {displayPrice !== 'N/A' && <InfoRow icon={<EuroIcon />} text={displayPrice} className="text-green-600 dark:text-green-400" title="Price"/>}
            </div>
        </div>

        {displayDescription && displayDescription !== 'No description available.' && (
          <p className={`text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed ${isSelected ? 'line-clamp-none' : 'line-clamp-2 sm:line-clamp-3'} transition-all duration-300`}>
            {displayDescription}
          </p>
        )}
      </div>

      {/* MiniMap for selected item - appears at the bottom, inside padding */}
      {isSelected && event.isDetailed && hasCoordinates && (
        <div className="w-auto mx-3 sm:mx-4 mb-3 sm:mb-4 mt-2 transition-all duration-500 ease-in-out">
          <MiniMap 
            key={`${event.id}-minimap-${currentTheme}`}
            center={[event.latitude!, event.longitude!]} 
            zoom={14}
            className="h-32 rounded-md" // Shorter MiniMap
            theme={currentTheme}
          />
        </div>
      )}

      {/* Loading Spinner (Simplified) */}
      {isLoadingDetails && isSelected && ( // Show only if selected and loading
        <div className="absolute inset-0 bg-white/20 dark:bg-slate-900/20 backdrop-blur-sm flex items-center justify-center z-10 rounded-xl">
          <svg className="animate-spin h-5 w-5 text-blue-500 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      )}
    </div>
  );
};

export default EventListItem;