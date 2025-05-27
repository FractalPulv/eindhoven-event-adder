// File: src-tauri/src/scraper/mod.rs

// Declare the sub-modules within the `scraper` module
mod utils;
mod parsers;

// Re-export the functions that lib.rs (and thus Tauri commands) will call
pub use parsers::{fetch_event_list_summaries, fetch_event_details};

// Optionally, re-export the internal testing function if you want to call it from outside
// for some reason, though it's typically not needed for Tauri commands.
// pub use parsers::get_all_events_with_details_internal_testing;

// You can also define constants here if they are shared across sub-modules
// or if you want them to be part of the scraper module's public API.
// For now, they are in utils.rs and marked pub(super).