# scraper_service.py
import requests
from bs4 import BeautifulSoup, NavigableString
from datetime import datetime
import re # For parsing image URLs

BASE_URL = "https://www.thisiseindhoven.com"

def get_image_url_from_srcset(srcset):
    """Picks a reasonable image URL from srcset, preferring larger ones or a default."""
    if not srcset:
        return None
    # Split srcset into individual url-descriptor pairs
    sources = [s.strip().split(' ') for s in srcset.split(',')]
    # Example: [['/url1.jpg?width=720&resizemode=force', '720w'], ['/url2.jpg?width=638&resizemode=force', '638w']]
    
    best_url = None
    max_width = 0

    for parts in sources:
        url = parts[0]
        descriptor = parts[-1] # Last part is usually the descriptor like '720w' or '2x'
        
        if descriptor.endswith('w'):
            try:
                width = int(descriptor[:-1])
                if width > max_width:
                    max_width = width
                    best_url = url
            except ValueError:
                pass # Not a width descriptor or malformed
        elif not best_url: # Take the first one if no width descriptors are clear
            best_url = url
            
    return BASE_URL + best_url if best_url else None


def get_event_list_from_web():
    main_page_url = f"{BASE_URL}/en/events"
    print(f"Fetching event list from: {main_page_url}")
    events = []
    try:
        response = requests.get(main_page_url, timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        
        results_container = soup.find('div', class_='results')
        if not results_container:
            print("Warning: 'div class=\"results\"' not found. Searching all 'result-card' links.")
            results_container = soup

        event_cards = results_container.find_all('a', class_='result-card result-card-generic')
        print(f"Found {len(event_cards)} event cards on list page.")

        for card_index, card in enumerate(event_cards):
            print(f"\n--- Processing Card #{card_index + 1} from List View ---")
            event_data = {'title': 'N/A', 'url_suffix': None, 'date_time_summary': 'N/A', 
                          'short_description': 'N/A', 'image_url': None, 
                          'list_specific_location': 'N/A', 'list_date': 'N/A', 'list_price': 'N/A'}

            url_suffix = card.get('href')
            if not url_suffix or not url_suffix.startswith('/en/events/'):
                print(f"  Skipping card with invalid or non-event URL: {url_suffix}")
                continue
            event_data['url_suffix'] = url_suffix
            print(f"  URL Suffix: {url_suffix}")

            # Image
            img_tag = card.find('img', class_='lazyautosizes')
            if img_tag:
                srcset = img_tag.get('data-srcset') or img_tag.get('srcset')
                event_data['image_url'] = get_image_url_from_srcset(srcset)
                print(f"  Image URL: {event_data['image_url']}")
                # Fallback title from alt text if primary title extraction fails later
                if img_tag.get('alt'):
                    event_data['title'] = img_tag.get('alt').strip() # Tentative title

            content_div = card.find('div', class_='result-card-generic__content')
            if content_div:
                print("  Found result-card-generic__content")
                # Title
                title_tag = content_div.find('h3', class_='result-card-generic__title')
                if title_tag:
                    event_data['title'] = title_tag.get_text(strip=True)
                print(f"  Title: {event_data['title']}")

                # Short Description
                desc_p = content_div.find('p')
                if desc_p:
                    event_data['short_description'] = desc_p.get_text(strip=True)
                print(f"  Short Description: {event_data['short_description'][:60]}...")

                # Date Summary on card (often just "Event" or a general category)
                # We'll use the more specific meta-labels below if available
                tag_span = content_div.find('span', class_='tag') 
                if tag_span and tag_span.find('span'): # e.g., <span class="tag ..."><span>Event</span></span>
                    event_data['date_time_summary'] = tag_span.find('span').get_text(strip=True)
                print(f"  Date Summary (tag): {event_data['date_time_summary']}")

                # Meta Labels
                meta_labels_wrap = content_div.find('div', class_='meta-labels-wrap')
                if meta_labels_wrap:
                    print("  Found meta-labels-wrap")
                    for meta_label_div in meta_labels_wrap.find_all('div', class_='meta-label'):
                        icon_span = meta_label_div.find('span', class_=lambda x: x and x.startswith('tie-icon-'))
                        text = meta_label_div.get_text(strip=True) # Gets all text in the div after the icon
                        
                        if icon_span:
                            icon_class = icon_span.get('class', [])
                            # Remove icon text from the main text if needed, though get_text usually handles it
                            # For "<span>icon</span>Actual Text", get_text on parent gives "iconActual Text"
                            # We might need to extract sibling text of the span if icons have text.
                            # Assuming icon itself has no text or its text is ignorable here.
                            # The provided HTML shows icon span is empty of text.

                            if 'tie-icon-pin' in icon_class:
                                event_data['list_specific_location'] = text
                                print(f"    Meta Location: {text}")
                            elif 'tie-icon-calendar' in icon_class: # This is the more specific date from meta
                                event_data['list_date'] = text
                                event_data['date_time_summary'] = text # Update summary with more specific date
                                print(f"    Meta Date: {text}")
                            elif 'tie-icon-euro' in icon_class:
                                event_data['list_price'] = text
                                print(f"    Meta Price: {text}")
            else:
                print("  result-card-generic__content not found.")
            
            events.append(event_data)
        
        if not events:
             print("No valid event data extracted after processing cards. Check list page selectors.")
        return events
    except requests.exceptions.RequestException as e:
        print(f"Error fetching event list page: {e}")
        return []
    except Exception as e:
        print(f"Error parsing event list page: {e}")
        import traceback
        traceback.print_exc()
        return []


def parse_datetime_range(datetime_str_from_card, time_str_from_detail):
    """
    Combines date from card (e.g., "29 May 2025") and time from detail (e.g., "09:00 - 17:00").
    """
    if not datetime_str_from_card or not time_str_from_detail:
        return None, None
    
    print(f"  [ParseDT] Attempting with card_date='{datetime_str_from_card}', detail_time='{time_str_from_detail}'")

    try:
        # Assuming time_str_from_detail is like "09:00 - 17:00" or "09:00"
        time_parts = time_str_from_detail.split(' - ')
        start_time_str = time_parts[0].strip()
        end_time_str = time_parts[1].strip() if len(time_parts) > 1 else None

        start_dt_str = f"{datetime_str_from_card} {start_time_str}"
        start_datetime = datetime.strptime(start_dt_str, "%d %B %Y %H:%M")
        
        end_datetime = None
        if end_time_str:
            end_dt_str = f"{datetime_str_from_card} {end_time_str}"
            end_datetime = datetime.strptime(end_dt_str, "%d %B %Y %H:%M")
        
        print(f"  [ParseDT] Success: Start={start_datetime}, End={end_datetime}")
        return start_datetime, end_datetime
    except ValueError as e:
        print(f"  [ParseDT] ValueError: {e}. Trying to parse date_from_card ('{datetime_str_from_card}') as full date if time_str is also date-like.")
        # Fallback if time_str_from_detail might *also* contain the full date string
        try:
            # Handles case where detail_time might be "29 May 2025, 09:00 - 17:00"
            date_part_detail, time_range_detail = time_str_from_detail.split(',', 1)
            # Compare if date_part_detail matches datetime_str_from_card (could be different format)
            # This is just a simplified fallback, more robust comparison might be needed.
            # For now, assume the detail page time string is the authority if it has full date.
            
            time_parts = time_range_detail.split(' - ')
            start_time_str = time_parts[0].strip()
            end_time_str = time_parts[1].strip() if len(time_parts) > 1 else None

            start_dt_str = f"{date_part_detail.strip()} {start_time_str}"
            start_datetime = datetime.strptime(start_dt_str, "%d %B %Y %H:%M")
            
            end_datetime = None
            if end_time_str:
                end_dt_str = f"{date_part_detail.strip()} {end_time_str}"
                end_datetime = datetime.strptime(end_dt_str, "%d %B %Y %H:%M")
            print(f"  [ParseDT] Success (detail override): Start={start_datetime}, End={end_datetime}")
            return start_datetime, end_datetime
        except Exception as e_inner:
            print(f"  [ParseDT] Inner fallback error: {e_inner}")
            return None, None # Failed all attempts
    except Exception as e:
        print(f"  [ParseDT] Unexpected error: {e}")
        return None, None


def get_event_details_from_web(event_data_from_list):
    """
    Fetches additional details from the event's detail page.
    Primarily looks for precise start/end times and a more detailed description.
    `event_data_from_list` is the dictionary from `get_event_list_from_web`.
    """
    url_suffix = event_data_from_list.get('url_suffix')
    if not url_suffix or not url_suffix.startswith('/'):
        print(f"  [DetailScrape] Invalid event_url_suffix: {url_suffix}")
        return event_data_from_list # Return original data if no URL
        
    full_url = BASE_URL + url_suffix
    print(f"\n  [DetailScrape] Fetching details for {full_url} to augment list data...")
    
    # Start with a copy of the data from the list view
    updated_details = event_data_from_list.copy()
    updated_details.setdefault('start_datetime', None) # Ensure these keys exist
    updated_details.setdefault('end_datetime', None)
    updated_details.setdefault('datetime_str_raw_detail', 'N/A')

    try:
        response = requests.get(full_url, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')

        content_container = soup.find('div', class_='card-hero-metadata__content')
        if not content_container:
            print("    [DetailScrape-Debug] CRITICAL: 'card-hero-metadata__content' div not found. Cannot parse further details.")
            return updated_details # Return data we have so far

        print("    [DetailScrape-Debug] Found 'card-hero-metadata__content'")

        # Update Title if it's more complete (though list one is usually good)
        title_tag_detail = content_container.find('h1')
        if title_tag_detail and title_tag_detail.text.strip():
            updated_details['title'] = title_tag_detail.text.strip() 
            print(f"    [DetailScrape-Debug] Title (detail page): {updated_details['title']}")

        text_div = content_container.find('div', class_='text')
        if text_div:
            print("    [DetailScrape-Debug] Found div.text on detail page")
            # Update Description if detail page has a more complete one
            desc_p_detail = text_div.find('p')
            if desc_p_detail and desc_p_detail.text.strip():
                updated_details['description'] = desc_p_detail.text.strip() # Overwrite short_desc with full
                print(f"    [DetailScrape-Debug] Description (detail page): {updated_details['description'][:100]}...")
            else:
                print("    [DetailScrape-Debug] Did NOT find p for description in div.text on detail page")
            
            list_with_icons = text_div.find('ul', class_='list-with-icons')
            if list_with_icons:
                print("    [DetailScrape-Debug] Found ul.list-with-icons on detail page")
                raw_time_from_detail = None
                for i, li in enumerate(list_with_icons.find_all('li', recursive=False)):
                    print(f"    [DetailScrape-Debug] Processing li #{i+1} from detail page: {str(li)[:100].replace(chr(10),'').strip()}")
                    icon_span = li.find('span', class_=lambda x: x and x.startswith('tie-icon tie-icon-'))
                    if icon_span:
                        actual_text = "".join(node.strip() for node in li.contents if isinstance(node, NavigableString))
                        text_content = actual_text.strip()
                        print(f"      [DetailScrape-Debug] Extracted text_content for li #{i+1}: '{text_content}'")

                        if not text_content: continue

                        if 'tie-icon-calendar' in icon_span.get('class', []): # This is the crucial time string
                            raw_time_from_detail = text_content
                            updated_details['datetime_str_raw_detail'] = text_content
                            print(f"      [DetailScrape-Debug] Found detailed date/time string: '{raw_time_from_detail}'")
                            # Combine with date from list card
                            start_dt, end_dt = parse_datetime_range(event_data_from_list.get('list_date'), raw_time_from_detail)
                            updated_details['start_datetime'] = start_dt
                            updated_details['end_datetime'] = end_dt
                        elif 'tie-icon-euro' in icon_span.get('class', []): # Update price if more specific
                            if text_content != updated_details.get('list_price'):
                                updated_details['price'] = text_content # Potentially overwrite from list if different
                                print(f"      [DetailScrape-Debug] Price (detail page): {text_content}")
                        elif 'tie-icon-pin' in icon_span.get('class', []): # Update location if more specific
                            if text_content != updated_details.get('list_specific_location'):
                                updated_details['specific_location_name'] = text_content
                                print(f"      [DetailScrape-Debug] Specific Location (detail page): {text_content}")
            else:
                print("    [DetailScrape-Debug] Did NOT find ul.list-with-icons in div.text on detail page")
        else:
            print("    [DetailScrape-Debug] Did NOT find div.text on detail page")

        # Address - usually static, but can re-verify if needed. List page might not have full address.
        address_block_div = soup.find('div', itemprop='address', itemtype='https://schema.org/PostalAddress')
        if address_block_div:
            print("    [DetailScrape-Debug] Found address block (itemprop=address) on detail page")
            street = address_block_div.find('span', itemprop='streetAddress')
            postal_code = address_block_div.find('span', itemprop='postalCode')
            locality = address_block_div.find('span', itemprop='addressLocality')
            
            address_parts = []
            # Use specific_location_name from list or detail if available
            loc_name_to_use = updated_details.get('specific_location_name') or updated_details.get('list_specific_location', 'N/A')
            if loc_name_to_use != 'N/A':
                address_parts.append(loc_name_to_use)

            street_text = street.text.strip() if street else ""
            if street_text and street_text not in address_parts:
                 address_parts.append(street_text)
            if postal_code: address_parts.append(postal_code.text.strip())
            if locality: address_parts.append(locality.text.strip())
            
            if address_parts:
                updated_details['address'] = ', '.join(filter(None, address_parts))
                print(f"    [DetailScrape-Debug] Parsed address from detail block: {updated_details['address']}")
        
        return updated_details

    except requests.exceptions.RequestException as e:
        print(f"  [DetailScrape] Error fetching {full_url}: {e}")
        return event_data_from_list # Return original data on error
    except Exception as e:
        print(f"  [DetailScrape] Error parsing {full_url}: {e}")
        import traceback
        traceback.print_exc()
        return event_data_from_list # Return original data on error

if __name__ == '__main__':
    print("--- Testing Event List Parsing ---")
    test_event_list = get_event_list_from_web()
    if test_event_list:
        print(f"\nSuccessfully parsed {len(test_event_list)} events from list page.")
        # Print first event from list parsing
        if len(test_event_list) > 0:
            print("\n--- Data for First Event (from List View Parsing) ---")
            for key, value in test_event_list[0].items():
                print(f"  {key}: {value}")

            # Now, try to get full details for this first event
            print("\n--- Augmenting First Event with Details from its Detail Page ---")
            fully_detailed_event = get_event_details_from_web(test_event_list[0])
            print("\n--- Fully Detailed Data for First Event ---")
            if fully_detailed_event:
                 for key, value in fully_detailed_event.items():
                    print(f"  {key}: {value}")
            else:
                print("  Failed to get full details for the first event.")
    else:
        print("\nNo events found from list page or an error occurred during list parsing.")