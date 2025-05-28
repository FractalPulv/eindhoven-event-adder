// src/components/EventInfoGrid.tsx
import React from 'react';
import { CalendarIcon, ClockIcon, PinIcon, EuroIcon } from './Icons';

interface InfoRowItemProps {
  icon: React.ReactNode;
  mainText: string | React.ReactNode;
  subText?: string | React.ReactNode;
  className?: string;
}
const InfoRowItem: React.FC<InfoRowItemProps> = ({ icon, mainText, subText, className }) => {
  if (!mainText || mainText === 'N/A') return null;
  return (
    <div className={`flex items-start space-x-3 ${className}`}>
      <div className="flex-shrink-0 w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-1 opacity-80">{icon}</div>
      <div className="flex-grow">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{mainText}</p>
        {subText && <p className="text-xs text-gray-500 dark:text-gray-400">{subText}</p>}
      </div>
    </div>
  );
};

interface EventInfoGridProps {
  dateMainText: string | React.ReactNode;
  dateSubText?: string | React.ReactNode;
  timeMainText: string | React.ReactNode;
  timeSubText?: string | React.ReactNode;
  locationMainText: string | React.ReactNode;
  locationSubText?: string | React.ReactNode;
  priceMainText: string | React.ReactNode;
}

const EventInfoGrid: React.FC<EventInfoGridProps> = (props) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
      <InfoRowItem icon={<CalendarIcon />} mainText={props.dateMainText} subText={props.dateSubText} />
      <InfoRowItem icon={<ClockIcon />} mainText={props.timeMainText} subText={props.timeSubText} />
      <InfoRowItem icon={<PinIcon />} mainText={props.locationMainText} subText={props.locationSubText} />
      <InfoRowItem icon={<EuroIcon />} mainText={props.priceMainText} subText="Price" className="text-indigo-600 dark:text-indigo-400" />
    </div>
  );
};

export default EventInfoGrid;