// File: src-tauri/src/scraper/utils.rs
use chrono::{NaiveDate, NaiveTime, NaiveDateTime, Datelike, Utc};
use regex::Regex;
use url::Url;
use scraper::ElementRef;
// Remove these lines:
// use geocoding::{Forward, Point, Nominatim}; 

pub(super) const BASE_URL: &str = "https://www.thisiseindhoven.com";
pub(super) const USER_AGENT_FOR_SCRAPING_INTERNAL_TEST: &str = "EindhovenEventViewerInternalTest/0.1 (changeme@example.com)";
// Remove this line:
// pub(super) const NOMINATIM_USER_AGENT: &str = "EindhovenEventViewer/0.1 (your-email@example.com; https://yourappdomain.com)"; 

// get_element_text, make_absolute_url, parse_image_url_from_srcset, parse_event_datetimes
// functions remain the same as before.

// Remove the geocode_address function entirely:
// pub(super) fn geocode_address(address: &str) -> Result<Option<Point<f64>>, Box<dyn std::error::Error>> { ... }
// --- (get_element_text function) ---
pub(super) fn get_element_text(element_ref: &ElementRef) -> String {
    element_ref.text().collect::<String>().trim().to_string()
}

// --- (make_absolute_url function) ---
pub(super) fn make_absolute_url(base: &str, path: &str) -> Option<String> {
    if path.starts_with("http://") || path.starts_with("https://") { return Some(path.to_string()); }
    if path.starts_with("//") { return Some(format!("https:{}", path)); }
    Url::parse(base).ok().and_then(|base_url| base_url.join(path).ok()).map(|full_url| full_url.to_string())
}

// --- (parse_image_url_from_srcset function) ---
pub(super) fn parse_image_url_from_srcset(srcset: &str, base_url_for_relative: &str) -> Option<String> {
    log::debug!("Parsing srcset: {}", srcset);
    let sources: Vec<&str> = srcset.split(',').map(|s| s.trim()).collect();
    let mut best_url: Option<String> = None;
    let mut max_width = 0;
    for src_entry in sources {
        let parts: Vec<&str> = src_entry.split_whitespace().collect();
        if parts.is_empty() { continue; }
        let url_part = parts[0];
        if parts.len() > 1 && parts[1].ends_with('w') {
            if let Ok(width) = parts[1].trim_end_matches('w').parse::<i32>() {
                if width > max_width { max_width = width; best_url = Some(url_part.to_string()); }
            }
        } else if best_url.is_none() { best_url = Some(url_part.to_string()); }
    }
    if let Some(url) = best_url { make_absolute_url(base_url_for_relative, &url) } 
    else { log::warn!("Could not determine a best URL from srcset: {}", srcset); None }
}

// --- (parse_event_datetimes function) ---
pub(super) fn parse_event_datetimes( list_date_opt: Option<&str>, datetime_str_raw_detail_opt: Option<&str>, ) -> (Option<NaiveDateTime>, Option<NaiveDateTime>) {
    let current_year = Utc::now().year();
    log::debug!( "Attempting to parse datetimes with list_date: {:?}, detail_str: {:?}, current_year: {}", list_date_opt, datetime_str_raw_detail_opt, current_year );
    let mut final_date_str_base: Option<String> = None; 
    let mut final_year_override: Option<i32> = None; 
    let mut start_time_str: Option<String> = None;
    let mut end_time_str: Option<String> = None;
    let detail_re = Regex::new( r"(?i)(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*\s+)?(\d{1,2}\s+\w+)(?:\s+(\d{4}))?(?:\s*,\s*)?(?:(?:Starts at\s+)?(\d{2}:\d{2}))?(?:\s*-\s*(\d{2}:\d{2}))?" ).unwrap();
    if let Some(detail_str) = datetime_str_raw_detail_opt {
        if let Some(caps) = detail_re.captures(detail_str) {
            if let Some(date_match) = caps.get(1) { final_date_str_base = Some(date_match.as_str().trim().to_string()); }
            if let Some(year_match) = caps.get(2) { if let Ok(year) = year_match.as_str().trim().parse::<i32>() { final_year_override = Some(year); } }
            if let Some(time_match) = caps.get(3) { start_time_str = Some(time_match.as_str().trim().to_string()); }
            if let Some(time_match) = caps.get(4) { end_time_str = Some(time_match.as_str().trim().to_string()); }
        } else {
            let time_only_re = Regex::new(r"(\d{2}:\d{2})(?:\s*-\s*(\d{2}:\d{2}))?").unwrap();
            if let Some(time_caps) = time_only_re.captures(detail_str) {
                if let Some(time_match) = time_caps.get(1) { start_time_str = Some(time_match.as_str().trim().to_string()); }
                if let Some(time_match) = time_caps.get(2) { end_time_str = Some(time_match.as_str().trim().to_string()); }
            } else { log::warn!("Detail string '{}' did not match any date/time regex.", detail_str); }
        }
    }
    if final_date_str_base.is_none() {
        if let Some(ld_str) = list_date_opt {
            let list_date_re = Regex::new(r"(\d{1,2}\s+\w+)(?:\s+(\d{4}))?").unwrap();
            if let Some(list_caps) = list_date_re.captures(ld_str) {
                if let Some(date_match) = list_caps.get(1) { final_date_str_base = Some(date_match.as_str().trim().to_string());}
                if final_year_override.is_none() { if let Some(year_match) = list_caps.get(2) { if let Ok(year) = year_match.as_str().trim().parse::<i32>() { final_year_override = Some(year); } } }
            } else { log::warn!("List date string '{}' did not match expected format.", ld_str); }
        }
    }
    let year_to_use = final_year_override.unwrap_or(current_year);
    let mut parsed_start_datetime: Option<NaiveDateTime> = None;
    let mut parsed_end_datetime: Option<NaiveDateTime> = None;
    if let Some(date_base_val) = final_date_str_base {
        let date_with_year = format!("{} {}", date_base_val, year_to_use);
        let date_formats = ["%d %B %Y", "%d %b %Y"];
        let mut naive_date_opt: Option<NaiveDate> = None;
        for fmt in &date_formats { if let Ok(parsed_date) = NaiveDate::parse_from_str(&date_with_year, fmt) { naive_date_opt = Some(parsed_date); break; } }
        if let Some(naive_date) = naive_date_opt {
            if let Some(st_str) = start_time_str {
                if let Ok(naive_start_time) = NaiveTime::parse_from_str(&st_str, "%H:%M") {
                    parsed_start_datetime = Some(naive_date.and_time(naive_start_time));
                    if let Some(et_str) = end_time_str {
                        if let Ok(naive_end_time) = NaiveTime::parse_from_str(&et_str, "%H:%M") {
                            let mut end_date_to_use = naive_date;
                            if naive_end_time < naive_start_time { if let Some(next_day) = naive_date.succ_opt() { end_date_to_use = next_day; } }
                            parsed_end_datetime = Some(end_date_to_use.and_time(naive_end_time));
                        }
                    }
                }
            }
        }
    }
    (parsed_start_datetime, parsed_end_datetime)
}