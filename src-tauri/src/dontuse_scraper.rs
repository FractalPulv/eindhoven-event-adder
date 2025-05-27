// src-tauri/src/scraper.rs
use crate::models::Event;
use reqwest::blocking::Client;
use scraper::{ElementRef, Html, Selector};
use std::error::Error;
use url::Url; // For robust URL joining
use chrono::{NaiveDate, NaiveTime, NaiveDateTime, Datelike, Utc}; // Added Utc for current year
use regex::Regex; // Added regex
use geocoding::{Forward, Point}; // Point and Forward are still relevant
use geocoding::Nominatim;         // CORRECTED IMPORT FOR v0.4.0: Nominatim is at the root

const BASE_URL: &str = "https://www.thisiseindhoven.com";
const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";
const NOMINATIM_USER_AGENT: &str = "EindhovenEventViewer/0.1 (your-email@example.com; https://yourappdomain.com)"; // Be specific!

// --- Helper Functions ---
fn get_element_text(element_ref: &ElementRef) -> String {
    element_ref.text().collect::<String>().trim().to_string()
}

fn select_first_text(element: &ElementRef, selector_str: &str) -> Option<String> {
    Selector::parse(selector_str)
        .ok()
        .and_then(|selector| element.select(&selector).next())
        .map(|el_ref| get_element_text(&el_ref))
        .filter(|s| !s.is_empty())
}

// NEW/IMPROVED HELPER: Joins a (possibly relative) path with the base URL
fn make_absolute_url(base: &str, path: &str) -> Option<String> {
    if path.starts_with("http://") || path.starts_with("https://") {
        return Some(path.to_string());
    }
    if path.starts_with("//") { // Protocol-relative URL
        return Some(format!("https:{}", path));
    }
    // Use the url crate for robust joining
    Url::parse(base)
        .ok()
        .and_then(|base_url| base_url.join(path).ok())
        .map(|full_url| full_url.to_string())
}


// IMPROVED: Parses srcset and returns the best URL (e.g., largest or first)
// It also ensures the chosen URL is made absolute.
fn parse_image_url_from_srcset(srcset: &str, base_url_for_relative: &str) -> Option<String> {
    log::debug!("Parsing srcset: {}", srcset);
    let sources: Vec<&str> = srcset.split(',').map(|s| s.trim()).collect();
    let mut best_url: Option<String> = None;
    let mut max_width = 0;

    for src_entry in sources {
        let parts: Vec<&str> = src_entry.split_whitespace().collect();
        if parts.is_empty() {
            continue;
        }
        let url_part = parts[0];

        if parts.len() > 1 && parts[1].ends_with('w') {
            if let Ok(width) = parts[1].trim_end_matches('w').parse::<i32>() {
                if width > max_width {
                    max_width = width;
                    best_url = Some(url_part.to_string());
                }
            }
        } else if best_url.is_none() {
            // If no width descriptors, take the first one
            best_url = Some(url_part.to_string());
        }
    }

    if let Some(url) = best_url {
        log::debug!("Selected from srcset: {}", url);
        make_absolute_url(base_url_for_relative, &url)
    } else {
        log::warn!("Could not determine a best URL from srcset: {}", srcset);
        None
    }
}

// --- NEW: Date and Time Parsing Function ---
fn parse_event_datetimes(
    list_date_opt: Option<&str>,
    datetime_str_raw_detail_opt: Option<&str>,
) -> (Option<NaiveDateTime>, Option<NaiveDateTime>) {
    let current_year = Utc::now().year(); // Get current year for context
    log::debug!(
        "Attempting to parse datetimes with list_date: {:?}, detail_str: {:?}, current_year: {}",
        list_date_opt, datetime_str_raw_detail_opt, current_year
    );

    let mut final_date_str_base: Option<String> = None; // e.g. "28 May" or "1 April"
    let mut final_year_override: Option<i32> = None; // If year is explicitly in detail_str
    let mut start_time_str: Option<String> = None;
    let mut end_time_str: Option<String> = None;

    // Regex to capture:
    // Optional Day Name (e.g., "Tuesday ")
    // Date part like "28 May" or "1 April" (Group 1)
    // Optional Year (Group 2)
    // Optional comma separator
    // Optional "Starts at "
    // Start Time HH:MM (Group 3)
    // Optional " - "
    // Optional End Time HH:MM (Group 4)
    // (?i) makes it case-insensitive for day/month names if needed, though chrono handles month names.
    let detail_re = Regex::new(
        r"(?i)(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*\s+)?(\d{1,2}\s+\w+)(?:\s+(\d{4}))?(?:\s*,\s*)?(?:(?:Starts at\s+)?(\d{2}:\d{2}))?(?:\s*-\s*(\d{2}:\d{2}))?"
    ).unwrap();

    if let Some(detail_str) = datetime_str_raw_detail_opt {
        if let Some(caps) = detail_re.captures(detail_str) {
            log::debug!("Detail string '{}' matched regex. Captures: {:?}", detail_str, caps);
            if let Some(date_match) = caps.get(1) { // Group 1: Date (e.g., "28 May")
                final_date_str_base = Some(date_match.as_str().trim().to_string());
                log::debug!("Date base from detail regex: {}", final_date_str_base.as_ref().unwrap());
            }
            if let Some(year_match) = caps.get(2) { // Group 2: Year (e.g., "2025")
                if let Ok(year) = year_match.as_str().trim().parse::<i32>() {
                    final_year_override = Some(year);
                    log::debug!("Year override from detail regex: {}", year);
                }
            }
            if let Some(time_match) = caps.get(3) { // Group 3: Start time
                start_time_str = Some(time_match.as_str().trim().to_string());
                log::debug!("Start time from detail regex: {}", start_time_str.as_ref().unwrap());
            }
            if let Some(time_match) = caps.get(4) { // Group 4: End time
                end_time_str = Some(time_match.as_str().trim().to_string());
                log::debug!("End time from detail regex: {}", end_time_str.as_ref().unwrap());
            }
        } else {
            // If main regex doesn't match, detail_str might *only* be a time range e.g. "10:00 - 17:00"
            // This is less likely if datetime_str_raw_detail comes from "Day D Month, HH:MM" but good fallback
            let time_only_re = Regex::new(r"(\d{2}:\d{2})(?:\s*-\s*(\d{2}:\d{2}))?").unwrap();
            if let Some(time_caps) = time_only_re.captures(detail_str) {
                log::debug!("Detail string '{}' matched time-only regex. Captures: {:?}", detail_str, time_caps);
                if let Some(time_match) = time_caps.get(1) { start_time_str = Some(time_match.as_str().trim().to_string()); }
                if let Some(time_match) = time_caps.get(2) { end_time_str = Some(time_match.as_str().trim().to_string()); }
            } else {
                log::warn!("Detail string '{}' did not match any date/time regex.", detail_str);
            }
        }
    }

    // If date base was not extracted from detail_str, try to use list_date_opt
    if final_date_str_base.is_none() {
        if let Some(ld_str) = list_date_opt {
            // list_date_opt might be "DD Month" or "DD Month YYYY" or "DD Mon"
            // We need to extract the "DD Month" part and potentially a year.
            let list_date_re = Regex::new(r"(\d{1,2}\s+\w+)(?:\s+(\d{4}))?").unwrap();
            if let Some(list_caps) = list_date_re.captures(ld_str) {
                if let Some(date_match) = list_caps.get(1) {
                    final_date_str_base = Some(date_match.as_str().trim().to_string());
                    log::debug!("Using list_date for date base: {}", final_date_str_base.as_ref().unwrap());
                }
                if final_year_override.is_none() { // Only use year from list if not already found in detail
                    if let Some(year_match) = list_caps.get(2) {
                         if let Ok(year) = year_match.as_str().trim().parse::<i32>() {
                            final_year_override = Some(year);
                            log::debug!("Year override from list_date: {}", year);
                        }
                    }
                }
            } else {
                 log::warn!("List date string '{}' did not match expected format.", ld_str);
            }
        }
    }

    let year_to_use = final_year_override.unwrap_or(current_year);

    // --- Actual Parsing ---
    let mut parsed_start_datetime: Option<NaiveDateTime> = None;
    let mut parsed_end_datetime: Option<NaiveDateTime> = None;

    if let Some(date_base_val) = final_date_str_base {
        let date_with_year = format!("{} {}", date_base_val, year_to_use);
        log::debug!("Attempting to parse full date string: '{}'", date_with_year);

        // Try parsing with full month name, then abbreviated
        // Chrono's %B parses full month name (locale-dependent, usually English default)
        // %b parses abbreviated month name
        let date_formats = ["%d %B %Y", "%d %b %Y"];
        let mut naive_date_opt: Option<NaiveDate> = None;
        for fmt in &date_formats {
            if let Ok(parsed_date) = NaiveDate::parse_from_str(&date_with_year, fmt) {
                naive_date_opt = Some(parsed_date);
                log::debug!("Successfully parsed date '{}' with format '{}'", date_with_year, fmt);
                break;
            }
        }

        if let Some(naive_date) = naive_date_opt {
            if let Some(st_str) = start_time_str {
                if let Ok(naive_start_time) = NaiveTime::parse_from_str(&st_str, "%H:%M") {
                    parsed_start_datetime = Some(naive_date.and_time(naive_start_time));
                    log::debug!("Parsed start_datetime: {:?}", parsed_start_datetime);

                    if let Some(et_str) = end_time_str {
                        if let Ok(naive_end_time) = NaiveTime::parse_from_str(&et_str, "%H:%M") {
                            let mut end_date_to_use = naive_date;
                            // Handle overnight case: if end time is earlier than start time, assume it's the next day.
                            if naive_end_time < naive_start_time {
                                if let Some(next_day) = naive_date.succ_opt() {
                                    end_date_to_use = next_day;
                                    log::debug!("End time is earlier than start time, assuming next day: {}", end_date_to_use);
                                } else {
                                    log::warn!("Could not determine next day for overnight event.");
                                }
                            }
                            parsed_end_datetime = Some(end_date_to_use.and_time(naive_end_time));
                            log::debug!("Parsed end_datetime: {:?}", parsed_end_datetime);
                        } else { log::warn!("Failed to parse end time string: {}", et_str); }
                    }
                } else { log::warn!("Failed to parse start time string: {}", st_str); }
            } else { log::warn!("Start time string was None, though date was parsed."); }
        } else { log::warn!("Failed to parse date string component: '{}' with year {} using available formats", date_base_val, year_to_use); }
    } else { log::warn!("Final date string base was None. Cannot parse datetimes."); }

    (parsed_start_datetime, parsed_end_datetime)
}

// --- Geocoding Function for v0.4.0 ---
fn geocode_address(address: &str) -> Result<Option<Point<f64>>, Box<dyn Error>> {
    log::info!("Attempting to geocode address: {}", address);
    
    // For geocoding v0.4.0, use Nominatim from the provider module
    let geocoder = Nominatim::new(NOMINATIM_USER_AGENT);
    
    match geocoder.forward(address) {
        Ok(points) => {
            if let Some(point) = points.get(0) {
                log::info!("Geocoded '{}' to Lat: {}, Lon: {}", address, point.y(), point.x());
                Ok(Some(*point)) 
            } else {
                log::warn!("No geocoding results found for address: {}", address);
                Ok(None)
            }
        }
        Err(e) => {
            // The error type for geocoding 0.4.0 is geocoding::Error
            // Log it and return Ok(None) to not break the entire event fetching
            log::error!("Geocoding error for address '{}': {:?}", address, e);
            Ok(None) 
        }
    }
}

// --- Event List Scraping ---
pub fn fetch_event_list_summaries(client: &Client) -> Result<Vec<Event>, Box<dyn Error>> {
    log::info!("Fetching event list summaries from: {}/en/events", BASE_URL);
    let main_page_url = format!("{}/en/events", BASE_URL);
    // The client passed in from lib.rs should be configured with an app-specific User-Agent
    let response_text = client.get(&main_page_url).send()?.text()?;
    let document = Html::parse_document(&response_text);
    let card_selector = Selector::parse("a.result-card.result-card-generic").map_err(|e| format!("Failed to parse card_selector: {:?}", e))?;
    let mut events: Vec<Event> = Vec::new();
    for (index, card_element) in document.select(&card_selector).enumerate() {
        let mut event = Event::default();
        event.url_suffix = card_element.value().attr("href").map(str::to_string);
        if event.url_suffix.is_none() || !event.url_suffix.as_ref().unwrap().starts_with("/en/events/") { continue; }
        event.full_url = event.url_suffix.as_ref().map(|s| format!("{}{}", BASE_URL, s));
        event.id = event.url_suffix.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        let mut image_found_url: Option<String> = None;
        let picture_selector = Selector::parse("picture.result-card-generic__picture").map_err(|e| format!("Failed to parse picture_selector: {:?}", e))?;
        if let Some(picture_element) = card_element.select(&picture_selector).next() {
            let source_selector = Selector::parse("source[srcset]").map_err(|e| format!("Failed to parse source_selector: {:?}", e))?;
            for source_element in picture_element.select(&source_selector) { if let Some(srcset) = source_element.value().attr("srcset") { image_found_url = parse_image_url_from_srcset(srcset, BASE_URL); if image_found_url.is_some() { break; } } }
        }
        if image_found_url.is_none() {
            let img_selectors = ["img.result-card-generic__image", "img"];
            for img_selector_str in &img_selectors {
                let img_selector = Selector::parse(img_selector_str).map_err(|e| format!("Failed to parse img_selector: {:?}", e))?;
                if let Some(img_element) = card_element.select(&img_selector).next() {
                    if let Some(srcset) = img_element.value().attr("data-srcset").or_else(|| img_element.value().attr("srcset")) { image_found_url = parse_image_url_from_srcset(srcset, BASE_URL); }
                    else if let Some(src) = img_element.value().attr("src") { image_found_url = make_absolute_url(BASE_URL, src); }
                    if (event.title == "N/A" || event.title.is_empty()) { if let Some(alt_text) = img_element.value().attr("alt") { if !alt_text.trim().is_empty() { event.title = alt_text.trim().to_string(); } } }
                    if image_found_url.is_some() { break; } 
                }
            }
        }
        event.image_url = image_found_url;
        let content_selector = Selector::parse("div.result-card-generic__content").map_err(|e| format!("Failed to parse content_selector: {:?}", e))?;
        if let Some(content_div) = card_element.select(&content_selector).next() {
            if event.title == "N/A" || event.title.is_empty() { event.title = select_first_text(&content_div, "h3.result-card-generic__title").unwrap_or_else(|| "Title N/A".to_string()); }
            event.short_description = select_first_text(&content_div, "p");
            event.date_time_summary = select_first_text(&content_div, "span.tag > span");
            let meta_wrap_selector = Selector::parse("div.meta-labels-wrap").map_err(|e| format!("Failed to parse meta_wrap_selector: {:?}", e))?;
            if let Some(meta_wrap_div) = content_div.select(&meta_wrap_selector).next() {
                let meta_label_selector = Selector::parse("div.meta-label").map_err(|e| format!("Failed to parse meta_label_selector: {:?}", e))?;
                for meta_label_div in meta_wrap_div.select(&meta_label_selector) {
                    let text = get_element_text(&meta_label_div);
                    if Selector::parse("span.tie-icon-pin").ok().and_then(|s| meta_label_div.select(&s).next()).is_some() { event.list_specific_location = Some(text.clone()); }
                    else if Selector::parse("span.tie-icon-calendar").ok().and_then(|s| meta_label_div.select(&s).next()).is_some() { event.list_date = Some(text.clone()); if event.date_time_summary.is_none() { event.date_time_summary = Some(text.clone()); } }
                    else if Selector::parse("span.tie-icon-euro").ok().and_then(|s| meta_label_div.select(&s).next()).is_some() { event.list_price = Some(text.clone()); }
                }
            }
        }
        events.push(event);
    }
    Ok(events)
}

// --- Event Detail Scraping ---
pub fn fetch_event_details(client: &Client, mut event: Event) -> Result<Event, Box<dyn Error>> {
    let detail_url = event.full_url.as_ref().ok_or_else(|| "Missing full_url for detail fetching")?;
    log::info!("Fetching details for event '{}' from URL: {}", event.title, detail_url);
    // The client passed in from lib.rs should be configured with an app-specific User-Agent
    let response_text = client.get(detail_url).send()?.text()?;
    let document = Html::parse_document(&response_text);
    let content_container_selector = Selector::parse("div.card-hero-metadata__content").map_err(|e| format!("Failed to parse detail_container: {:?}", e))?;
    if let Some(content_container) = document.select(&content_container_selector).next() {
        if let Some(title) = select_first_text(&content_container, "h1") { event.title = title; }
        let text_div_selector = Selector::parse("div.text").map_err(|e| format!("Failed to parse text_div: {:?}", e))?;
        if let Some(text_div) = content_container.select(&text_div_selector).next() {
            event.full_description = select_first_text(&text_div, "p");
            let list_icons_selector = Selector::parse("ul.list-with-icons > li").map_err(|e| format!("Failed to parse list_icons: {:?}", e))?;
            for li_element in text_div.select(&list_icons_selector) {
                let text_content = li_element.children().filter_map(|node| node.value().as_text().map(|t| t.trim())).filter(|s| !s.is_empty()).collect::<Vec<&str>>().join(" ");
                if text_content.is_empty() { continue; }
                if Selector::parse("span.tie-icon-calendar").ok().and_then(|s| li_element.select(&s).next()).is_some() {
                    event.datetime_str_raw_detail = Some(text_content.clone());
                    let (start_dt, end_dt) = parse_event_datetimes(event.list_date.as_deref(), event.datetime_str_raw_detail.as_deref());
                    event.start_datetime = start_dt; event.end_datetime = end_dt;
                } else if Selector::parse("span.tie-icon-euro").ok().and_then(|s| li_element.select(&s).next()).is_some() { event.price = Some(text_content.clone()); }
                else if Selector::parse("span.tie-icon-pin").ok().and_then(|s| li_element.select(&s).next()).is_some() { event.specific_location_name = Some(text_content.clone()); }
            }
        }
        let address_block_selector = Selector::parse("div[itemprop='address'][itemtype='https://schema.org/PostalAddress']").map_err(|e| format!("Failed to parse address_block: {:?}", e))?;
        if let Some(address_block) = document.select(&address_block_selector).next() {
            let street = select_first_text(&address_block, "span[itemprop='streetAddress']");
            let postal_code = select_first_text(&address_block, "span[itemprop='postalCode']");
            let locality = select_first_text(&address_block, "span[itemprop='addressLocality']");
            let mut address_parts: Vec<String> = Vec::new();
            if let Some(loc_name) = &event.specific_location_name { address_parts.push(loc_name.clone()); } else if let Some(list_loc) = &event.list_specific_location { address_parts.push(list_loc.clone());}
            if let Some(s) = street { if !address_parts.contains(&s) { address_parts.push(s); } }
            if let Some(pc) = postal_code { address_parts.push(pc); }
            if let Some(l) = locality { address_parts.push(l); }
            if !address_parts.is_empty() {
                let full_address = address_parts.join(", ");
                event.address = Some(full_address);
                if let Some(ref addr_to_geocode) = event.address {
                    match geocode_address(addr_to_geocode) { // geocode_address is called here
                        Ok(Some(point)) => { event.latitude = Some(point.y()); event.longitude = Some(point.x());}
                        Ok(None) => { log::warn!("Geocoding returned no results for: {}", addr_to_geocode); }
                        Err(e) => { log::error!("Error geocoding '{}': {}", addr_to_geocode, e); }
                    }
                }
                // Delay for Nominatim rate limiting
                std::thread::sleep(std::time::Duration::from_millis(1100)); 
            }
        }
    }
    Ok(event)
}


// --- Orchestration ---
// THIS FUNCTION IS NO LONGER THE PRIMARY WAY TO GET ALL DATA AT ONCE FOR THE FRONTEND
// IT CAN BE USED INTERNALLY OR FOR TESTING, BUT `fetch_events_rust` (for summaries)
// and `fetch_specific_event_details_rust` (for single event details) WILL BE THE TAURI COMMANDS
pub fn get_all_events_with_details_internal_testing() -> Result<Vec<Event>, Box<dyn Error>> {
    log::info!("INTERNAL TESTING: Starting to fetch all events with details...");
    let client = Client::builder().user_agent(USER_AGENT).timeout(std::time::Duration::from_secs(15)).build()?;
    let event_summaries = fetch_event_list_summaries(&client)?;
    log::info!("INTERNAL TESTING: Fetched {} event summaries. Now fetching details.", event_summaries.len());
    let mut detailed_events = Vec::new();
    for summary in event_summaries {
        match fetch_event_details(&client, summary) {
            Ok(detailed_event) => detailed_events.push(detailed_event),
            Err(e) => log::error!("INTERNAL TESTING: Error fetching details for an event: {}", e),
        }
    }
    log::info!("INTERNAL TESTING: Finished. Total detailed events: {}", detailed_events.len());
    Ok(detailed_events)
}