// File: src-tauri/src/lib.rs
mod models;
mod scraper; // This now refers to src/scraper/mod.rs
mod cache;

use models::{Event, ScrapingProgress};
use reqwest::blocking::Client;
use std::time::Duration;
use tauri::Emitter;

// Import chrono types for ICS generation
use chrono::{NaiveDateTime, TimeZone, Utc};
use chrono_tz::Tz;


// Define your app-specific user agent for scraping event pages here
const APP_USER_AGENT_FOR_SCRAPING: &str = "EindhovenEventViewer/0.1 (your-app-contact@example.com)";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            fetch_events_rust,
            fetch_specific_event_details_rust,
            generate_ics_rust // Ensure this is the function name you use
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn fetch_events_rust(window: tauri::Window, page_limit: Option<u32>, force_refresh: bool) -> Result<Vec<Event>, String> {
    log::info!("fetch_events_rust (summaries) command invoked with page_limit: {:?}, force_refresh: {}", page_limit, force_refresh);

    let progress_window = window.clone();
    let progress_callback = move |progress: models::ScrapingProgress| {
        let _ = progress_window.emit("scraping_progress", progress);
    };

    match tauri::async_runtime::spawn_blocking(move || {
        let client_builder = Client::builder()
            .user_agent(APP_USER_AGENT_FOR_SCRAPING) 
            .timeout(Duration::from_secs(15));

        match client_builder.build() {
            Ok(client) => {
                scraper::fetch_event_list_summaries(&client, page_limit, force_refresh, progress_callback)
                    .map_err(|e| e.to_string())
            }
            Err(e) => Err(format!("Failed to build HTTP client: {}", e.to_string())),
        }
    })
    .await
    {
        Ok(Ok(events)) => {
            log::info!("Successfully fetched {} event summaries.", events.len());
            Ok(events)
        }
        Ok(Err(e_str)) => {
            log::error!("Error fetching event summaries: {}", e_str);
            Err(format!("Scraper error (summaries): {}", e_str))
        }
        Err(join_error) => {
            log::error!("Task panic while fetching event summaries: {}", join_error);
            Err(format!(
                "Task panic (summaries): {}",
                join_error.to_string()
            ))
        }
    }
}

#[tauri::command]
async fn fetch_specific_event_details_rust(event_summary: Event) -> Result<Event, String> {
    log::info!(
        "fetch_specific_event_details_rust command invoked for event ID: {}",
        event_summary.id
    );
    if event_summary.full_url.is_none() {
        return Err(format!(
            "Event '{}' has no URL for fetching details.",
            event_summary.title
        ));
    }

    match tauri::async_runtime::spawn_blocking(move || {
        let client_builder = Client::builder()
            .user_agent(APP_USER_AGENT_FOR_SCRAPING)
            .timeout(Duration::from_secs(15));

        match client_builder.build() {
            Ok(client) => {
                scraper::fetch_event_details(&client, event_summary)
                    .map_err(|e| e.to_string())
            }
            Err(e) => Err(format!("Failed to build HTTP client: {}", e.to_string())),
        }
    })
    .await
    {
        Ok(Ok(detailed_event)) => {
            log::info!(
                "Successfully fetched details for event ID: {}",
                detailed_event.id
            );
            Ok(detailed_event)
        }
        Ok(Err(e_str)) => {
            log::error!("Error fetching specific event details: {}", e_str);
            Err(format!("Scraper error (details): {}", e_str))
        }
        Err(join_error) => {
            log::error!(
                "Task panic while fetching specific event details: {}",
                join_error
            );
            Err(format!("Task panic (details): {}", join_error.to_string()))
        }
    }
}


#[tauri::command]
async fn generate_ics_rust(event_data: Event) -> Result<String, String> {
    log::info!(
        "generate_ics_rust command invoked for event: {}",
        event_data.title
    );

    let dtstamp = Utc::now().format("%Y%m%dT%H%M%SZ").to_string();

    let eindhoven_tz: Tz = match "Europe/Amsterdam".parse() {
        Ok(tz) => tz,
        Err(_) => {
            log::error!("Critical error: Failed to parse timezone 'Europe/Amsterdam'.");
            return Err("Internal error: Timezone configuration failed.".to_string());
        }
    };

    let format_datetime_to_utc_ics = |naive_dt: NaiveDateTime, tz: Tz| -> Result<String, String> {
        match tz.from_local_datetime(&naive_dt).latest() { 
            Some(local_dt) => {
                let utc_dt = local_dt.with_timezone(&Utc);
                Ok(utc_dt.format("%Y%m%dT%H%M%SZ").to_string())
            }
            None => {
                Err(format!("Could not interpret date/time '{:?}' in the event's local timezone ({}). This might happen for invalid or non-existent local times.", naive_dt, tz.name()))
            }
        }
    };
    
    let start_datetime_str = match event_data.start_datetime {
        Some(dt) => format_datetime_to_utc_ics(dt, eindhoven_tz)?,
        None => {
            let err_msg = format!(
                "Event '{}' is missing a precise start date/time, cannot generate ICS.",
                event_data.title
            );
            log::error!("{}", err_msg);
            return Err(err_msg);
        }
    };

    let escape_ics_text = |text: &str| {
        text.replace("\\", "\\\\")
            .replace(";", "\\;")
            .replace(",", "\\,")
            .replace("\r\n", "\n") 
            .replace("\n", "\\n")
    };

    let mut ics_event_lines: Vec<String> = Vec::new();
    ics_event_lines.push(format!("UID:{}", escape_ics_text(&event_data.id)));
    ics_event_lines.push(format!("DTSTAMP:{}", dtstamp));
    ics_event_lines.push(format!("DTSTART:{}", start_datetime_str));

    if let Some(end_naive_dt) = event_data.end_datetime {
        if let Some(start_naive_dt) = event_data.start_datetime { 
            if end_naive_dt > start_naive_dt {
                match format_datetime_to_utc_ics(end_naive_dt, eindhoven_tz) {
                    Ok(end_dt_str) => ics_event_lines.push(format!("DTEND:{}", end_dt_str)),
                    Err(e) => log::warn!("Could not format end datetime for ICS for event '{}': {}. Omitting DTEND.", event_data.title, e),
                }
            } else {
                log::warn!("End datetime is not after start datetime for event '{}'. Omitting DTEND.", event_data.title);
            }
        }
    }
    
    ics_event_lines.push(format!("SUMMARY:{}", escape_ics_text(&event_data.title)));

    let location_display = event_data.address.as_deref()
        .or(event_data.specific_location_name.as_deref())
        .or(event_data.list_specific_location.as_deref())
        .unwrap_or("Eindhoven"); 
    
    if !location_display.is_empty() {
        ics_event_lines.push(format!("LOCATION:{}", escape_ics_text(location_display)));
    }
    
    // Event Page URL (Standard Property)
    if let Some(url) = event_data.full_url.as_deref() {
        let trimmed_url = url.trim();
        if !trimmed_url.is_empty() {
            ics_event_lines.push(format!("URL:{}", trimmed_url)); // URL should not be escaped like text
        }
    }

    // Ticket URL (Custom Property)
    if let Some(ticket_url) = event_data.ticket_url.as_deref() {
        let trimmed_ticket_url = ticket_url.trim();
        if !trimmed_ticket_url.is_empty() {
            // Using X- property for custom fields. Support varies.
            ics_event_lines.push(format!("X-TICKET-URL:{}", trimmed_ticket_url)); // URL should not be escaped
        }
    }

    // Build Description
    let mut description_parts: Vec<String> = Vec::new();
    if let Some(desc) = event_data.full_description.as_deref().or(event_data.short_description.as_deref()) {
        let trimmed_desc = desc.trim();
        if !trimmed_desc.is_empty() && trimmed_desc.to_lowercase() != "n/a" {
            description_parts.push(trimmed_desc.to_string());
        }
    }
    if let Some(price) = event_data.price.as_deref().or(event_data.list_price.as_deref()) {
        let trimmed_price = price.trim();
        if !trimmed_price.is_empty() && trimmed_price.to_lowercase() != "n/a" {
            description_parts.push(format!("Price: {}", trimmed_price));
        }
    }

    // Add URLs to description for guaranteed visibility
    if let Some(url) = event_data.full_url.as_deref() {
        let trimmed_url = url.trim();
        if !trimmed_url.is_empty() {
            description_parts.push(format!("More Info: {}", trimmed_url));
        }
    }
    if let Some(ticket_url) = event_data.ticket_url.as_deref() {
        let trimmed_ticket_url = ticket_url.trim();
        if !trimmed_ticket_url.is_empty() {
            description_parts.push(format!("Buy Tickets: {}", trimmed_ticket_url));
        }
    }

    if !description_parts.is_empty() {
        let full_description_text = description_parts.join("\n\n"); 
        ics_event_lines.push(format!("DESCRIPTION:{}", escape_ics_text(&full_description_text)));
    }


    let mut ics_content = String::new();
    ics_content.push_str("BEGIN:VCALENDAR\r\n");
    ics_content.push_str("VERSION:2.0\r\n");
    ics_content.push_str("PRODID:-//EindhovenEventViewer//NONSGML v1.0//EN\r\n");
    ics_content.push_str("CALSCALE:GREGORIAN\r\n");
    ics_content.push_str("BEGIN:VEVENT\r\n");
    for line in ics_event_lines {
        ics_content.push_str(&line);
        ics_content.push_str("\r\n");
    }
    ics_content.push_str("END:VEVENT\r\n");
    ics_content.push_str("END:VCALENDAR\r\n");

    Ok(ics_content)
}