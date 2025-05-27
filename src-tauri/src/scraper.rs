// src-tauri/src/scraper.rs
use crate::models::Event;
// use chrono::NaiveDateTime; // Not directly used in this file for parsing, but Event model has it
use reqwest::blocking::Client;
use scraper::{ElementRef, Html, Selector};
use std::error::Error;
use url::Url; // For robust URL joining

const BASE_URL: &str = "https://www.thisiseindhoven.com";
const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

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

// --- Event List Scraping ---
pub fn fetch_event_list_summaries(client: &Client) -> Result<Vec<Event>, Box<dyn Error>> {
    log::info!("Fetching event list summaries from: {}/en/events", BASE_URL);
    let main_page_url = format!("{}/en/events", BASE_URL);

    let response_text = client.get(&main_page_url).send()?.text()?;
    let document = Html::parse_document(&response_text);

    let card_selector = Selector::parse("a.result-card.result-card-generic")
        .map_err(|e| format!("Failed to parse card_selector: {:?}", e))?;

    let mut events: Vec<Event> = Vec::new();

    for (index, card_element) in document.select(&card_selector).enumerate() {
        let mut event = Event::default();
        log::debug!("Processing card #{}", index + 1);

        event.url_suffix = card_element.value().attr("href").map(str::to_string);
        if event.url_suffix.is_none() || !event.url_suffix.as_ref().unwrap().starts_with("/en/events/") {
            log::warn!("Skipping card #{} with invalid or non-event URL: {:?}", index + 1, event.url_suffix);
            continue;
        }
        event.full_url = event.url_suffix.as_ref().map(|s| format!("{}{}", BASE_URL, s));
        event.id = event.url_suffix.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        log::debug!("Event ID: {}, URL Suffix: {:?}", event.id, event.url_suffix);

        // ... (Image parsing code remains the same as my previous corrected version) ...
        let mut image_found_url: Option<String> = None;

        // 1. Try to find <picture> element, then <source srcset>
        let picture_selector = Selector::parse("picture.result-card-generic__picture").map_err(|e| format!("Failed to parse picture_selector: {:?}", e))?;
        if let Some(picture_element) = card_element.select(&picture_selector).next() {
            log::debug!("Found <picture> element for card #{}", index + 1);
            let source_selector = Selector::parse("source[srcset]").map_err(|e| format!("Failed to parse source_selector: {:?}", e))?;
            for source_element in picture_element.select(&source_selector) {
                if let Some(srcset) = source_element.value().attr("srcset") {
                    log::debug!("Found <source srcset>: {}", srcset);
                    image_found_url = parse_image_url_from_srcset(srcset, BASE_URL);
                    if image_found_url.is_some() { break; } 
                }
            }
        }

        if image_found_url.is_none() {
            let img_selectors = [
                "img.result-card-generic__image", 
                "img"                              
            ];
            for img_selector_str in &img_selectors {
                let img_selector = Selector::parse(img_selector_str).map_err(|e| format!("Failed to parse img_selector ({}): {:?}", img_selector_str, e))?;
                if let Some(img_element) = card_element.select(&img_selector).next() {
                    log::debug!("Found <img> element with selector '{}' for card #{}", img_selector_str, index + 1);
                    if let Some(srcset) = img_element.value().attr("data-srcset").or_else(|| img_element.value().attr("srcset")) {
                        log::debug!("Img has data-srcset or srcset: {}", srcset);
                        image_found_url = parse_image_url_from_srcset(srcset, BASE_URL);
                    } else if let Some(src) = img_element.value().attr("src") {
                        log::debug!("Img has src: {}", src);
                        image_found_url = make_absolute_url(BASE_URL, src);
                    }

                    if (event.title == "N/A" || event.title.is_empty()) {
                        if let Some(alt_text) = img_element.value().attr("alt") {
                            if !alt_text.trim().is_empty() {
                                event.title = alt_text.trim().to_string();
                                log::debug!("Using alt text for title: {}", event.title);
                            }
                        }
                    }
                    if image_found_url.is_some() { break; } 
                }
            }
        }
        
        if image_found_url.is_some() {
            log::info!("SUCCESS: Image URL for event '{}': {}", event.id, image_found_url.as_ref().unwrap());
        } else {
            log::warn!("FAILURE: No image URL found for event '{}'", event.id);
        }
        event.image_url = image_found_url;


        let content_selector = Selector::parse("div.result-card-generic__content")
            .map_err(|e| format!("Failed to parse content_selector: {:?}", e))?;
        if let Some(content_div) = card_element.select(&content_selector).next() {
            if event.title == "N/A" || event.title.is_empty() {
                 event.title = select_first_text(&content_div, "h3.result-card-generic__title")
                    .unwrap_or_else(|| {
                        log::warn!("Title not found for card #{}, defaulting.", index + 1);
                        "Title N/A".to_string()
                    });
            }
            log::debug!("Event Title: {}", event.title);

            event.short_description = select_first_text(&content_div, "p");
            log::debug!("Short Description: {:?}", event.short_description.as_ref().map(|s| s.chars().take(50).collect::<String>() + "..."));

            event.date_time_summary = select_first_text(&content_div, "span.tag > span");
            log::debug!("Date Summary (tag): {:?}", event.date_time_summary);

            let meta_wrap_selector = Selector::parse("div.meta-labels-wrap")
                .map_err(|e| format!("Failed to parse meta_wrap_selector: {:?}", e))?;
            if let Some(meta_wrap_div) = content_div.select(&meta_wrap_selector).next() {
                let meta_label_selector = Selector::parse("div.meta-label")
                    .map_err(|e| format!("Failed to parse meta_label_selector: {:?}", e))?;
                for meta_label_div in meta_wrap_div.select(&meta_label_selector) {
                    let text = get_element_text(&meta_label_div); // `text` is created here for each meta_label_div
                    if Selector::parse("span.tie-icon-pin").ok().and_then(|s| meta_label_div.select(&s).next()).is_some() {
                        event.list_specific_location = Some(text.clone()); // Clone `text` for the Option
                        log::debug!("Meta Location: {}", text); // Original `text` can be used here
                    } else if Selector::parse("span.tie-icon-calendar").ok().and_then(|s| meta_label_div.select(&s).next()).is_some() {
                        event.list_date = Some(text.clone()); // Clone `text` for the Option
                        if event.date_time_summary.is_none() { 
                            event.date_time_summary = Some(text.clone()); // Clone `text` again if used here
                        }
                        log::debug!("Meta Date: {}", text); // Original `text` can be used here
                    } else if Selector::parse("span.tie-icon-euro").ok().and_then(|s| meta_label_div.select(&s).next()).is_some() {
                        event.list_price = Some(text.clone()); // <<<< THE FIX IS HERE: .clone() added
                        log::debug!("Meta Price: {}", text);    // Original `text` can be used here
                    }
                }
            }
        } else {
            log::warn!("Could not find div.result-card-generic__content for card #{}", index + 1);
        }
        events.push(event);
    }
    log::info!("Found {} event summaries after processing all cards.", events.len());
    Ok(events)
}

// ... (fetch_event_details and get_all_events_with_details remain the same as my previous corrected version) ...
// --- Event Detail Scraping (largely unchanged, ensure logging is present) ---
pub fn fetch_event_details(client: &Client, mut event: Event) -> Result<Event, Box<dyn Error>> {
    let detail_url = event.full_url.as_ref().ok_or_else(|| "Missing full_url for detail fetching")?;
    log::info!("Fetching details for event '{}' from URL: {}", event.title, detail_url);

    let response_text = client.get(detail_url).send()?.text()?;
    let document = Html::parse_document(&response_text);
    // event.detail_page_content = Some(response_text.clone()); // Optional: if you need raw HTML later

    let content_container_selector = Selector::parse("div.card-hero-metadata__content")
        .map_err(|e| format!("Failed to parse detail content_container_selector: {:?}", e))?;
    
    if let Some(content_container) = document.select(&content_container_selector).next() {
        log::debug!("Found 'div.card-hero-metadata__content' for event '{}'", event.title);
        if let Some(title) = select_first_text(&content_container, "h1") {
            log::debug!("Detail page H1 title: '{}'. Overwriting list title: '{}'", title, event.title);
            event.title = title;
        }

        let text_div_selector = Selector::parse("div.text")
            .map_err(|e| format!("Failed to parse detail text_div_selector: {:?}", e))?;
        if let Some(text_div) = content_container.select(&text_div_selector).next() {
            log::debug!("Found 'div.text' in content container");
            event.full_description = select_first_text(&text_div, "p");
            log::debug!("Full Description (first 50 chars): {:?}", event.full_description.as_ref().map(|s| s.chars().take(50).collect::<String>() + "..."));

            let list_icons_selector = Selector::parse("ul.list-with-icons > li")
                .map_err(|e| format!("Failed to parse detail list_icons_selector: {:?}", e))?;
            for li_element in text_div.select(&list_icons_selector) {
                let text_content = li_element.children()
                    .filter_map(|node| node.value().as_text().map(|t| t.trim()))
                    .filter(|s| !s.is_empty())
                    .collect::<Vec<&str>>()
                    .join(" ");

                if text_content.is_empty() { continue; }
                log::debug!("Processing li item: {}", text_content);

                if Selector::parse("span.tie-icon-calendar").ok().and_then(|s| li_element.select(&s).next()).is_some() {
                    event.datetime_str_raw_detail = Some(text_content.clone());
                    log::debug!("Raw detail date/time string: {}", text_content);
                    // TODO: Parse datetime_str_raw_detail with event.list_date into start_datetime and end_datetime
                } else if Selector::parse("span.tie-icon-euro").ok().and_then(|s| li_element.select(&s).next()).is_some() {
                    event.price = Some(text_content.clone());
                    log::debug!("Detail Price: {}", text_content);
                } else if Selector::parse("span.tie-icon-pin").ok().and_then(|s| li_element.select(&s).next()).is_some() {
                    event.specific_location_name = Some(text_content.clone());
                    log::debug!("Detail Specific Location Name: {}", text_content);
                }
            }
        } else {  log::warn!("Did not find 'div.text' in content container for event '{}'", event.title); }
        
        let address_block_selector = Selector::parse("div[itemprop='address'][itemtype='https://schema.org/PostalAddress']")
            .map_err(|e| format!("Failed to parse address_block_selector: {:?}", e))?;
        if let Some(address_block) = document.select(&address_block_selector).next() {
            log::debug!("Found address block for event '{}'", event.title);
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
                log::debug!("Parsed Address: {}", full_address);
                event.address = Some(full_address);
                 // TODO: Geocode this address
            } else { log::debug!("No address parts found in address block for event '{}'", event.title); }
        } else { log::warn!("Address block not found for event '{}'", event.title); }
    } else {
        log::warn!("Could not find 'div.card-hero-metadata__content' on detail page for event '{}', URL: {}", event.title, detail_url);
    }
    Ok(event)
}

// --- Orchestration (ensure logging is present) ---
pub fn get_all_events_with_details() -> Result<Vec<Event>, Box<dyn Error>> {
    log::info!("Starting to fetch all events with details...");
    let client = Client::builder()
        .user_agent(USER_AGENT)
        .timeout(std::time::Duration::from_secs(15)) // Add a timeout
        .build()?;

    let event_summaries = match fetch_event_list_summaries(&client) {
        Ok(summaries) => summaries,
        Err(e) => {
            log::error!("CRITICAL: Failed to fetch event list summaries: {}", e);
            return Err(e); // Propagate critical error
        }
    };
    
    log::info!("Fetched {} event summaries. Now fetching details for each.", event_summaries.len());
    let mut detailed_events: Vec<Event> = Vec::new();
    let mut successful_details_count = 0;
    let mut failed_details_count = 0;

    for (i, summary) in event_summaries.into_iter().enumerate() { // Use into_iter to take ownership
        let event_id_for_log = summary.id.clone();
        let event_title_for_log = summary.title.clone();
        log::debug!("Processing summary #{} (ID: {}, Title: {})...", i + 1, event_id_for_log, event_title_for_log);

        if summary.full_url.is_some() {
            match fetch_event_details(&client, summary) { // summary is moved here
                Ok(detailed_event) => {
                    detailed_events.push(detailed_event);
                    successful_details_count += 1;
                }
                Err(e) => {
                    log::error!("Failed to fetch details for event ID '{}' (Title: {}): {}. Original summary might be lost.", event_id_for_log, event_title_for_log, e);
                    failed_details_count += 1;
                }
            }
        } else {
            log::warn!("Event summary ID '{}' (Title: {}) has no full_url, cannot fetch details. Adding summary as is.", event_id_for_log, event_title_for_log);
            detailed_events.push(summary); 
        }
    }
    log::info!(
        "Finished fetching all event details. Total events processed for details: {}. Successfully detailed: {}. Failed to detail: {}. Final event count: {}",
        successful_details_count + failed_details_count,
        successful_details_count,
        failed_details_count,
        detailed_events.len()
    );
    Ok(detailed_events)
}