# event_app.py
import customtkinter as ctk
from tkinter import filedialog, messagebox
from ics import Calendar, Event
# from PIL import Image, ImageTk # For images later
# import requests # For images later
# import io # For images later

import scraper_service # Ensure scraper_service.py is the new one

class EventApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("Eindhoven Event Manager")
        self.geometry("850x700") # Made a bit wider for more info

        ctk.set_appearance_mode("System")
        ctk.set_default_color_theme("blue")

        self.top_frame = ctk.CTkFrame(self, height=50)
        self.top_frame.pack(fill="x", padx=10, pady=(10,5))

        self.fetch_button = ctk.CTkButton(self.top_frame, text="Fetch Events", command=self.fetch_event_list_directly)
        self.fetch_button.pack(side="left", padx=10, pady=10)

        self.status_label = ctk.CTkLabel(self.top_frame, text="Welcome! Click 'Fetch Events'.")
        self.status_label.pack(side="left", padx=10, pady=10)

        self.scrollable_event_frame = ctk.CTkScrollableFrame(self)
        self.scrollable_event_frame.pack(fill="both", expand=True, padx=10, pady=(5,10))

        self.event_widgets = []
        # self.image_references = [] # To prevent garbage collection of images

    def display_events(self, all_events_data): # Renamed for clarity
        # self.image_references.clear() # Clear old image references
        for widget_set in self.event_widgets:
            widget_set['frame'].destroy()
        self.event_widgets.clear()

        if not all_events_data:
            no_event_label = ctk.CTkLabel(self.scrollable_event_frame, text="No events found or an error occurred.")
            no_event_label.pack(pady=20)
            self.event_widgets.append({'frame': no_event_label})
            return

        for event_data in all_events_data: # Iterate through richer data
            event_item_frame = ctk.CTkFrame(self.scrollable_event_frame)
            event_item_frame.pack(fill="x", pady=5, padx=5)

            # Main content frame (text)
            text_content_frame = ctk.CTkFrame(event_item_frame, fg_color="transparent")
            text_content_frame.pack(side="left", fill="x", expand=True, padx=(10,5))

            title_text = event_data.get('title', 'Title N/A')
            # Use list_date as the primary display date, detail page refines time for .ics
            date_text = event_data.get('list_date') or event_data.get('date_time_summary', 'Date N/A') 
            short_desc_text = event_data.get('short_description', '')
            location_text = event_data.get('list_specific_location', '')
            price_text = event_data.get('list_price', '')

            title_label = ctk.CTkLabel(text_content_frame, text=title_text, anchor="w", font=ctk.CTkFont(size=16, weight="bold"))
            title_label.pack(fill="x", pady=(5,2))

            if date_text != 'N/A' and date_text: # Don't show if truly N/A
                date_label = ctk.CTkLabel(text_content_frame, text=f"Date: {date_text}", anchor="w", font=ctk.CTkFont(size=12))
                date_label.pack(fill="x")
            
            if location_text != 'N/A' and location_text:
                loc_label = ctk.CTkLabel(text_content_frame, text=f"Location: {location_text}", anchor="w", font=ctk.CTkFont(size=12))
                loc_label.pack(fill="x")

            if price_text != 'N/A' and price_text:
                price_label = ctk.CTkLabel(text_content_frame, text=f"Price: {price_text}", anchor="w", font=ctk.CTkFont(size=12))
                price_label.pack(fill="x")

            if short_desc_text:
                desc_label = ctk.CTkLabel(text_content_frame, text=short_desc_text, anchor="w", wraplength=550, justify="left", font=ctk.CTkFont(size=12))
                desc_label.pack(fill="x", pady=(3,0))
            
            # Button frame
            button_frame = ctk.CTkFrame(event_item_frame, fg_color="transparent")
            button_frame.pack(side="right", padx=(0,10), pady=5, anchor="center")
            
            # Pass the whole event_data dictionary, which now contains list-scraped info
            if event_data.get('url_suffix'): 
                add_cal_button = ctk.CTkButton(
                    button_frame,
                    text="Add to Calendar",
                    command=lambda data=event_data: self.add_to_calendar_augment_detail(data)
                )
                add_cal_button.pack() # Let it size itself
            
            self.event_widgets.append({'frame': event_item_frame})

        self.status_label.configure(text=f"Displayed {len(all_events_data)} events.")

    def fetch_event_list_directly(self):
        self.status_label.configure(text="Fetching event list...")
        self.fetch_button.configure(state="disabled")
        self.update_idletasks()

        fetched_events_list = []
        try:
            fetched_events_list = scraper_service.get_event_list_from_web()
        except Exception as e:
            print(f"Error during direct fetch_event_list: {e}")
            self.status_label.configure(text=f"Error fetching list: {e}")
            messagebox.showerror("Fetch Error", f"Could not fetch event list: {e}")
        finally:
            self.display_events(fetched_events_list) 
            self.fetch_button.configure(state="normal")
            if not fetched_events_list and not self.status_label.cget("text").startswith("Error"):
                 self.status_label.configure(text="Finished. No events found or issue during parsing.")

    def add_to_calendar_augment_detail(self, event_data_from_list):
        url_suffix = event_data_from_list.get('url_suffix')
        if not url_suffix: # Should not happen if button is present
            messagebox.showerror("Error", "Event URL suffix is missing.")
            return

        self.status_label.configure(text="Getting precise details & generating .ics...")
        self.fetch_button.configure(state="disabled") 
        self.update_idletasks()

        try:
            # Now, get_event_details_from_web will take the existing data and try to augment it
            full_details = scraper_service.get_event_details_from_web(event_data_from_list) 

            if not full_details: # Scraper might return original data on error
                error_msg = "Could not augment event details from detail page."
                messagebox.showerror("Error", error_msg)
                self.status_label.configure(text=error_msg)
                return

            # Critical check: start_datetime MUST be a datetime object
            if not isinstance(full_details.get('start_datetime'), datetime):
                error_msg = "Precise start date/time could not be determined from detail page. Cannot create calendar event."
                print(f"  Problematic start_datetime: {full_details.get('start_datetime')}")
                print(f"  Raw date from list: {full_details.get('list_date')}, Raw time from detail: {full_details.get('datetime_str_raw_detail')}")
                messagebox.showerror("Error", error_msg)
                self.status_label.configure(text=error_msg)
                return

            cal = Calendar()
            event_obj = Event()
            event_obj.name = full_details['title']
            event_obj.begin = full_details['start_datetime']
            
            if isinstance(full_details.get('end_datetime'), datetime):
                event_obj.end = full_details['end_datetime']
            
            event_obj.location = full_details.get('address') or full_details.get('list_specific_location', 'N/A')
            
            # Use detailed description if available, else short, else N/A
            description_to_use = full_details.get('description') if full_details.get('description', 'N/A') != 'N/A' \
                                 else full_details.get('short_description', 'No description available.')

            description_parts = [description_to_use]
            price_to_use = full_details.get('price') or full_details.get('list_price', 'N/A')
            if price_to_use != 'N/A':
                description_parts.append(f"Price: {price_to_use}")
            description_parts.append(f"More Info: {full_details['url']}") # URL comes from detail fetch context
            event_obj.description = "\n\n".join(filter(None, description_parts))
            event_obj.url = full_details['url']
            
            cal.events.add(event_obj)
            safe_title = "".join(c if c.isalnum() else "_" for c in full_details['title'][:30]) 
            initial_filename = f"{safe_title}.ics"
            filepath = filedialog.asksaveasfilename(
                defaultextension=".ics",
                filetypes=[("iCalendar files", "*.ics"), ("All files", "*.*")],
                title="Save Calendar Event",
                initialfile=initial_filename
            )
            if filepath:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.writelines(cal.serialize_iter())
                self.status_label.configure(text=f"Event saved: {filepath.split('/')[-1]}")
                messagebox.showinfo("Success", f"Event '{full_details['title']}' saved to {filepath.split('/')[-1]}")
            else:
                self.status_label.configure(text="Save cancelled.")
        except Exception as e:
            print(f"Error in add_to_calendar_augment_detail: {e}")
            import traceback
            traceback.print_exc()
            messagebox.showerror("Error", f"Could not generate calendar file: {e}")
            self.status_label.configure(text=f"Error generating .ics: {e}")
        finally:
            self.fetch_button.configure(state="normal")

if __name__ == "__main__":
    app = EventApp()
    app.mainloop()