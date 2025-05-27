export interface EventData {
  id: string;
  title: string;
  url_suffix?: string;
  full_url?: string;
  date_time_summary?: string;
  list_date?: string;
  start_datetime?: string; 
  end_datetime?: string;   
  datetime_str_raw_detail?: string;
  short_description?: string;
  full_description?: string;
  image_url?: string;
  list_specific_location?: string;
  specific_location_name?: string; 
  address?: string;
  latitude?: number;
  longitude?: number;
  list_price?: string;
  price?: string;
}