// src/utils/dateUtils.ts (New File)
export const getRelativeDateInfo = (dateStr?: string): string | undefined => {
  if (!dateStr) return undefined;
  try {
    const eventDate = new Date(dateStr.replace(' ', 'T'));
    if (isNaN(eventDate.getTime())) return undefined;

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const eventDateStart = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());

    const diffTime = eventDateStart.getTime() - todayStart.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays === -1) return "Yesterday";

    // Basic "This weekend" - if event is Sat/Sun and is within the current week's upcoming days
    const eventDayOfWeek = eventDate.getDay(); // 0 = Sunday, 6 = Saturday
    if ((eventDayOfWeek === 0 || eventDayOfWeek === 6) && diffDays > 1 && diffDays < 7) {
      // Check if it falls within the current conceptual "week ahead" leading to a weekend
      // This is still a simplification
      return "This weekend";
    }

    if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
    // For more distant dates, we might not want a relative string, or just the weekday
    // if (diffDays > 7) return `On ${eventDate.toLocaleDateString(undefined, { weekday: 'long' })}`;
    
    return undefined; // Fallback if no simple relative term applies
  } catch (e) {
    console.error("Error in getRelativeDateInfo:", e);
    return undefined;
  }
};