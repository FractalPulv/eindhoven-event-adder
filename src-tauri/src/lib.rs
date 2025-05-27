// src-tauri/src/lib.rs
mod models;
mod scraper;

use models::Event;
use reqwest::blocking::Client; // For the new command
use std::time::Duration; // For client timeout

const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            fetch_events_rust, // Will now fetch summaries only
            fetch_specific_event_details_rust, // New command
            generate_ics_rust 
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// MODIFIED: Now fetches only summaries
#[tauri::command]
async fn fetch_events_rust() -> Result<Vec<Event>, String> {
    log::info!("fetch_events_rust (summaries) command invoked");
    match tauri::async_runtime::spawn_blocking(|| {
        // Create client here as it's short-lived for this specific task
        let client_builder = Client::builder()
            .user_agent(USER_AGENT)
            .timeout(Duration::from_secs(15));
        
        match client_builder.build() {
            Ok(client) => scraper::fetch_event_list_summaries(&client)
                            .map_err(|e| e.to_string()),
            Err(e) => Err(format!("Failed to build HTTP client: {}", e.to_string())),
        }
    }).await {
        Ok(Ok(events)) => {
            log::info!("Successfully fetched {} event summaries.", events.len());
            Ok(events)
        },
        Ok(Err(e_str)) => {
            log::error!("Error fetching event summaries: {}", e_str);
            Err(format!("Scraper error (summaries): {}", e_str))
        },
        Err(join_error) => {
            log::error!("Task panic while fetching event summaries: {}", join_error);
            Err(format!("Task panic (summaries): {}", join_error.to_string()))
        }
    }
}

// NEW COMMAND: Fetches details for a single event summary
#[tauri::command]
async fn fetch_specific_event_details_rust(event_summary: Event) -> Result<Event, String> {
    log::info!("fetch_specific_event_details_rust command invoked for event ID: {}", event_summary.id);
    
    if event_summary.full_url.is_none() {
        log::error!("Event summary ID '{}' has no full_url, cannot fetch details.", event_summary.id);
        return Err(format!("Event '{}' has no URL for fetching details.", event_summary.title));
    }

    match tauri::async_runtime::spawn_blocking(move || { // move event_summary into the closure
        let client_builder = Client::builder()
            .user_agent(USER_AGENT)
            .timeout(Duration::from_secs(15));
        
        match client_builder.build() {
            Ok(client) => {
                log::debug!("Fetching details for event: {}", event_summary.title);
                scraper::fetch_event_details(&client, event_summary) // event_summary is consumed here
                    .map_err(|e| {
                        log::error!("Error in scraper::fetch_event_details: {}", e.to_string());
                        e.to_string()
                    })
            }
            Err(e) => {
                log::error!("Failed to build HTTP client for detail fetch: {}", e.to_string());
                Err(format!("Failed to build HTTP client: {}", e.to_string()))
            }
        }
    }).await {
        Ok(Ok(detailed_event)) => {
            log::info!("Successfully fetched details for event ID: {}", detailed_event.id);
            Ok(detailed_event)
        },
        Ok(Err(e_str)) => {
            log::error!("Error fetching specific event details: {}", e_str);
            Err(format!("Scraper error (details): {}", e_str))
        },
        Err(join_error) => {
            log::error!("Task panic while fetching specific event details: {}", join_error);
            Err(format!("Task panic (details): {}", join_error.to_string()))
        }
    }
}


#[tauri::command]
async fn generate_ics_rust(event_data: Event) -> Result<String, String> {
    log::info!("generate_ics_rust command invoked for event: {}", event_data.title);
    // Placeholder ICS generation logic (ensure this uses event_data.start_datetime etc.)
    let start_time_str = event_data.start_datetime
        .map(|dt| dt.format("%Y%m%dT%H%M%S").to_string() + "Z") // Assume UTC for simple ICS
        .unwrap_or_else(|| chrono::Utc::now().format("%Y%m%dT%H%M%SZ").to_string()); // Fallback

    Ok(format!(
        "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Eindhoven Event App//EN\nBEGIN:VEVENT\nUID:{}\nDTSTAMP:{}\nSUMMARY:{}\nDESCRIPTION:Details about {}\\nLocation: {}\\nPrice: {}\nDTSTART:{}\nLOCATION:{}\nEND:VEVENT\nEND:VCALENDAR",
        event_data.id,
        chrono::Utc::now().format("%Y%m%dT%H%M%SZ"),
        event_data.title,
        event_data.full_description.as_deref().unwrap_or_else(|| event_data.short_description.as_deref().unwrap_or("N/A")),
        event_data.address.as_deref().unwrap_or("Eindhoven"),
        event_data.price.as_deref().unwrap_or("N/A"),
        start_time_str, // Use the parsed start time
        event_data.address.as_deref().unwrap_or("Eindhoven")
    ))
}