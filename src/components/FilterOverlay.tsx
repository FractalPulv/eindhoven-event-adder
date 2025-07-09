import React, { useState, useEffect, useRef } from 'react';

interface FilterOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  anchorEl: HTMLElement | null;
  minPrice: number;
  maxPrice: number;
  currentMinPrice: number;
  currentMaxPrice: number;
  onMinPriceChange: (price: number) => void;
  onMaxPriceChange: (price: number) => void;
  filterFreeEvents: boolean;
  onFilterFreeEventsChange: (checked: boolean) => void;
  theme: 'light' | 'dark';
}

const FilterOverlay: React.FC<FilterOverlayProps> = ({
  isOpen,
  onClose,
  anchorEl,
  minPrice,
  maxPrice,
  currentMinPrice,
  currentMaxPrice,
  onMinPriceChange,
  onMaxPriceChange,
  filterFreeEvents,
  onFilterFreeEventsChange,
  theme,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isOpen && anchorEl && overlayRef.current) {
      const anchorRect = anchorEl.getBoundingClientRect();
      const overlayRect = overlayRef.current.getBoundingClientRect();

      // Position the overlay below the anchor element, aligned to the right
      let top = anchorRect.bottom + 8; // 8px below the button
      let left = anchorRect.right - overlayRect.width; // Align right edges

      // Adjust if it goes off-screen to the left
      if (left < 0) {
        left = 0; // Align to left edge of viewport
      }

      // Adjust if it goes off-screen to the bottom
      if (top + overlayRect.height > window.innerHeight) {
        top = anchorRect.top - overlayRect.height - 8; // Position above the button
        if (top < 0) { // If still off-screen, just position at top
          top = 0;
        }
      }

      setPosition({ top, left });
    }
  }, [isOpen, anchorEl]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(event.target as Node) &&
          anchorEl && !anchorEl.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, anchorEl]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className={`absolute z-50 p-4 rounded-lg shadow-xl border 
                  ${theme === 'dark' ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-gray-200'}`}
      style={{ top: position.top, left: position.left, minWidth: '250px' }}
    >
      <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">Filter Events</h3>

      <div className="mb-4">
        <label htmlFor="price-range" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Price Range</label>
        <div className="relative mb-6">
          <input
            type="range"
            min={minPrice}
            max={currentMaxPrice} // Max of min slider is currentMaxPrice
            value={currentMinPrice}
            onChange={(e) => onMinPriceChange(Number(e.target.value))}
            className={`absolute w-full h-1 bg-gray-300 dark:bg-neutral-600 rounded-lg appearance-none cursor-pointer range-sm ${filterFreeEvents ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={{ zIndex: 5 }} // Min slider always on top
            disabled={filterFreeEvents}
          />
          <input
            type="range"
            min={currentMinPrice} // Min of max slider is currentMinPrice
            max={maxPrice}
            value={currentMaxPrice}
            onChange={(e) => onMaxPriceChange(Number(e.target.value))}
            className={`absolute w-full h-1 bg-gray-300 dark:bg-neutral-600 rounded-lg appearance-none cursor-pointer range-sm ${filterFreeEvents ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={{ zIndex: 4 }} // Max slider behind min
            disabled={filterFreeEvents}
          />
          <div
            className="absolute h-1 bg-blue-500 rounded-lg"
            style={{
              left: `${((currentMinPrice - minPrice) / (maxPrice - minPrice)) * 100}%`,
              right: `${100 - ((currentMaxPrice - minPrice) / (maxPrice - minPrice)) * 100}%`,
              zIndex: 3,
            }}
          ></div>
        </div>
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
          <span>€{currentMinPrice}</span>
          <span>€{currentMaxPrice}</span>
        </div>
      </div>

      <div className="flex items-center mb-4"> {/* Added mb-4 for spacing */}
        <input
          type="checkbox"
          id="filter-free-events"
          checked={filterFreeEvents}
          onChange={(e) => onFilterFreeEventsChange(e.target.checked)}
          className="mr-2 rounded text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400"
        />
        <label htmlFor="filter-free-events" className="text-sm text-gray-700 dark:text-gray-300">Show only free events</label>
      </div>
    </div>
  );
};

export default FilterOverlay;