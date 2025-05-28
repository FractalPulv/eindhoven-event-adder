// src/components/EventActionsFooter.tsx
import React from 'react';
import { EventData } from '../types';

interface EventActionsFooterProps {
  currentEvent: EventData | null;
  handleAddToCalendar: (event: EventData) => Promise<void>;
  openExternalUrl: (url?: string) => Promise<void>;
}

const EventActionsFooter: React.FC<EventActionsFooterProps> = ({ currentEvent, handleAddToCalendar, openExternalUrl }) => {
  if (!currentEvent) return null;

  // This condition correctly determines if the "Buy Tickets" button should appear.
  const hasTicketUrl = currentEvent.ticket_url && currentEvent.ticket_url.trim() !== "";
  const hasOriginalPageUrl = currentEvent.full_url && currentEvent.full_url.trim() !== "";

  return (
    <div className="p-4 sm:p-5 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-shrink-0">
      <div className="flex flex-col space-y-2.5 sm:grid sm:gap-3 sm:space-y-0" 
           style={{ gridTemplateColumns: `repeat(${[hasTicketUrl, hasOriginalPageUrl].filter(Boolean).length + 1}, minmax(0, 1fr))` }} // Dynamic columns
      > 
        {/* Buy Tickets Button (Primary if exists) */}
        {hasTicketUrl && ( // This is the key condition
          <button 
              onClick={() => openExternalUrl(currentEvent.ticket_url)}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800"
          >
              Buy Tickets
          </button>
        )}

        {/* Add to Calendar Button */}
        <button 
          onClick={() => handleAddToCalendar(currentEvent)}
          disabled={!currentEvent.start_datetime}
          className={`w-full py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 disabled:opacity-60 disabled:cursor-not-allowed
                      ${!hasTicketUrl 
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white focus-visible:ring-indigo-500' 
                        : 'border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 focus-visible:ring-indigo-500'
                      }`}
        >
          Add to Calendar
        </button>

        {/* Open Original Page Button */}
        {hasOriginalPageUrl && (
           <button 
              onClick={() => openExternalUrl(currentEvent.full_url)}
              className={`w-full py-2.5 px-4 rounded-lg text-sm font-semibold border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800`}
          >
              Open Original Page
          </button>
        )}
      </div>
    </div>
  );
};
export default EventActionsFooter;