// File: src-tauri/src/scraper/parsers.rs
use reqwest::blocking::Client;
use scraper::{Html, Selector};
use std::error::Error;
use url::Url;

use super::utils::*;
use crate::models::Event;
use crate::cache::{self, CacheEntry};

pub fn fetch_event_list_summaries(
    client: &Client,
    page_limit: Option<u32>,
    force_refresh: bool,
    progress_callback: impl Fn(crate::models::ScrapingProgress) + Send + 'static,
) -> Result<Vec<Event>, Box<dyn Error>> {
    // Try to read from cache first, unless force_refresh is true
    if !force_refresh {
        if let Some(cached_entry) = cache::read_cache::<Vec<Event>>() {
            if cached_entry.is_fresh() {
                log::info!("Returning events from cache.");
                progress_callback(crate::models::ScrapingProgress {
                    current_page: 0,
                    total_pages_estimate: 0,
                    events_on_current_page: cached_entry.data.len() as u32,
                    total_events_scraped: cached_entry.data.len() as u32,
                    message: "Loaded from cache.".to_string(),
                });
                return Ok(cached_entry.data);
            }
        }
    }

    let mut all_events: Vec<Event> = Vec::new();
    let mut page = 1;
    let mut has_more_pages = true;
    let mut total_events_scraped = 0;

    while has_more_pages {
        if let Some(limit) = page_limit {
            if page > limit {
                log::info!("Page limit ({}) reached. Stopping scraping.", limit);
                break;
            }
        }
        let page_url = format!("{}/en/events?page={}", BASE_URL, page);
        log::info!("Fetching event list summaries from: {}", page_url);

        let response_text = client.get(&page_url).send()?.text()?;
        let document = Html::parse_document(&response_text);

        let card_selector = Selector::parse("a.result-card.result-card-generic")
            .map_err(|e| format!("Failed to parse card_selector: {:?}", e))?;
        
        let mut page_events_found = 0;
        for (_index, card_element) in document.select(&card_selector).enumerate() {
            page_events_found += 1;
            let mut event = Event::default();
        event.url_suffix = card_element.value().attr("href").map(str::to_string);
        if event.url_suffix.is_none()
            || !event
                .url_suffix
                .as_ref()
                .unwrap()
                .starts_with("/en/events/")
        {
            continue;
        }
        event.full_url = event
            .url_suffix
            .as_ref()
            .map(|s| format!("{}{}", BASE_URL, s));
        event.id = event
            .url_suffix
            .clone()
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

        let mut image_found_url: Option<String> = None;
        let picture_selector = Selector::parse("picture.result-card-generic__picture")
            .map_err(|e| format!("Failed to parse picture_selector: {:?}", e))?;
        if let Some(picture_element) = card_element.select(&picture_selector).next() {
            let source_selector = Selector::parse("source[srcset]")
                .map_err(|e| format!("Failed to parse source_selector: {:?}", e))?;
            for source_element in picture_element.select(&source_selector) {
                if let Some(srcset) = source_element.value().attr("srcset") {
                    image_found_url = parse_image_url_from_srcset(srcset, BASE_URL);
                    if image_found_url.is_some() {
                        break;
                    }
                }
            }
        }
        if image_found_url.is_none() {
            let img_selectors = ["img.result-card-generic__image", "img"];
            for img_selector_str in &img_selectors {
                let img_selector = Selector::parse(img_selector_str)
                    .map_err(|e| format!("Failed to parse img_selector: {:?}", e))?;
                if let Some(img_element) = card_element.select(&img_selector).next() {
                    if let Some(srcset) = img_element
                        .value()
                        .attr("data-srcset")
                        .or_else(|| img_element.value().attr("srcset"))
                    {
                        image_found_url = parse_image_url_from_srcset(srcset, BASE_URL);
                    } else if let Some(src) = img_element.value().attr("src") {
                        image_found_url = make_absolute_url(BASE_URL, src);
                    }
                    if (event.title == "N/A" || event.title.is_empty()) {
                        if let Some(alt_text) = img_element.value().attr("alt") {
                            if !alt_text.trim().is_empty() {
                                event.title = alt_text.trim().to_string();
                            }
                        }
                    }
                    if image_found_url.is_some() {
                        break;
                    }
                }
            }
        }
        event.image_url = image_found_url;

        let content_selector = Selector::parse("div.result-card-generic__content")
            .map_err(|e| format!("Failed to parse content_selector: {:?}", e))?;
        if let Some(content_div) = card_element.select(&content_selector).next() {
            if event.title == "N/A" || event.title.is_empty() {
                event.title = content_div
                    .select(&Selector::parse("h3.result-card-generic__title").unwrap())
                    .next()
                    .map_or("Title N/A".to_string(), |el| get_element_text(&el));
            }
            event.short_description = content_div
                .select(&Selector::parse("p").unwrap())
                .next()
                .map(|p_el| get_element_text(&p_el));
            event.date_time_summary = content_div
                .select(&Selector::parse("span.tag > span").unwrap())
                .next()
                .map(|span_el| get_element_text(&span_el));

            let meta_wrap_selector = Selector::parse("div.meta-labels-wrap")
                .map_err(|e| format!("Failed to parse meta_wrap_selector: {:?}", e))?;
            if let Some(meta_wrap_div) = content_div.select(&meta_wrap_selector).next() {
                let meta_label_selector = Selector::parse("div.meta-label")
                    .map_err(|e| format!("Failed to parse meta_label_selector: {:?}", e))?;
                for meta_label_div in meta_wrap_div.select(&meta_label_selector) {
                    let text = get_element_text(&meta_label_div);
                    if meta_label_div
                        .select(&Selector::parse("span.tie-icon-pin").unwrap())
                        .next()
                        .is_some()
                    {
                        event.list_specific_location = Some(text.clone());
                    } else if meta_label_div
                        .select(&Selector::parse("span.tie-icon-calendar").unwrap())
                        .next()
                        .is_some()
                    {
                        event.list_date = Some(text.clone());
                        if event.date_time_summary.is_none() {
                            event.date_time_summary = Some(text.clone());
                        }
                    } else if meta_label_div
                        .select(&Selector::parse("span.tie-icon-euro").unwrap())
                        .next()
                        .is_some()
                    {
                        event.list_price = Some(text.clone());
                    }
                }
            }
        }
        all_events.push(event);
        }
        total_events_scraped += page_events_found;

        let total_pages_estimate = if page_events_found == 0 { page } else { page + 5 }; // Rough estimate

        progress_callback(crate::models::ScrapingProgress {
            current_page: page,
            total_pages_estimate,
            events_on_current_page: page_events_found,
            total_events_scraped,
            message: format!("Scraping page {}...", page),
        });

        if page_events_found == 0 {
            log::info!("No event cards found on page {}. Assuming last page.", page);
            has_more_pages = false;
        } else {
            // Check for a 'next page' link to determine if there are more pages
            // This selector might need adjustment based on the actual HTML structure
            let next_page_selector = Selector::parse("a.pagination__next")
                .map_err(|e| format!("Failed to parse next_page_selector: {:?}", e))?;
            if document.select(&next_page_selector).next().is_some() {
                page += 1;
            } else {
                has_more_pages = false;
            }
        }
    }
    // Write to cache before returning
    let cache_entry = CacheEntry::new(all_events.clone());
    if let Err(e) = cache::write_cache(&cache_entry) {
        log::error!("Failed to write events to cache: {}", e);
    }

    progress_callback(crate::models::ScrapingProgress {
        current_page: page - 1, // Last successfully scraped page
        total_pages_estimate: page - 1,
        events_on_current_page: 0,
        total_events_scraped,
        message: "Scraping complete.".to_string(),
    });

    Ok(all_events)
}

pub fn fetch_event_details(client: &Client, mut event: Event) -> Result<Event, Box<dyn Error>> {
    let detail_url = event
        .full_url
        .as_ref()
        .ok_or_else(|| "Missing full_url for detail fetching")?;
    log::info!(
        "Fetching details for event '{}' from URL: {}",
        event.title,
        detail_url
    );
    let response_text = client.get(detail_url).send()?.text()?;
    let document = Html::parse_document(&response_text);

    // --- Scrape Main Content (Title, Description, Date/Time, Price, Location Name from list-with-icons) ---
    let content_container_selector = Selector::parse("div.card-hero-metadata__content")
        .map_err(|e| format!("Failed to parse detail_container: {:?}", e))?;
    if let Some(content_container) = document.select(&content_container_selector).next() {
        if let Some(title_el) = content_container
            .select(&Selector::parse("h1").unwrap())
            .next()
        {
            event.title = get_element_text(&title_el);
        }

        let text_div_selector = Selector::parse("div.text")
            .map_err(|e| format!("Failed to parse text_div: {:?}", e))?;
        if let Some(text_div) = content_container.select(&text_div_selector).next() {
            if let Some(p_el) = text_div.select(&Selector::parse("p").unwrap()).next() {
                event.full_description = Some(get_element_text(&p_el));
            }

            let list_icons_selector = Selector::parse("ul.list-with-icons > li")
                .map_err(|e| format!("Failed to parse list_icons: {:?}", e))?;
            for li_element in text_div.select(&list_icons_selector) {
                let text_content = li_element
                    .children()
                    .filter_map(|node| node.value().as_text().map(|t| t.trim()))
                    .filter(|s| !s.is_empty())
                    .collect::<Vec<&str>>()
                    .join(" ");
                if text_content.is_empty() {
                    continue;
                }

                if li_element
                    .select(&Selector::parse("span.tie-icon-calendar").unwrap())
                    .next()
                    .is_some()
                {
                    event.datetime_str_raw_detail = Some(text_content.clone());
                    let (start_dt, end_dt) = parse_event_datetimes(
                        event.list_date.as_deref(),
                        event.datetime_str_raw_detail.as_deref(),
                    );
                    event.start_datetime = start_dt;
                    event.end_datetime = end_dt;
                } else if li_element
                    .select(&Selector::parse("span.tie-icon-euro").unwrap())
                    .next()
                    .is_some()
                {
                    event.price = Some(text_content.clone());
                } else if li_element
                    .select(&Selector::parse("span.tie-icon-pin").unwrap())
                    .next()
                    .is_some()
                {
                    event.specific_location_name = Some(text_content.clone());
                }
            }
        }
    }

    // --- Scrape Address Block ---
    let address_block_selector =
        Selector::parse("div[itemprop='address'][itemtype='https://schema.org/PostalAddress']")
            .map_err(|e| format!("Failed to parse address_block: {:?}", e))?;
    if let Some(address_block) = document.select(&address_block_selector).next() {
        let street = address_block
            .select(&Selector::parse("span[itemprop='streetAddress']").unwrap())
            .next()
            .map(|el| get_element_text(&el));
        let postal_code = address_block
            .select(&Selector::parse("span[itemprop='postalCode']").unwrap())
            .next()
            .map(|el| get_element_text(&el));
        let locality = address_block
            .select(&Selector::parse("span[itemprop='addressLocality']").unwrap())
            .next()
            .map(|el| get_element_text(&el));

        let mut address_parts: Vec<String> = Vec::new();
        if let Some(loc_name) = &event.specific_location_name {
            address_parts.push(loc_name.clone());
        } else if let Some(list_loc) = &event.list_specific_location {
            address_parts.push(list_loc.clone());
        }
        if let Some(s) = street {
            if !address_parts.contains(&s) {
                address_parts.push(s);
            }
        }
        if let Some(pc) = postal_code {
            address_parts.push(pc);
        }
        if let Some(l) = locality {
            address_parts.push(l);
        }

        if !address_parts.is_empty() {
            event.address = Some(address_parts.join(", "));
        }
    }

    // --- Scrape Coordinates from div's data-src attribute ---
    let maps_container_selector_str = "div.maps-container[data-src]";
    let maps_container_selector = Selector::parse(maps_container_selector_str).map_err(|e| {
        format!(
            "Failed to parse maps_container selector '{}': {:?}",
            maps_container_selector_str, e
        )
    })?;

    if let Some(maps_container_element) = document.select(&maps_container_selector).next() {
        if let Some(data_src_attr) = maps_container_element.value().attr("data-src") {
            match Url::parse(data_src_attr) {
                Ok(parsed_url) => {
                    for (key, value) in parsed_url.query_pairs() {
                        if key == "center" {
                            let coords: Vec<&str> = value.split(',').collect();
                            if coords.len() == 2 {
                                if let (Ok(lat), Ok(lon)) =
                                    (coords[0].parse::<f64>(), coords[1].parse::<f64>())
                                {
                                    event.latitude = Some(lat);
                                    event.longitude = Some(lon);
                                    break;
                                }
                            }
                        }
                    }
                    if event.latitude.is_none() {
                        // Fallback to 'q' parameter
                        for (key, value) in parsed_url.query_pairs() {
                            if key == "q" {
                                let coords: Vec<&str> = value.split(',').collect();
                                if coords.len() == 2 {
                                    if let (Ok(lat), Ok(lon)) =
                                        (coords[0].parse::<f64>(), coords[1].parse::<f64>())
                                    {
                                        if (-90.0..=90.0).contains(&lat)
                                            && (-180.0..=180.0).contains(&lon)
                                        {
                                            event.latitude = Some(lat);
                                            event.longitude = Some(lon);
                                            break;
                                        }
                                    }
                                }
                                break;
                            }
                        }
                    }
                }
                Err(e) => log::warn!(
                    "Failed to parse maps_container data-src URL '{}': {:?}",
                    data_src_attr,
                    e
                ),
            }
        }
    }

    // --- Scrape Ticket URL ---
    let ticket_button_container_selector = Selector::parse("div.card-hero-metadata__buttons-inner")
        .map_err(|e| format!("Failed to parse ticket_button_container_selector: {:?}", e))?;

    if let Some(buttons_inner_div) = document.select(&ticket_button_container_selector).next() {
        let ticket_link_selector =
            Selector::parse("a.button[href]")
                .map_err(|e| format!("Failed to parse ticket_link_selector: {:?}", e))?;

        for link_element in buttons_inner_div.select(&ticket_link_selector) {
            let link_text = get_element_text(&link_element).to_lowercase();
            if link_text.contains("buy ticket") || link_text.contains("tickets") {
                if let Some(href) = link_element.value().attr("href") {
                    if !href.trim().is_empty() {
                        event.ticket_url = Some(href.trim().to_string());
                        log::info!(
                            "Found ticket URL for '{}': {}",
                            event.title,
                            event.ticket_url.as_ref().unwrap()
                        );
                        break; 
                    }
                }
            }
        }
        // Fallback removed:
        // // Fallback if the text check didn't work but there's only one prominent button
        // if event.ticket_url.is_none() {
        //     if let Some(link_element) = buttons_inner_div.select(&ticket_link_selector).next() {
        //         if let Some(href) = link_element.value().attr("href") {
        //             if !href.trim().is_empty() {
        //                 event.ticket_url = Some(href.trim().to_string());
        //                 log::info!(
        //                     "Found fallback ticket URL for '{}': {}",
        //                     event.title,
        //                     event.ticket_url.as_ref().unwrap()
        //                 );
        //             }
        //         }
        //     }
        // }
    } else {
        log::warn!("Ticket button container 'div.card-hero-metadata__buttons-inner' not found for event '{}'", event.title);
    }
    // --- End Scrape Ticket URL ---

    Ok(event)
}

pub(super) fn get_all_events_with_details_internal_testing() -> Result<Vec<Event>, Box<dyn Error>> {
    log::info!("INTERNAL TESTING: Starting to fetch all events with details...");
    let client = Client::builder()
        .user_agent(USER_AGENT_FOR_SCRAPING_INTERNAL_TEST)
        .timeout(std::time::Duration::from_secs(15))
        .build()?;
    let event_summaries = fetch_event_list_summaries(&client, None, false, |_| {})?;
    let mut detailed_events = Vec::new();
    for summary in event_summaries {
        match fetch_event_details(&client, summary) {
            Ok(detailed_event) => detailed_events.push(detailed_event),
            Err(e) => log::error!("INTERNAL TESTING: Error fetching details: {}", e),
        }
    }
    log::info!(
        "INTERNAL TESTING: Finished. Total detailed events: {}",
        detailed_events.len()
    );
    Ok(detailed_events)
}