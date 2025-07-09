// src-tauri/src/models.rs
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize}; // Removed Utc and DateTime as NaiveDateTime is primary for parsing/storage

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Event {
    pub id: String,
    pub title: String,
    pub url_suffix: Option<String>,
    pub full_url: Option<String>,

    pub date_time_summary: Option<String>,
    pub list_date: Option<String>,
    pub start_datetime: Option<NaiveDateTime>,
    pub end_datetime: Option<NaiveDateTime>,
    pub datetime_str_raw_detail: Option<String>,

    pub short_description: Option<String>,
    pub full_description: Option<String>,

    pub image_url: Option<String>,

    pub list_specific_location: Option<String>,
    pub specific_location_name: Option<String>,
    pub address: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,

    pub list_price: Option<String>,
    pub price: Option<String>,
    pub ticket_url: Option<String>, // <-- NEW FIELD

    #[serde(skip_deserializing)]
    pub detail_page_content: Option<String>,
}

impl Default for Event {
    fn default() -> Self {
        Event {
            id: uuid::Uuid::new_v4().to_string(),
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
            ticket_url: None, // <-- INITIALIZE NEW FIELD
            detail_page_content: None,
        }
    }
}

#[derive(Debug, Serialize, Clone)]
pub struct ScrapingProgress {
    pub current_page: u32,
    pub total_pages_estimate: u32,
    pub events_on_current_page: u32,
    pub total_events_scraped: u32,
    pub message: String,
}
