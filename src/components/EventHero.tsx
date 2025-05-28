// src/components/EventHero.tsx
import React from 'react';
import { XMarkIcon } from './Icons'; // Assuming XMarkIcon is in Icons.tsx

interface EventHeroProps {
  title?: string;
  imageUrl?: string;
  shortDescription?: string;
  onClose: () => void;
  currentHeroHeight: number; // For dynamic height
  // Optional: add blur style if needed
  // heroStyle?: React.CSSProperties; 
}

const EventHero: React.FC<EventHeroProps> = ({ title, imageUrl, shortDescription, onClose, currentHeroHeight }) => {
  const heroImagePlaceholder = (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-300 dark:bg-slate-700">
      <svg className="w-16 h-16 text-gray-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>
  );
  
  return (
    <div 
      className="relative w-full flex-shrink-0 overflow-hidden transition-height duration-100 ease-out" // Added transition for height
      style={{ height: `${currentHeroHeight}px` }}
    >
      {imageUrl ? (
        <img 
          src={imageUrl} 
          alt={title || 'Event image'} 
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => { 
            const target = e.currentTarget;
            target.style.display = 'none';
            const placeholderContainer = target.parentElement?.querySelector('.placeholder-container');
            if (placeholderContainer) placeholderContainer.classList.remove('hidden');
          }}
        />
      ) : heroImagePlaceholder }
      <div className={`placeholder-container ${imageUrl ? 'hidden': ''}`}>{heroImagePlaceholder}</div>

      <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
      
      {/* Adjusted bottom padding for title section */}
      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 md:pb-6 md:px-6 text-white z-10">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 drop-shadow-lg">
          {title || 'Event Details'}
        </h1>
        {(shortDescription && shortDescription.length < 100) && (
          <p className="text-xs sm:text-sm opacity-90 line-clamp-2 drop-shadow-md">
            {shortDescription}
          </p>
        )}
      </div>
      <button 
        onClick={onClose} 
        className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
        aria-label="Close"
      >
        <XMarkIcon className="w-5 h-5" />
      </button>
    </div>
  );
};

export default EventHero;