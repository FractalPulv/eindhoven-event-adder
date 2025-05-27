// File: src-tauri/src/scraper/parsers.rs
use reqwest::blocking::Client;
use scraper::{Html, Selector};
use std::error::Error;
use url::Url;

use super::utils::*;
use crate::models::Event;

// fetch_event_list_summaries remains the same
pub fn fetch_event_list_summaries(client: &Client) -> Result<Vec<Event>, Box<dyn Error>> {
    log::info!("Fetching event list summaries from: {}/en/events", BASE_URL);
    let main_page_url = format!("{}/en/events", BASE_URL);
    let response_text = client.get(&main_page_url).send()?.text()?;
    let document = Html::parse_document(&response_text);
    let card_selector = Selector::parse("a.result-card.result-card-generic").map_err(|e| format!("Failed to parse card_selector: {:?}", e))?;
    let mut events: Vec<Event> = Vec::new();

    for (_index, card_element) in document.select(&card_selector).enumerate() {
        let mut event = Event::default();
        event.url_suffix = card_element.value().attr("href").map(str::to_string);
        if event.url_suffix.is_none() || !event.url_suffix.as_ref().unwrap().starts_with("/en/events/") { continue; }
        event.full_url = event.url_suffix.as_ref().map(|s| format!("{}{}", BASE_URL, s));
        event.id = event.url_suffix.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        
        let mut image_found_url: Option<String> = None;
        let picture_selector = Selector::parse("picture.result-card-generic__picture").map_err(|e| format!("Failed to parse picture_selector: {:?}", e))?;
        if let Some(picture_element) = card_element.select(&picture_selector).next() {
            let source_selector = Selector::parse("source[srcset]").map_err(|e| format!("Failed to parse source_selector: {:?}", e))?;
            for source_element in picture_element.select(&source_selector) { 
                if let Some(srcset) = source_element.value().attr("srcset") { 
                    image_found_url = parse_image_url_from_srcset(srcset, BASE_URL); 
                    if image_found_url.is_some() { break; } 
                } 
            }
        }
        if image_found_url.is_none() {
            let img_selectors = ["img.result-card-generic__image", "img"];
            for img_selector_str in &img_selectors {
                let img_selector = Selector::parse(img_selector_str).map_err(|e| format!("Failed to parse img_selector: {:?}", e))?;
                if let Some(img_element) = card_element.select(&img_selector).next() {
                    if let Some(srcset) = img_element.value().attr("data-srcset").or_else(|| img_element.value().attr("srcset")) { 
                        image_found_url = parse_image_url_from_srcset(srcset, BASE_URL); 
                    } else if let Some(src) = img_element.value().attr("src") { 
                        image_found_url = make_absolute_url(BASE_URL, src); 
                    }
                    if (event.title == "N/A" || event.title.is_empty()) { 
                        if let Some(alt_text) = img_element.value().attr("alt") { 
                            if !alt_text.trim().is_empty() { event.title = alt_text.trim().to_string(); } 
                        } 
                    }
                    if image_found_url.is_some() { break; } 
                }
            }
        }
        event.image_url = image_found_url;

        let content_selector = Selector::parse("div.result-card-generic__content").map_err(|e| format!("Failed to parse content_selector: {:?}", e))?;
        if let Some(content_div) = card_element.select(&content_selector).next() {
            if event.title == "N/A" || event.title.is_empty() { 
                event.title = content_div.select(&Selector::parse("h3.result-card-generic__title").unwrap()).next().map_or("Title N/A".to_string(), |el| get_element_text(&el));
            }
            event.short_description = content_div.select(&Selector::parse("p").unwrap()).next().map(|p_el| get_element_text(&p_el));
            event.date_time_summary = content_div.select(&Selector::parse("span.tag > span").unwrap()).next().map(|span_el| get_element_text(&span_el));
            
            let meta_wrap_selector = Selector::parse("div.meta-labels-wrap").map_err(|e| format!("Failed to parse meta_wrap_selector: {:?}", e))?;
            if let Some(meta_wrap_div) = content_div.select(&meta_wrap_selector).next() {
                let meta_label_selector = Selector::parse("div.meta-label").map_err(|e| format!("Failed to parse meta_label_selector: {:?}", e))?;
                for meta_label_div in meta_wrap_div.select(&meta_label_selector) {
                    let text = get_element_text(&meta_label_div);
                    if meta_label_div.select(&Selector::parse("span.tie-icon-pin").unwrap()).next().is_some() { event.list_specific_location = Some(text.clone()); }
                    else if meta_label_div.select(&Selector::parse("span.tie-icon-calendar").unwrap()).next().is_some() { event.list_date = Some(text.clone()); if event.date_time_summary.is_none() { event.date_time_summary = Some(text.clone()); } }
                    else if meta_label_div.select(&Selector::parse("span.tie-icon-euro").unwrap()).next().is_some() { event.list_price = Some(text.clone()); }
                }
            }
        }
        events.push(event);
    }
    Ok(events)
}

pub fn fetch_event_details(client: &Client, mut event: Event) -> Result<Event, Box<dyn Error>> {
    let detail_url = event.full_url.as_ref().ok_or_else(|| "Missing full_url for detail fetching")?;
    log::info!("Fetching details for event '{}' from URL: {}", event.title, detail_url);
    let response_text = client.get(detail_url).send()?.text()?;
    
    // Optional: log the HTML if you still need to debug other parts
    // log::info!("Fetched HTML for event '{}': {:.2000}", event.title, response_text);

    let document = Html::parse_document(&response_text);
    let content_container_selector = Selector::parse("div.card-hero-metadata__content").map_err(|e| format!("Failed to parse detail_container: {:?}", e))?;

    if let Some(content_container) = document.select(&content_container_selector).next() {
        if let Some(title_el) = content_container.select(&Selector::parse("h1").unwrap()).next() { 
            event.title = get_element_text(&title_el); 
        }
        
        let text_div_selector = Selector::parse("div.text").map_err(|e| format!("Failed to parse text_div: {:?}", e))?;
        if let Some(text_div) = content_container.select(&text_div_selector).next() {
            if let Some(p_el) = text_div.select(&Selector::parse("p").unwrap()).next() { 
                event.full_description = Some(get_element_text(&p_el));
            }
            
            let list_icons_selector = Selector::parse("ul.list-with-icons > li").map_err(|e| format!("Failed to parse list_icons: {:?}", e))?;
            for li_element in text_div.select(&list_icons_selector) {
                let text_content = li_element.children().filter_map(|node| node.value().as_text().map(|t| t.trim())).filter(|s| !s.is_empty()).collect::<Vec<&str>>().join(" ");
                if text_content.is_empty() { continue; }

                if li_element.select(&Selector::parse("span.tie-icon-calendar").unwrap()).next().is_some() {
                    event.datetime_str_raw_detail = Some(text_content.clone());
                    let (start_dt, end_dt) = parse_event_datetimes(event.list_date.as_deref(), event.datetime_str_raw_detail.as_deref());
                    event.start_datetime = start_dt; event.end_datetime = end_dt;
                } else if li_element.select(&Selector::parse("span.tie-icon-euro").unwrap()).next().is_some() { 
                    event.price = Some(text_content.clone()); 
                } else if li_element.select(&Selector::parse("span.tie-icon-pin").unwrap()).next().is_some() { 
                    event.specific_location_name = Some(text_content.clone()); 
                }
            }
        }
        
        let address_block_selector = Selector::parse("div[itemprop='address'][itemtype='https://schema.org/PostalAddress']").map_err(|e| format!("Failed to parse address_block: {:?}", e))?;
        if let Some(address_block) = document.select(&address_block_selector).next() {
            let street = address_block.select(&Selector::parse("span[itemprop='streetAddress']").unwrap()).next().map(|el| get_element_text(&el));
            let postal_code = address_block.select(&Selector::parse("span[itemprop='postalCode']").unwrap()).next().map(|el| get_element_text(&el));
            let locality = address_block.select(&Selector::parse("span[itemprop='addressLocality']").unwrap()).next().map(|el| get_element_text(&el));
            
            let mut address_parts: Vec<String> = Vec::new();
            if let Some(loc_name) = &event.specific_location_name { address_parts.push(loc_name.clone()); } 
            else if let Some(list_loc) = &event.list_specific_location { address_parts.push(list_loc.clone());}
            if let Some(s) = street { if !address_parts.contains(&s) { address_parts.push(s); } }
            if let Some(pc) = postal_code { address_parts.push(pc); }
            if let Some(l) = locality { address_parts.push(l); }

            if !address_parts.is_empty() {
                event.address = Some(address_parts.join(", "));
            }
        }
    }

    // --- UPDATED: Scrape coordinates from div's data-src attribute ---
    let maps_container_selector_str = "div.maps-container[data-src]"; // Target the div with class 'maps-container' and a 'data-src' attribute
    let maps_container_selector = Selector::parse(maps_container_selector_str)
        .map_err(|e| format!("Failed to parse maps_container selector '{}': {:?}", maps_container_selector_str, e))?;

    if let Some(maps_container_element) = document.select(&maps_container_selector).next() {
        log::debug!("Found maps container for event '{}'", event.title);
        if let Some(data_src_attr) = maps_container_element.value().attr("data-src") {
            log::info!("Maps container data-src for event '{}': {}", event.title, data_src_attr);
            match Url::parse(data_src_attr) { // Parse the URL from data-src
                Ok(parsed_url) => {
                    for (key, value) in parsed_url.query_pairs() {
                        if key == "center" {
                            log::debug!("Found 'center' parameter: {}", value);
                            let coords: Vec<&str> = value.split(',').collect();
                            if coords.len() == 2 {
                                if let (Ok(lat), Ok(lon)) = (coords[0].parse::<f64>(), coords[1].parse::<f64>()) {
                                    event.latitude = Some(lat);
                                    event.longitude = Some(lon);
                                    log::info!("Successfully parsed coordinates for '{}': Lat: {}, Lon: {}", event.title, lat, lon);
                                    break; 
                                } else {
                                    log::warn!("Failed to parse lat/lon from 'center' param in data-src: {}", value);
                                }
                            } else {
                                log::warn!("'center' parameter in data-src does not have two parts: {}", value);
                            }
                        }
                    }
                     // If 'center' wasn't found, check if the 'q' parameter might be coordinates directly (less common for 'place' URLs but possible)
                    if event.latitude.is_none() {
                        for (key, value) in parsed_url.query_pairs() {
                            if key == "q" {
                                log::debug!("Found 'q' parameter: {}", value);
                                let coords: Vec<&str> = value.split(',').collect();
                                if coords.len() == 2 {
                                     if let (Ok(lat), Ok(lon)) = (coords[0].parse::<f64>(), coords[1].parse::<f64>()) {
                                        // Basic validation for lat/lon ranges
                                        if (-90.0..=90.0).contains(&lat) && (-180.0..=180.0).contains(&lon) {
                                            event.latitude = Some(lat);
                                            event.longitude = Some(lon);
                                            log::info!("Successfully parsed coordinates from 'q' parameter for '{}': Lat: {}, Lon: {}", event.title, lat, lon);
                                            break;
                                        } else {
                                            log::warn!("Parsed values from 'q' parameter are outside valid lat/lon ranges: {}", value);
                                        }
                                    } else {
                                         log::warn!("Failed to parse lat/lon from 'q' param in data-src: {}", value);
                                    }
                                }
                                break; // Process only the first 'q' param
                            }
                        }
                    }


                }
                Err(e) => {
                    log::warn!("Failed to parse maps_container data-src URL '{}': {:?}", data_src_attr, e);
                }
            }
        } else {
            log::warn!("Maps container found for event '{}', but it has no 'data-src' attribute.", event.title);
        }
    } else {
        log::warn!("No maps container matching selector '{}' found for event '{}'", maps_container_selector_str, event.title);
    }
    // --- End updated coordinate scraping ---

    Ok(event)
}

// get_all_events_with_details_internal_testing remains the same
pub(super) fn get_all_events_with_details_internal_testing() -> Result<Vec<Event>, Box<dyn Error>> {
    log::info!("INTERNAL TESTING: Starting to fetch all events with details...");
    let client = Client::builder().user_agent(USER_AGENT_FOR_SCRAPING_INTERNAL_TEST).timeout(std::time::Duration::from_secs(15)).build()?;
    let event_summaries = fetch_event_list_summaries(&client)?;
    let mut detailed_events = Vec::new();
    for summary in event_summaries {
        match fetch_event_details(&client, summary) {
            Ok(detailed_event) => detailed_events.push(detailed_event),
            Err(e) => log::error!("INTERNAL TESTING: Error fetching details: {}", e),
        }
    }
    log::info!("INTERNAL TESTING: Finished. Total detailed events: {}", detailed_events.len());
    Ok(detailed_events)
}