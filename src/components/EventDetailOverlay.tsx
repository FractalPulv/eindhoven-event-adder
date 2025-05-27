// File: src/components/EventDetailOverlay.tsx
import React, { useEffect, useState } from 'react';
import { EventData } from '../types';
import MiniMap from './MiniMap';
import { CalendarIcon, ClockIcon, PinIcon, EuroIcon, XMarkIcon } from './Icons';

interface EventDetailOverlayProps {
  event: EventData | null;
  onClose: () => void;
  handleAddToCalendar: (event: EventData) => Promise<void>;
  openEventUrl: (url?: string) => Promise<void>;
  theme: 'light' | 'dark';
}

const formatDate = (dateTimeStr?: string): string => {
  if (!dateTimeStr) return 'N/A';
  try {
    // Assuming dateTimeStr is like "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS"
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

const calculateDuration = (startStr?: string, endStr?: string): string | null => {
  if (!startStr || !endStr) return null;
  try {
    const startDate = new Date(startStr.replace(' ', 'T'));
    const endDate = new Date(endStr.replace(' ', 'T'));
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null;

    let diffMs = endDate.getTime() - startDate.getTime();
    if (diffMs < 0) return null; // Should not happen if data is correct

    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0 && minutes === 0) return null; // No duration or invalid

    let durationString = '(';
    if (hours > 0) {
      durationString += `${hours} hour${hours > 1 ? 's' : ''}`;
    }
    if (minutes > 0) {
      if (hours > 0) durationString += ' ';
      durationString += `${minutes} min${minutes > 1 ? 's' : ''}`;
    }
    durationString += ')';
    return durationString;

  } catch (e) {
    console.error("Error calculating duration:", e);
    return null;
  }
};

const InfoItem: React.FC<{ icon: React.ReactNode; label: string; value?: string | React.ReactNode | null; className?: string }> = ({ icon, label, value, className }) => {
  if (!value || value === 'N/A') return null;
  return (
    <div className={`flex items-start space-x-3 ${className}`}>
      <div className="flex-shrink-0 w-5 h-5 text-blue-500 dark:text-blue-400 mt-1">{icon}</div>
      <div className="flex-grow">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</p>
        {typeof value === 'string' ? (
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{value}</p>
        ) : (
            <div className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{value}</div>
        )}
      </div>
    </div>
  );
};


const EventDetailOverlay: React.FC<EventDetailOverlayProps> = ({ event: eventProp, onClose, handleAddToCalendar, openEventUrl, theme }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (eventProp) {
      setIsVisible(true);
      document.body.style.overflow = 'hidden';
    } else {
      setIsVisible(false); 
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [eventProp]);

  const handleClose = () => {
    setIsVisible(false); 
    setTimeout(() => { onClose(); }, 300); 
  };

  useEffect(() => { 
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && eventProp) { handleClose(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [eventProp, onClose]);

  if (!eventProp && !isVisible) { return null; }
  
  const currentEvent = eventProp;

  const displayDateStr = currentEvent?.start_datetime ? formatDate(currentEvent.start_datetime) : (currentEvent?.list_date || currentEvent?.date_time_summary);
  
  const startTimeStr = currentEvent?.start_datetime ? formatTime(currentEvent.start_datetime) : null;
  const endTimeStr = currentEvent?.end_datetime ? formatTime(currentEvent.end_datetime) : null;
  const durationStr = calculateDuration(currentEvent?.start_datetime, currentEvent?.end_datetime);
  
  let timeValue: string | React.ReactNode = 'Details not fully loaded';
  if (startTimeStr) {
    timeValue = startTimeStr;
    if (endTimeStr) {
      timeValue += ` - ${endTimeStr}`;
    }
    if (durationStr) {
      // Display duration on a new line for clarity if both start and end times are present
      timeValue = (
        <>
          {timeValue}
          <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">{durationStr}</span>
        </>
      );
    }
  }


  const displayLocationStr = currentEvent?.address || currentEvent?.specific_location_name || currentEvent?.list_specific_location;
  const displayPriceStr = currentEvent?.price || currentEvent?.list_price;
  const displayDescriptionStr = currentEvent?.full_description || currentEvent?.short_description || 'No description available.';
  const hasCoordinates = typeof currentEvent?.latitude === 'number' && typeof currentEvent?.longitude === 'number';


  return (
    <div 
      className={`fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-6
                  ${isVisible ? 'pointer-events-auto' : 'pointer-events-none'}`}
      onClick={handleClose}
    >
      <div 
        className={`absolute inset-0 bg-black/60 dark:bg-black/75 backdrop-blur-md
                    transition-opacity duration-300 ease-in-out
                    ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      ></div>

      <div 
        className={`relative bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden
                    transition-all duration-300 ease-in-out
                    ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 sm:p-5 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-gray-100 truncate pr-8">
            {currentEvent?.title || 'Event Details'}
          </h2>
          <button 
            onClick={handleClose} 
            className="p-1.5 rounded-full text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-slate-700 transition-colors"
            aria-label="Close event details"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-grow p-5 sm:p-6 space-y-5 sm:space-y-6">
          {currentEvent?.image_url && (
            <div className="aspect-[16/9] sm:aspect-[2/1] w-full overflow-hidden rounded-lg shadow-md mb-4">
              <img 
                src={currentEvent.image_url} 
                alt={currentEvent.title} 
                className="w-full h-full object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
            <InfoItem icon={<CalendarIcon />} label="Date" value={displayDateStr} />
            <InfoItem icon={<ClockIcon />} label="Time" value={timeValue} />
            {displayLocationStr && <InfoItem icon={<PinIcon />} label="Location" value={displayLocationStr} className="sm:col-span-2"/>}
            {displayPriceStr && <InfoItem icon={<EuroIcon />} label="Price" value={displayPriceStr} />}
          </div>

          {displayDescriptionStr && displayDescriptionStr !== 'No description available.' && (
            <div className="pt-1">
              <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Description</h4>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                {displayDescriptionStr}
              </p>
            </div>
          )}

          {hasCoordinates && currentEvent && (
            <div className="pt-1">
              <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Location Map</h4>
              <MiniMap 
                key={`${currentEvent.id}-overlaymap-${theme}`}
                center={[currentEvent.latitude!, currentEvent.longitude!]} 
                zoom={15}
                className="h-56 sm:h-64 rounded-lg shadow-sm" // Slightly softer shadow for map
                theme={theme}
              />
            </div>
          )}
        </div>
        
        <div className="p-4 sm:p-5 border-t border-gray-200 dark:border-slate-700">
          <div className="flex flex-col sm:flex-row space-y-2.5 sm:space-y-0 sm:space-x-3">
            <button 
              onClick={() => currentEvent && handleAddToCalendar(currentEvent)}
              disabled={!currentEvent?.start_datetime}
              className="flex-1 py-2.5 px-5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Add to Calendar
            </button>
            {currentEvent?.full_url && (
              <button 
                onClick={() => currentEvent && openEventUrl(currentEvent.full_url)}
                className="flex-1 py-2.5 px-5 rounded-lg text-sm font-semibold bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-slate-600 dark:hover:bg-slate-500 dark:text-gray-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800"
              >
                More Info
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDetailOverlay;