# scraper_service.py
import requests
from bs4 import BeautifulSoup
from datetime import datetime

BASE_URL = "https://www.thisiseindhoven.com"

def get_event_list_from_web():
    """
    Scrapes the main event page for event titles, detail URL suffixes, and date summaries.
    """
    main_page_url = f"{BASE_URL}/en/events"
    print(f"Fetching event list from: {main_page_url}")
    try:
        response = requests.get(main_page_url, timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        
        events = []
        # Find the container for all result cards if there's a clear one, or go for individual cards.
        # Based on your image, each card is an <a> with class "result-card result-card-generic"
        # and these are within <div class="col-xs-12 grid-margin-bottom">
        
        # First, look for the 'results' div as a general container
        results_container = soup.find('div', class_='results')
        if not results_container:
            # Fallback if 'results' div is not found, search the whole document
            print("Warning: 'div class=\"results\"' not found. Searching all 'result-card' links.")
            results_container = soup # Search the whole soup object

        event_cards = results_container.find_all('a', class_='result-card result-card-generic')
        
        print(f"Found {len(event_cards)} event cards.")

        for card in event_cards:
            url_suffix = card.get('href')
            if not url_suffix:
                continue

            title = "N/A"
            date_time_summary = "N/A"

            # Try to find title within the card's content
            content_div = card.find('div', class_='result-card-generic__content')
            if content_div:
                title_tag = content_div.find(['h2', 'h3', 'h4', 'h5', 'div'], class_='result-card-generic__title') # Common title tags
                if title_tag:
                    title = title_tag.get_text(strip=True)
                
                # Date summary
                date_span = content_div.find('span', class_='tie-icon-calendar')
                if date_span:
                    date_time_summary = date_span.get_text(strip=True)

            # Fallback for title if not found in content_div, try img alt attribute
            if title == "N/A":
                img_tag = card.find('img')
                if img_tag and img_tag.get('alt'):
                    title = img_tag.get('alt').strip()
            
            if url_suffix.startswith('http'): # If it's an absolute URL
                print(f"Skipping external or full URL event card: {url_suffix}")
                continue
            if not url_suffix.startswith("/en/events/"): # Ensure it's an event path
                print(f"Skipping non-event path: {url_suffix}")
                continue


            events.append({
                'title': title,
                'url_suffix': url_suffix,
                'date_time_summary': date_time_summary
            })
        
        if not events and not event_cards:
             print("No event cards found with class 'result-card result-card-generic'. Check selectors.")
        elif not events and event_cards:
             print("Event cards were found, but no valid event data extracted. Check inner selectors for title/date/URL.")


        return events
    except requests.exceptions.RequestException as e:
        print(f"Error fetching event list page: {e}")
        return []
    except Exception as e:
        print(f"Error parsing event list page: {e}")
        # import traceback
        # traceback.print_exc()
        return []


def parse_datetime_range(datetime_str):
    try:
        # Handles "29 May 2025, 09:00 - 17:00"
        date_part_str, time_range_str = datetime_str.split(',', 1)
        date_part_str = date_part_str.strip()
        
        start_time_str, end_time_str = time_range_str.split(' - ')
        start_time_str = start_time_str.strip()
        end_time_str = end_time_str.strip()

        start_dt_str = f"{date_part_str} {start_time_str}"
        end_dt_str = f"{date_part_str} {end_time_str}"

        start_datetime = datetime.strptime(start_dt_str, "%d %B %Y %H:%M")
        end_datetime = datetime.strptime(end_dt_str, "%d %B %Y %H:%M")
        return start_datetime, end_datetime
    except ValueError as e:
        print(f"Error parsing date/time string '{datetime_str}': {e}")
        # Add more formats if needed, e.g. if only one time is present
        try: # Example: "29 May 2025, 09:00" (assuming end time is same or not specified)
            dt_str = datetime_str.replace(',', '').strip() # "29 May 2025 09:00"
            dt_obj = datetime.strptime(dt_str, "%d %B %Y %H:%M")
            return dt_obj, None # Or handle as needed
        except ValueError:
            pass # Could not parse with alternative
        return None, None
    except Exception as e:
        print(f"Unexpected error parsing date/time string '{datetime_str}': {e}")
        return None, None


def get_event_details_from_web(event_url_suffix):
    if not event_url_suffix or not event_url_suffix.startswith('/'):
        print(f"Invalid event_url_suffix: {event_url_suffix}")
        return None
        
    full_url = BASE_URL + event_url_suffix
    print(f"Fetching details for {full_url}...")
    try:
        response = requests.get(full_url, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')

        details = {'url': full_url}

        title_tag = soup.find('h1')
        details['title'] = title_tag.text.strip() if title_tag else 'N/A'

        text_div = soup.find('div', class_='text')
        if text_div:
            desc_p = text_div.find('p')
            details['description'] = desc_p.text.strip() if desc_p else 'N/A'
            
            list_with_icons = text_div.find('ul', class_='list-with-icons')
            if list_with_icons:
                for li in list_with_icons.find_all('li', recursive=False):
                    icon_span = li.find('span', class_=lambda x: x and x.startswith('tie-icon tie-icon-'))
                    if icon_span:
                        # Extract text from li, excluding the icon span itself
                        actual_text = ""
                        for elem in li.contents:
                            if isinstance(elem, str): # NavigableString (text node)
                                actual_text += elem.strip()
                            elif elem.name != 'span': # Any other tag that's not the icon span
                                actual_text += elem.get_text(strip=True)
                        text_content = actual_text.strip()

                        if not text_content: # Skip if no text found after span
                            continue

                        if 'tie-icon-calendar' in icon_span.get('class', []):
                            details['datetime_str_raw'] = text_content
                            start_dt, end_dt = parse_datetime_range(text_content)
                            details['start_datetime'] = start_dt
                            details['end_datetime'] = end_dt
                        elif 'tie-icon-euro' in icon_span.get('class', []):
                            details['price'] = text_content
                        elif 'tie-icon-pin' in icon_span.get('class', []):
                            details['specific_location_name'] = text_content
        
        details.setdefault('description', 'N/A')
        details.setdefault('start_datetime', None)
        details.setdefault('end_datetime', None)
        details.setdefault('datetime_str_raw', 'N/A')
        details.setdefault('price', 'N/A')
        details.setdefault('specific_location_name', 'N/A')

        address_div = soup.find('div', itemprop='address', itemtype='https://schema.org/PostalAddress')
        address_parts = []
        if details['specific_location_name'] != 'N/A':
             # Prefer specific name if available, unless it's already part of streetAddress.
            address_parts.append(details['specific_location_name'])

        if address_div:
            street = address_div.find('span', itemprop='streetAddress')
            postal_code = address_div.find('span', itemprop='postalCode')
            locality = address_div.find('span', itemprop='addressLocality')
            
            street_text = street.text.strip() if street else ""
            
            # Avoid duplicating specific_location_name if it's the same as street_text
            if not (details['specific_location_name'] != 'N/A' and details['specific_location_name'] == street_text):
                if street_text: address_parts.append(street_text)
            elif not address_parts: # if specific_location_name was the same and parts is empty
                 if street_text: address_parts.append(street_text)


            if postal_code: address_parts.append(postal_code.text.strip())
            if locality: address_parts.append(locality.text.strip())
            
            details['address'] = ', '.join(filter(None, address_parts))
        elif not address_parts: # If address_div not found and no specific_location_name yet
            details['address'] = 'N/A'
        else: # If address_div not found but we had specific_location_name
            details['address'] = ', '.join(filter(None, address_parts))


        return details

    except requests.exceptions.RequestException as e:
        print(f"Error fetching {full_url}: {e}")
        return None
    except Exception as e:
        print(f"Error parsing {full_url}: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == '__main__':
    print("--- Testing Event List ---")
    test_event_list = get_event_list_from_web()
    if test_event_list:
        print(f"Found {len(test_event_list)} events from list page.")
        for i, event_item in enumerate(test_event_list[:3]): # Print first 3
            print(f"  {i+1}. Title: {event_item['title']}, URL Suffix: {event_item['url_suffix']}, Date Summary: {event_item['date_time_summary']}")
        
        print(f"\n--- Testing Event Details for first event: {test_event_list[0]['url_suffix']} ---")
        test_details = get_event_details_from_web(test_event_list[0]['url_suffix'])
        if test_details:
            for key, value in test_details.items():
                print(f"  {key}: {value}")
        else:
            print("  Failed to get event details for the first event.")
    else:
        print("No events found from list page or an error occurred.")