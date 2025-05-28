import React from 'react';
import { EventData } from '../types';
import { MapPinIcon } from './Icons'; // Assuming you have a simple pin icon

interface CustomEventMapMarkerProps {
  event: EventData;
  theme: 'light' | 'dark';
}

const CustomEventMapMarker: React.FC<CustomEventMapMarkerProps> = ({ event, theme }) => {
  const imagePlaceholderSvg =
    "data:image/svg+xml;charset=UTF-8,%3Csvg width='32' height='32' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='32' height='32' fill='%23E5E7EB'/%3E%3Cpath d='M10 12h12M10 16h12M10 20h8' stroke='%23A0AEC0' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E";
  const darkImagePlaceholderSvg =
    "data:image/svg+xml;charset=UTF-8,%3Csvg width='32' height='32' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='32' height='32' fill='%23374151'/%3E%3Cpath d='M10 12h12M10 16h12M10 20h8' stroke='%236B7280' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E";

  const currentPlaceholder = theme === 'dark' ? darkImagePlaceholderSvg : imagePlaceholderSvg;

  return (
    <div className={`custom-event-marker flex items-center p-1.5 rounded-lg shadow-md border
                     ${theme === 'dark' 
                        ? 'bg-neutral-800 border-neutral-700 text-gray-200' 
                        : 'bg-white border-gray-300 text-gray-700'}`
                   }
         style={{ minWidth: '100px', maxWidth: '180px' }} // Adjust as needed
    >
      {event.image_url ? (
        <img
          src={event.image_url}
          alt="" // Alt text not crucial for tiny marker image
          className="w-8 h-8 object-cover rounded-md mr-2 flex-shrink-0"
          onError={(e) => {
            const target = e.currentTarget;
            target.onerror = null;
            target.src = currentPlaceholder;
          }}
        />
      ) : (
        <img src={currentPlaceholder} alt="" className="w-8 h-8 object-cover rounded-md mr-2 flex-shrink-0" />
      )}
      <div className="text-xs font-medium truncate leading-tight">
        {event.title || 'Event'}
      </div>
    </div>
  );
};

export default CustomEventMapMarker;