use serde::{Serialize, Deserialize};
use std::fs;
use std::path::PathBuf;
use chrono::{Utc, DateTime, Duration};

const CACHE_FILE_NAME: &str = "events_cache.json";
const CACHE_LIFETIME_HOURS: i64 = 1; // Cache valid for 1 hour

#[derive(Debug, Serialize, Deserialize)]
pub struct CacheEntry<T> {
    pub timestamp: DateTime<Utc>,
    pub data: T,
}

impl<T: Serialize + for<'de> Deserialize<'de>> CacheEntry<T> {
    pub fn new(data: T) -> Self {
        CacheEntry {
            timestamp: Utc::now(),
            data,
        }
    }

    pub fn is_fresh(&self) -> bool {
        Utc::now().signed_duration_since(self.timestamp) < Duration::hours(CACHE_LIFETIME_HOURS)
    }
}

pub fn get_cache_path() -> Result<PathBuf, String> {
    // Use tauri::api::path::app_data_dir() for a platform-appropriate cache directory
    // For simplicity, let's use a temporary directory or current working directory for now.
    // In a real Tauri app, you'd use tauri::api::path::app_data_dir().
    // For this CLI context, let's use a subdirectory in the current working directory.
    let mut path = std::env::current_dir().map_err(|e| format!("Failed to get current directory: {}", e))?;
    path.push("cache");
    if !path.exists() {
        fs::create_dir_all(&path).map_err(|e| format!("Failed to create cache directory: {}", e))?;
    }
    path.push(CACHE_FILE_NAME);
    Ok(path)
}

pub fn read_cache<T: Serialize + for<'de> Deserialize<'de>>() -> Option<CacheEntry<T>> {
    let cache_path = match get_cache_path() {
        Ok(path) => path,
        Err(e) => {
            log::error!("Failed to get cache path: {}", e);
            return None;
        }
    };

    if cache_path.exists() {
        match fs::read_to_string(&cache_path) {
            Ok(contents) => match serde_json::from_str(&contents) {
                Ok(entry) => {
                    log::info!("Cache read successfully from {:?}", cache_path);
                    Some(entry)
                },
                Err(e) => {
                    log::error!("Failed to deserialize cache: {}. Deleting corrupted cache.", e);
                    // Optionally delete corrupted cache file
                    let _ = fs::remove_file(&cache_path);
                    None
                }
            },
            Err(e) => {
                log::error!("Failed to read cache file {:?}: {}", cache_path, e);
                None
            }
        }
    } else {
        log::info!("Cache file does not exist at {:?}", cache_path);
        None
    }
}

pub fn write_cache<T: Serialize + for<'de> Deserialize<'de>>(entry: &CacheEntry<T>) -> Result<(), String> {
    let cache_path = get_cache_path()?;
    let contents = serde_json::to_string_pretty(entry).map_err(|e| format!("Failed to serialize cache: {}", e))?;
    fs::write(&cache_path, contents).map_err(|e| format!("Failed to write cache file {:?}: {}", cache_path, e))?;
    log::info!("Cache written successfully to {:?}", cache_path);
    Ok(())
}
