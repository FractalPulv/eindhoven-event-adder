import React, { useEffect, useRef, useState } from 'react';
import { RefreshCwIcon } from './Icons';

interface ScrapingOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  anchorEl: HTMLElement | null;
  pageLimit: number | undefined;
  onPageLimitChange: (limit: number | undefined) => void;
  onForceRefresh: () => void;
  isLoading: boolean;
  theme: 'light' | 'dark';
}

const ScrapingOverlay: React.FC<ScrapingOverlayProps> = ({
  isOpen,
  onClose,
  anchorEl,
  pageLimit,
  onPageLimitChange,
  onForceRefresh,
  isLoading,
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
      style={{ top: position.top, left: position.left, minWidth: '200px' }}
    >
      <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">Scraping Options</h3>

      <div className="flex items-center space-x-2 mb-4">
        <label htmlFor="page-limit" className="text-sm text-gray-700 dark:text-gray-300">Pages:</label>
        <input
          type="number"
          id="page-limit"
          min="1"
          value={pageLimit || ''}
          onChange={(e) => onPageLimitChange(e.target.value ? parseInt(e.target.value) : undefined)}
          className="w-16 px-2 py-1 rounded-md bg-gray-200 dark:bg-neutral-700 text-gray-700 dark:text-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          placeholder="All"
        />
      </div>

      <button
        onClick={onForceRefresh}
        disabled={isLoading}
        className="w-full px-3 py-2 rounded-md font-medium transition-all duration-200 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-800 bg-blue-600 hover:bg-blue-700 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? <RefreshCwIcon className="w-4 h-4 animate-spin inline-block mr-2" /> : null}
        Refresh Events
      </button>
    </div>
  );
};

export default ScrapingOverlay;