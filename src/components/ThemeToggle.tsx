import React from 'react';
import { SunIcon, MoonIcon } from './Icons';

interface ThemeToggleProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, toggleTheme }) => {
  return (
    <button
      onClick={toggleTheme}
      className="fixed top-3.5 right-4 p-2 rounded-full bg-gray-200 dark:bg-neutral-800 text-gray-800 dark:text-gray-200 shadow-md hover:bg-gray-300 dark:hover:bg-neutral-700 transition-colors z-50" // Adjusted top to align with header text, and dark background
      aria-label="Toggle theme"
    >
      {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />} {/* Slightly smaller icon */}
    </button>
  );
};

export default ThemeToggle;