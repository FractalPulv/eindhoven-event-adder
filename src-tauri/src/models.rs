use serde::{Serialize, Deserialize};
use chrono::{DateTime, NaiveDateTime, Utc}; // Using NaiveDateTime for parsing if timezone is unknown, then possibly Utc for storage/ICS

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Event {
    pub id: String, // Using url_suffix or a generated hash as ID
    pub title: String,
    pub url_suffix: Option<String>, // From list view, used to build full URL
    pub full_url: Option<String>,  // Full URL to the event page
    
    // Dates & Times
    pub date_time_summary: Option<String>, // e.g., "10 June", "10 - 12 June"
    pub list_date: Option<String>, // More specific date from list meta if available
    pub start_datetime: Option<NaiveDateTime>, // Parsed start datetime
    pub end_datetime: Option<NaiveDateTime>,   // Parsed end datetime
    pub datetime_str_raw_detail: Option<String>, // Raw date/time string from detail page

    // Descriptions
    pub short_description: Option<String>, // From list view
    pub full_description: Option<String>,  // From detail page

    pub image_url: Option<String>,
    
    // Location
    pub list_specific_location: Option<String>, // Location name from list view
    pub specific_location_name: Option<String>, // Venue name from detail page
    pub address: Option<String>,           // Full parsed address
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,

    // Price
    pub list_price: Option<String>, // Price from list view
    pub price: Option<String>,      // Price from detail page

    // Meta for internal use
    #[serde(skip_deserializing)] // Only used internally, not expected from frontend if sending event back
    pub detail_page_content: Option<String>, // To avoid re-fetching if passed around
}

impl Default for Event {
    fn default() -> Self {
        Event {
            id: uuid::Uuid::new_v4().to_string(), // Generate a unique ID by default
            title: "N/A".to_string(),
            url_suffix: None,
            full_url: None,
            date_time_summary: None,
            list_date: None,
            start_datetime: None,
            end_datetime: None,
            datetime_str_raw_detail: None,
            short_description: None,
            full_description: None,
            image_url: None,
            list_specific_location: None,
            specific_location_name: None,
            address: None,
            latitude: None,
            longitude: None,
            list_price: None,
            price: None,
            detail_page_content: None,
        }
    }
}
