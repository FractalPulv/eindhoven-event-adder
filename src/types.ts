// File: src/types.ts
export interface EventData {
  id: string;
  title: string;
  url_suffix?: string;
  full_url?: string;
  date_time_summary?: string; // From list view, e.g. "10 June"
  list_date?: string;         // More specific date from list meta if available (e.g. "10 April 2025")
  
  // Detailed fields, populated after fetching details
  start_datetime?: string; // ISO 8601 string or similar from NaiveDateTime
  end_datetime?: string;   // ISO 8601 string or similar from NaiveDateTime
  datetime_str_raw_detail?: string; // Raw string from detail page, e.g. "Tuesday 28 May, 10:00 - 17:00"
  
  short_description?: string;
  full_description?: string;
  
  image_url?: string;
  
  list_specific_location?: string;
  specific_location_name?: string; 
  address?: string; // Detailed address with postal code
  
  latitude?: number;
  longitude?: number;
  
  list_price?: string;
  price?: string;

  isDetailed?: boolean; // New flag
}