// src/components/EventActionsFooter.tsx
import React from 'react';
import { EventData } from '../types';

interface EventActionsFooterProps {
  currentEvent: EventData | null; // Can be null if parent's event is null
  handleAddToCalendar: (event: EventData) => Promise<void>;
  openEventUrl: (url?: string) => Promise<void>;
}

const EventActionsFooter: React.FC<EventActionsFooterProps> = ({ currentEvent, handleAddToCalendar, openEventUrl }) => {
  if (!currentEvent) return null; // Don't render if no event

  return (
    <div className="p-4 sm:p-5 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-shrink-0">
      <div className="flex flex-col sm:flex-row space-y-2.5 sm:space-y-0 sm:space-x-3">
        {currentEvent.full_url ? (
            <button 
                onClick={() => openEventUrl(currentEvent.full_url)}
                className="flex-1 py-2.5 px-5 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800"
            >
                More Info
            </button>
        ) : (
            <button 
                onClick={() => handleAddToCalendar(currentEvent)}
                disabled={!currentEvent.start_datetime}
                className="flex-1 py-2.5 px-5 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
            >
                Add to Calendar
            </button>
        )}
        
        {currentEvent.full_url && (
            <button 
            onClick={() => handleAddToCalendar(currentEvent)}
            disabled={!currentEvent.start_datetime}
            className="flex-1 py-2.5 px-5 rounded-lg text-sm font-semibold border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
            >
            Add to Calendar
            </button>
        )}
      </div>
    </div>
  );
};
export default EventActionsFooter;