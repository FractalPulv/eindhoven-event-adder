// File: src-tauri/src/lib.rs
mod models;
mod scraper; // This now refers to src/scraper/mod.rs

use models::Event;
use reqwest::blocking::Client;
use std::time::Duration;

// Define your app-specific user agent for scraping event pages here
const APP_USER_AGENT_FOR_SCRAPING: &str = "EindhovenEventViewer/0.1 (your-app-contact@example.com)";


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            fetch_events_rust,
            fetch_specific_event_details_rust,
            generate_ics_rust 
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn fetch_events_rust() -> Result<Vec<Event>, String> {
    log::info!("fetch_events_rust (summaries) command invoked");
    match tauri::async_runtime::spawn_blocking(|| {
        let client_builder = Client::builder()
            .user_agent(APP_USER_AGENT_FOR_SCRAPING) // Use the defined constant
            .timeout(Duration::from_secs(15));
        
        match client_builder.build() {
            Ok(client) => scraper::fetch_event_list_summaries(&client) // This call should still work
                            .map_err(|e| e.to_string()),
            Err(e) => Err(format!("Failed to build HTTP client: {}", e.to_string())),
        }
    }).await {
        Ok(Ok(events)) => { log::info!("Successfully fetched {} event summaries.", events.len()); Ok(events) },
        Ok(Err(e_str)) => { log::error!("Error fetching event summaries: {}", e_str); Err(format!("Scraper error (summaries): {}", e_str)) },
        Err(join_error) => { log::error!("Task panic while fetching event summaries: {}", join_error); Err(format!("Task panic (summaries): {}", join_error.to_string())) }
    }
}

#[tauri::command]
async fn fetch_specific_event_details_rust(event_summary: Event) -> Result<Event, String> {
    log::info!("fetch_specific_event_details_rust command invoked for event ID: {}", event_summary.id);
    if event_summary.full_url.is_none() { return Err(format!("Event '{}' has no URL for fetching details.", event_summary.title)); }

    match tauri::async_runtime::spawn_blocking(move || {
        let client_builder = Client::builder()
            .user_agent(APP_USER_AGENT_FOR_SCRAPING) // Use the defined constant
            .timeout(Duration::from_secs(15));
        
        match client_builder.build() {
            Ok(client) => {
                scraper::fetch_event_details(&client, event_summary) // This call should still work
                    .map_err(|e| e.to_string())
            }
            Err(e) => Err(format!("Failed to build HTTP client: {}", e.to_string())),
        }
    }).await {
        Ok(Ok(detailed_event)) => { log::info!("Successfully fetched details for event ID: {}", detailed_event.id); Ok(detailed_event) },
        Ok(Err(e_str)) => { log::error!("Error fetching specific event details: {}", e_str); Err(format!("Scraper error (details): {}", e_str)) },
        Err(join_error) => { log::error!("Task panic while fetching specific event details: {}", join_error); Err(format!("Task panic (details): {}", join_error.to_string())) }
    }
}

// generate_ics_rust remains the same
// ... (paste generate_ics_rust here)
#[tauri::command]
async fn generate_ics_rust(event_data: Event) -> Result<String, String> {
    log::info!("generate_ics_rust command invoked for event: {}", event_data.title);
    let start_time_str = event_data.start_datetime
        .map(|dt| dt.format("%Y%m%dT%H%M%S").to_string() + "Z") 
        .unwrap_or_else(|| chrono::Utc::now().format("%Y%m%dT%H%M%SZ").to_string()); 

    Ok(format!(
        "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Eindhoven Event App//EN\nBEGIN:VEVENT\nUID:{}\nDTSTAMP:{}\nSUMMARY:{}\nDESCRIPTION:Details about {}\\nLocation: {}\\nPrice: {}\nDTSTART:{}\nLOCATION:{}\nEND:VEVENT\nEND:VCALENDAR",
        event_data.id,
        chrono::Utc::now().format("%Y%m%dT%H%M%SZ"),
        event_data.title,
        event_data.full_description.as_deref().unwrap_or_else(|| event_data.short_description.as_deref().unwrap_or("N/A")),
        event_data.address.as_deref().unwrap_or("Eindhoven"),
        event_data.price.as_deref().unwrap_or("N/A"),
        start_time_str, 
        event_data.address.as_deref().unwrap_or("Eindhoven")
    ))
}