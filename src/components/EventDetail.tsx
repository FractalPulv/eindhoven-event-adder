import React from 'react';
import { EventData } from '../types';

interface EventDetailProps {
  event: EventData | null;
  handleAddToCalendar: (event: EventData) => Promise<void>;
  openEventUrl: (url?: string) => Promise<void>;
}

const EventDetail: React.FC<EventDetailProps> = ({ event, handleAddToCalendar, openEventUrl }) => {
  if (!event) return null;

  return (
    <div className="p-4 bg-white dark:bg-slate-900 shadow-md overflow-y-auto h-1/3 md:h-auto md:max-h-1/3">
      <h3 className="text-xl font-bold mb-2 text-gray-800 dark:text-gray-100">{event.title}</h3>
      {event.image_url && 
        <img 
            src={event.image_url} 
            alt={event.title} 
            className="my-2 rounded-lg w-full max-w-md mx-auto h-48 object-cover"
            onError={(e) => (e.currentTarget.style.display = 'none')}
        />}
      <p className="dark:text-gray-300"><strong>Date:</strong> {event.date_time_summary || event.list_date || event.start_datetime?.substring(0,10)}</p>
      <p className="dark:text-gray-300">
        <strong>Time:</strong> {event.start_datetime ? new Date(event.start_datetime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'N/A'}
        {event.end_datetime && ` - ${new Date(event.end_datetime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`}
      </p>
      <p className="dark:text-gray-300"><strong>Location:</strong> {event.address || event.specific_location_name || event.list_specific_location}</p>
      <p className="dark:text-gray-300"><strong>Price:</strong> {event.price || event.list_price || 'N/A'}</p>
      <p className="mt-2 dark:text-gray-300"><strong>Description:</strong> {event.full_description || event.short_description || 'N/A'}</p>
      <div className="mt-4">
        <button onClick={() => handleAddToCalendar(event)} className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded mr-2">
          Add to Calendar
        </button>
        {event.full_url && 
          <button onClick={() => openEventUrl(event.full_url)} className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded">
            Visit Event Page
          </button>
        }
      </div>
    </div>
  );
};

export default EventDetail;