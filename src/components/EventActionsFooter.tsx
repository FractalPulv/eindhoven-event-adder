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

  const hasTicketUrl = currentEvent.ticket_url && currentEvent.ticket_url.trim() !== "";
  const hasOriginalPageUrl = currentEvent.full_url && currentEvent.full_url.trim() !== "";

  return (
    <div className="p-4 sm:p-5 border-t border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex-shrink-0"> {/* Updated dark bg and border */}
      <div className="flex flex-col space-y-2.5 sm:grid sm:gap-3 sm:space-y-0" 
           style={{ gridTemplateColumns: `repeat(${[hasTicketUrl, hasOriginalPageUrl].filter(Boolean).length + 1}, minmax(0, 1fr))` }}
      > 
        {hasTicketUrl && (
          <button 
              onClick={() => openExternalUrl(currentEvent.ticket_url)}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900" // Updated ring offset
          >
              Buy Tickets
          </button>
        )}

        <button 
          onClick={() => handleAddToCalendar(currentEvent)}
          disabled={!currentEvent.start_datetime}
          className={`w-full py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900 disabled:opacity-60 disabled:cursor-not-allowed // Updated ring offset
                      ${!hasTicketUrl 
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white focus-visible:ring-indigo-500' 
                        : 'border border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-800 focus-visible:ring-indigo-500' // Updated dark hover and border
                      }`}
        >
          Add to Calendar
        </button>

        {hasOriginalPageUrl && (
           <button 
              onClick={() => openExternalUrl(currentEvent.full_url)}
              className={`w-full py-2.5 px-4 rounded-lg text-sm font-semibold border border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900`} // Updated dark styles
          >
              Open Original Page
          </button>
        )}
      </div>
    </div>
  );
};
export default EventActionsFooter;