// src-tauri/src/scraper.rs
use crate::models::Event;
use chrono::NaiveDateTime; // For parsing date later
use reqwest::blocking::Client; // Using blocking client for simplicity in command
use scraper::{ElementRef, Html, Selector};
use std::error::Error; // For general error handling

const BASE_URL: &str = "https://www.thisiseindhoven.com";
const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";


// --- Helper Functions ---
fn get_element_text(element_ref: &ElementRef) -> String {
    element_ref.text().collect::<String>().trim().to_string()
}

fn select_first_text(element: &ElementRef, selector_str: &str) -> Option<String> {
    Selector::parse(selector_str).ok()
        .and_then(|selector| element.select(&selector).next())
        .map(|el_ref| get_element_text(&el_ref))
        .filter(|s| !s.is_empty())
}

fn select_first_attr(element: &ElementRef, selector_str: &str, attr: &str) -> Option<String> {
    Selector::parse(selector_str).ok()
        .and_then(|selector| element.select(&selector).next())
        .and_then(|el_ref| el_ref.value().attr(attr).map(str::to_string))
        .filter(|s| !s.is_empty())
}

fn parse_image_url_from_srcset(srcset: &str) -> Option<String> {
    let sources: Vec<&str> = srcset.split(',').map(|s| s.trim()).collect();
    let mut best_url: Option<String> = None;
    let mut max_width = 0;

    for src_entry in sources {
        let parts: Vec<&str> = src_entry.split_whitespace().collect();
        if parts.is_empty() { continue; }
        let url_part = parts[0];

        if parts.len() > 1 && parts[1].ends_with('w') {
            if let Ok(width) = parts[1].trim_end_matches('w').parse::<i32>() {
                if width > max_width {
                    max_width = width;
                    best_url = Some(url_part.to_string());
                }
            }
        } else if best_url.is_none() {
            best_url = Some(url_part.to_string());
        }
    }
    
    best_url.map(|url| {
        if url.starts_with('/') {
            format!("{}{}", BASE_URL, url)
        } else if url.starts_with("http") {
            url
        } else {
            log::warn!("Unrecognized image URL format in srcset, assuming relative: {}", url);
            format!("{}{}", BASE_URL, url)
        }
    })
}

// --- Event List Scraping ---
pub fn fetch_event_list_summaries(client: &Client) -> Result<Vec<Event>, Box<dyn Error>> {
    log::info!("Fetching event list summaries...");
    let main_page_url = format!("{}/en/events", BASE_URL);
    
    let response_text = client.get(&main_page_url).send()?.text()?;
    let document = Html::parse_document(&response_text);

    let card_selector = Selector::parse("a.result-card.result-card-generic")
        .map_err(|e| format!("Failed to parse card_selector: {:?}", e))?;
    
    let mut events: Vec<Event> = Vec::new();

    for card_element in document.select(&card_selector) {
        let mut event = Event::default(); // Uses the default impl from models.rs

        event.url_suffix = card_element.value().attr("href").map(str::to_string);
        if event.url_suffix.is_none() || !event.url_suffix.as_ref().unwrap().starts_with("/en/events/") {
            log::warn!("Skipping card with invalid or non-event URL: {:?}", event.url_suffix);
            continue;
        }
        event.full_url = event.url_suffix.as_ref().map(|s| format!("{}{}", BASE_URL, s));
        event.id = event.url_suffix.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

        // --- Image Parsing ---
        if let Some(img_tag) = select_first_attr(&card_element, "img", "self") { // "self" is a placeholder, need actual selector
            // This part needs refinement based on how we select the img tag itself
            // Let's assume card_element.select(&img_selector).next() where img_selector is defined.
            let img_selector_str = "img.result-card-generic__image"; // Define specific image selector
             if let Some(img_element) = Selector::parse(img_selector_str).ok().and_then(|s| card_element.select(&s).next()){
                let srcset = img_element.value().attr("data-srcset").or_else(|| img_element.value().attr("srcset"));
                if let Some(ss) = srcset {
                    event.image_url = parse_image_url_from_srcset(ss);
                } else if let Some(src) = img_element.value().attr("src") {
                     event.image_url = Some(
                        if src.starts_with("/getmedia/") { format!("{}{}", BASE_URL, src) }
                        else if src.starts_with("http") { src.to_string() }
                        else { "".to_string() } // Or some other default/error
                    ).filter(|s| !s.is_empty());
                }
                if event.title == "N/A" || event.title.is_empty() { // Fallback title from alt text
                    if let Some(alt_text) = img_element.value().attr("alt"){
                        event.title = alt_text.trim().to_string();
                    }
                }
            }
        }


        // Content within result-card-generic__content
        let content_selector = Selector::parse("div.result-card-generic__content")
            .map_err(|e| format!("Failed to parse content_selector: {:?}",e))?;
        if let Some(content_div) = card_element.select(&content_selector).next() {
            if event.title == "N/A" || event.title.is_empty() { // Prioritize H3 title
                 event.title = select_first_text(&content_div, "h3.result-card-generic__title")
                    .unwrap_or_else(|| "Title N/A".to_string());
            }
            event.short_description = select_first_text(&content_div, "p"); // First p tag in content
            event.date_time_summary = select_first_text(&content_div, "span.tag > span"); // Text inside the span within span.tag

            // Meta labels (location, date, price)
            let meta_wrap_selector = Selector::parse("div.meta-labels-wrap")
                .map_err(|e| format!("Failed to parse meta_wrap_selector: {:?}",e))?;
            if let Some(meta_wrap_div) = content_div.select(&meta_wrap_selector).next() {
                let meta_label_selector = Selector::parse("div.meta-label")
                    .map_err(|e| format!("Failed to parse meta_label_selector: {:?}",e))?;
                for meta_label_div in meta_wrap_div.select(&meta_label_selector) {
                    let text = get_element_text(&meta_label_div);
                    if Selector::parse("span.tie-icon-pin").ok().and_then(|s| meta_label_div.select(&s).next()).is_some() {
                        event.list_specific_location = Some(text.clone());
                    } else if Selector::parse("span.tie-icon-calendar").ok().and_then(|s| meta_label_div.select(&s).next()).is_some() {
                        event.list_date = Some(text.clone());
                        if event.date_time_summary.is_none() { event.date_time_summary = Some(text); }
                    } else if Selector::parse("span.tie-icon-euro").ok().and_then(|s| meta_label_div.select(&s).next()).is_some() {
                        event.list_price = Some(text);
                    }
                }
            }
        }
        events.push(event);
    }
    log::info!("Found {} event summaries.", events.len());
    Ok(events)
}

// --- Event Detail Scraping ---
pub fn fetch_event_details(client: &Client, mut event: Event) -> Result<Event, Box<dyn Error>> {
    let detail_url = event.full_url.as_ref().ok_or_else(|| "Missing full_url for detail fetching")?;
    log::info!("Fetching details for: {}", detail_url);

    let response_text = client.get(detail_url).send()?.text()?;
    let document = Html::parse_document(&response_text);
    event.detail_page_content = Some(response_text.clone()); // Save content for later re-parsing if needed

    // Main content container for details: div.card-hero-metadata__content
    let content_container_selector = Selector::parse("div.card-hero-metadata__content")
        .map_err(|e| format!("Failed to parse detail content_container_selector: {:?}", e))?;
    
    if let Some(content_container) = document.select(&content_container_selector).next() {
        // Title (usually H1)
        if let Some(title) = select_first_text(&content_container, "h1") {
            event.title = title; // Override list title with detail page title
        }

        // Description (usually within div.text > p)
        let text_div_selector = Selector::parse("div.text")
            .map_err(|e| format!("Failed to parse detail text_div_selector: {:?}", e))?;
        if let Some(text_div) = content_container.select(&text_div_selector).next() {
            event.full_description = select_first_text(&text_div, "p");

            // List with icons (date/time, price, venue name)
            let list_icons_selector = Selector::parse("ul.list-with-icons > li")
                .map_err(|e| format!("Failed to parse detail list_icons_selector: {:?}", e))?;
            for li_element in text_div.select(&list_icons_selector) {
                let text_content = li_element.children()
                    .filter_map(|node| node.value().as_text().map(|t| t.trim()))
                    .filter(|s| !s.is_empty())
                    .collect::<Vec<&str>>()
                    .join(" ");

                if text_content.is_empty() { continue; }

                if Selector::parse("span.tie-icon-calendar").ok().and_then(|s| li_element.select(&s).next()).is_some() {
                    event.datetime_str_raw_detail = Some(text_content.clone());
                    // TODO: Parse datetime_str_raw_detail with event.list_date into start_datetime and end_datetime
                    // This requires a robust date/time parsing function like in Python's scraper_service.
                    // For now, we just store the raw string.
                } else if Selector::parse("span.tie-icon-euro").ok().and_then(|s| li_element.select(&s).next()).is_some() {
                    event.price = Some(text_content); // Override list price
                } else if Selector::parse("span.tie-icon-pin").ok().and_then(|s| li_element.select(&s).next()).is_some() {
                    event.specific_location_name = Some(text_content); // Venue name from detail
                }
            }
        }
        
        // Address block (itemprop="address")
        let address_block_selector = Selector::parse("div[itemprop='address'][itemtype='https://schema.org/PostalAddress']")
            .map_err(|e| format!("Failed to parse address_block_selector: {:?}", e))?;
        if let Some(address_block) = document.select(&address_block_selector).next() { // Search in whole doc for address
            let street = select_first_text(&address_block, "span[itemprop='streetAddress']");
            let postal_code = select_first_text(&address_block, "span[itemprop='postalCode']");
            let locality = select_first_text(&address_block, "span[itemprop='addressLocality']");
            
            let mut address_parts: Vec<String> = Vec::new();
            if let Some(loc_name) = &event.specific_location_name { address_parts.push(loc_name.clone()); }
            else if let Some(list_loc) = &event.list_specific_location { address_parts.push(list_loc.clone());}

            if let Some(s) = street { if !address_parts.contains(&s) { address_parts.push(s); } }
            if let Some(pc) = postal_code { address_parts.push(pc); }
            if let Some(l) = locality { address_parts.push(l); }
            
            if !address_parts.is_empty() {
                let full_address = address_parts.join(", ");
                 // TODO: Geocode this address
                event.address = Some(full_address);
            }
        }
    } else {
        log::warn!("Could not find 'div.card-hero-metadata__content' on detail page: {}", detail_url);
    }
    Ok(event)
}

// --- Orchestration ---
pub fn get_all_events_with_details() -> Result<Vec<Event>, Box<dyn Error>> { // Keep Box<dyn Error> here for now
    let client = Client::builder()
        .user_agent(USER_AGENT)
        .build()?;

    let event_summaries = fetch_event_list_summaries(&client)?;
    let mut detailed_events: Vec<Event> = Vec::new();

    for summary in event_summaries {
        let event_id_for_log = summary.id.clone(); // Clone the ID for logging before potential move

        if summary.full_url.is_some() {
            match fetch_event_details(&client, summary) { // summary is moved here
                Ok(detailed_event) => {
                    detailed_events.push(detailed_event);
                ``}
                Err(e) => {
                    // Now use event_id_for_log instead of summary.id
                    log::error!("Failed to fetch details for event {:?}: {}", event_id_for_log, e);
                    // Decide if you want to push the original summary or skip
                    // For now, we skip if details fail. To add the summary:
                    // detailed_events.push(original_summary_if_cloned_or_reconstruct);
                }
            }
        } else {
            log::warn!("Event summary {:?} has no full_url, cannot fetch details.", event_id_for_log);
            detailed_events.push(summary); // summary is not moved in this branch
        }
    }
    log::info!("Finished fetching all event details. Total: {}", detailed_events.len());
    Ok(detailed_events)
}

// --- Placeholder for Geocoding ---
// pub fn geocode_event(mut event: Event) -> Result<Event, Box<dyn Error>> {
//     if let Some(address_to_geocode) = &event.address {
//         log::info!("Geocoding address: {}", address_to_geocode);
//         // Use a crate like `geocoding` or `nominatim`
//         // For example with `nominatim` crate:
//         // let geocoder = nominatim::Client::new(nominatim::Identity::UserAgent("eindhoven_event_app/1.0".to_string()));
//         // let query = nominatim::Query::Structured {
//         //     street: None, // You might parse parts of the address for better results
//         //     city: Some(address_to_geocode.clone()), // Simplified
//         //     ..Default::default()
//         // };
//         // if let Some(results) = geocoder.search(query).ok().and_then(|r| r.get(0)) {
//         //     event.latitude = results.lat().and_then(|s| s.parse::<f64>().ok());
//         //     event.longitude = results.lon().and_then(|s| s.parse::<f64>().ok());
//         //     log::info!("Geocoded to: Lat {:?}, Lon {:?}", event.latitude, event.longitude);
//         // } else {
//         //     log::warn!("Failed to geocode: {}", address_to_geocode);
//         // }
//     }
//     Ok(event)
// }