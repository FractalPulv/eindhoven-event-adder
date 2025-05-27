// src-tauri/src/lib.rs
mod models; // Our data structures
mod scraper; // Our scraping logic
// mod geocoder; // Will add later
// mod ics_generator; // Will add later

use models::Event; // Bring Event into scope for command signature

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize the logger
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            greet, // Keep the example greet command for now
            fetch_events_rust,
            generate_ics_rust
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// --- Event Commands ---

#[tauri::command]
async fn fetch_events_rust() -> Result<Vec<Event>, String> {
    log::info!("fetch_events_rust command invoked");
    match tauri::async_runtime::spawn_blocking(|| {
        scraper::get_all_events_with_details()
            .map_err(|e| e.to_string()) // Convert Box<dyn Error> to String here
    }).await {
        Ok(Ok(events)) => { // Outer Ok is JoinHandle, inner Ok is from your Result
            log::info!("Successfully fetched {} events.", events.len());
            Ok(events)
        },
        Ok(Err(e_str)) => { // Error is now a String
            log::error!("Error fetching events from scraper: {}", e_str);
            Err(format!("Scraper error: {}", e_str))
        },
        Err(join_error) => { // JoinError if spawn_blocking panics
            log::error!("Task panic while fetching events: {}", join_error);
            Err(format!("Task panic: {}", join_error.to_string()))
        }
    }
}

#[tauri::command]
async fn generate_ics_rust(event_data: Event) -> Result<String, String> {
    log::info!("generate_ics_rust command invoked for event: {}", event_data.title);
    // TODO: Implement actual ICS generation using a Rust crate (e.g., `ics`)
    // For now, return a placeholder or the event title
    
    // Example using the `ics` crate (add `ics = "0.5"` to Cargo.toml)
    // use ics::{ICalendar, Event as IcsEvent, Property};
    // use chrono::{Utc, TimeZone}; // For converting NaiveDateTime

    // let mut calendar = ICalendar::new("2.0", "eindhoven-event-app");
    // let mut ics_event = IcsEvent::new(uuid::Uuid::new_v4().to_string(), chrono::Utc::now().to_rfc3339());

    // ics_event.push(Property::new("SUMMARY", &event_data.title));
    // if let Some(start_dt_naive) = event_data.start_datetime {
    //     // Assuming NaiveDateTime is local time, convert to UTC for ICS or handle as floating
    //     // For simplicity, let's treat it as floating for now if the `ics` crate supports it
    //     // Or, convert to UTC: let start_dt_utc = Utc.from_local_datetime(&start_dt_naive).single();
    //     ics_event.push(Property::new("DTSTART", &start_dt_naive.format("%Y%m%dT%H%M%S").to_string()));
    // }
    // if let Some(end_dt_naive) = event_data.end_datetime {
    //     ics_event.push(Property::new("DTEND", &end_dt_naive.format("%Y%m%dT%H%M%S").to_string()));
    // }
    // if let Some(loc) = &event_data.address {
    //     ics_event.push(Property::new("LOCATION", loc));
    // }
    // let mut description_parts: Vec<String> = Vec::new();
    // if let Some(desc) = &event_data.full_description { description_parts.push(desc.clone()); }
    // else if let Some(s_desc) = &event_data.short_description { description_parts.push(s_desc.clone()); }
    // if let Some(price) = &event_data.price { description_parts.push(format!("Price: {}", price)); }
    // if let Some(url) = &event_data.full_url { 
    //     description_parts.push(format!("More Info: {}", url));
    //     ics_event.push(Property::new("URL", url));
    // }
    // if !description_parts.is_empty() {
    //     ics_event.push(Property::new("DESCRIPTION", &description_parts.join("\n\n")));
    // }
    // calendar.add_event(ics_event);
    // Ok(calendar.to_string())

    // Placeholder:
    Ok(format!("BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Eindhoven Event App//EN\nBEGIN:VEVENT\nUID:{}\nDTSTAMP:{}\nSUMMARY:{}\nDESCRIPTION:Details about {}\nDTSTART:20240101T120000Z\nLOCATION:{}\nEND:VEVENT\nEND:VCALENDAR",
        event_data.id,
        chrono::Utc::now().format("%Y%m%dT%H%M%SZ"),
        event_data.title,
        event_data.title,
        event_data.address.as_deref().unwrap_or("Eindhoven")
    ))
}