# event_app.py
import customtkinter as ctk
from tkinter import filedialog, messagebox
from ics import Calendar, Event
from PIL import Image, ImageTk # For images
import requests # For fetching image data
import io # For handling image data in memory

import scraper_service 

class EventApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("Eindhoven Event Manager")
        self.geometry("900x750") # Wider for images

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
        self.image_references = [] # IMPORTANT: To prevent garbage collection of CTkImage objects

    def display_events(self, all_events_data):
        self.image_references.clear() # Clear old image references
        for widget_set in self.event_widgets:
            widget_set['frame'].destroy()
        self.event_widgets.clear()

        if not all_events_data:
            # ... (no_event_label as before) ...
            no_event_label = ctk.CTkLabel(self.scrollable_event_frame, text="No events found or an error occurred.")
            no_event_label.pack(pady=20)
            self.event_widgets.append({'frame': no_event_label})
            return

        for event_data in all_events_data:
            event_item_frame = ctk.CTkFrame(self.scrollable_event_frame) # Main frame for one event
            event_item_frame.pack(fill="x", pady=7, padx=5)

            # --- Image Frame (Left) ---
            image_frame = ctk.CTkFrame(event_item_frame, width=150, fg_color="transparent") # Fixed width for image
            image_frame.pack(side="left", padx=(5,10), pady=5, fill="y") # fill y to center vertically
            image_frame.pack_propagate(False) # Prevent frame from shrinking to image size

            img_url = event_data.get('image_url')
            if img_url:
                try:
                    # Fetch image data
                    # Add User-Agent as some sites block default requests User-Agent
                    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'}
                    img_response = requests.get(img_url, stream=True, timeout=5, headers=headers)
                    img_response.raise_for_status()
                    image_data = img_response.content
                    
                    pil_image = Image.open(io.BytesIO(image_data))
                    
                    # Resize image to fit nicely, maintaining aspect ratio
                    max_width = 140
                    max_height = 140 # Adjust if needed
                    pil_image.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
                    
                    ctk_image = ImageTk.PhotoImage(pil_image) # Use ImageTk for CTk with Pillow
                    
                    img_label = ctk.CTkLabel(image_frame, image=ctk_image, text="")
                    img_label.pack(expand=True) # Center image in its frame
                    self.image_references.append(ctk_image) # Keep reference!
                except Exception as e:
                    print(f"Error loading image {img_url}: {e}")
                    img_label = ctk.CTkLabel(image_frame, text="Img\nErr", width=max_width, height=max_height, fg_color="gray20")
                    img_label.pack(expand=True)
            else:
                # Placeholder if no image URL
                img_label = ctk.CTkLabel(image_frame, text="No\nImage", width=140, height=100, fg_color="gray25") # Placeholder
                img_label.pack(expand=True)


            # --- Content Frame (Center - Text and Button) ---
            content_frame = ctk.CTkFrame(event_item_frame, fg_color="transparent")
            content_frame.pack(side="left", fill="both", expand=True)

            # Text content frame (within content_frame for better layout with button)
            text_content_frame = ctk.CTkFrame(content_frame, fg_color="transparent")
            text_content_frame.pack(side="top", fill="x", expand=True, padx=(0,5)) # Text on top

            title_text = event_data.get('title', 'Title N/A')
            date_text = event_data.get('list_date') or event_data.get('date_time_summary', 'Date N/A') 
            short_desc_text = event_data.get('short_description', '')
            location_text = event_data.get('list_specific_location', '')
            price_text = event_data.get('list_price', '')

            title_label = ctk.CTkLabel(text_content_frame, text=title_text, anchor="w", font=ctk.CTkFont(size=16, weight="bold"))
            title_label.pack(fill="x", pady=(0,2)) # Less pady at top because image centers it

            if date_text != 'N/A' and date_text:
                date_label = ctk.CTkLabel(text_content_frame, text=f"Date: {date_text}", anchor="w", font=ctk.CTkFont(size=12))
                date_label.pack(fill="x")
            
            if location_text != 'N/A' and location_text:
                loc_label = ctk.CTkLabel(text_content_frame, text=f"Location: {location_text}", anchor="w", font=ctk.CTkFont(size=12))
                loc_label.pack(fill="x")

            if price_text != 'N/A' and price_text:
                price_label = ctk.CTkLabel(text_content_frame, text=f"Price: {price_text}", anchor="w", font=ctk.CTkFont(size=12))
                price_label.pack(fill="x")

            if short_desc_text:
                # Adjust wraplength based on available space minus image width and padding
                desc_label = ctk.CTkLabel(text_content_frame, text=short_desc_text, anchor="w", wraplength=self.winfo_width() - 200, justify="left", font=ctk.CTkFont(size=12))
                desc_label.pack(fill="x", pady=(3,5))
            
            # Button frame (within content_frame, below text)
            button_sub_frame = ctk.CTkFrame(content_frame, fg_color="transparent")
            button_sub_frame.pack(side="bottom", fill="x", pady=(5,0), anchor="e")
            
            if event_data.get('url_suffix'): 
                add_cal_button = ctk.CTkButton(
                    button_sub_frame,
                    text="Add to Calendar",
                    command=lambda data=event_data: self.add_to_calendar_augment_detail(data)
                )
                add_cal_button.pack(anchor="e", padx=(0,5)) # Align button to the right within its sub-frame
            
            self.event_widgets.append({'frame': event_item_frame})

        self.status_label.configure(text=f"Displayed {len(all_events_data)} events.")
        self.update_idletasks() # Ensure UI updates before any other operation

    # ... (fetch_event_list_directly and add_to_calendar_augment_detail methods remain the same as your last working version)
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
        if not url_suffix:
            messagebox.showerror("Error", "Event URL suffix is missing.")
            return

        self.status_label.configure(text="Getting precise details & generating .ics...")
        self.fetch_button.configure(state="disabled") 
        self.update_idletasks()

        try:
            full_details = scraper_service.get_event_details_from_web(event_data_from_list) 
            if not full_details:
                error_msg = "Could not augment event details from detail page."
                messagebox.showerror("Error", error_msg)
                self.status_label.configure(text=error_msg)
                return

            if not isinstance(full_details.get('start_datetime'), datetime):
                error_msg = "Precise start date/time could not be determined from detail page."
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
            description_to_use = full_details.get('description') if full_details.get('description', 'N/A') != 'N/A' \
                                 else full_details.get('short_description', 'No description available.')
            description_parts = [description_to_use]
            price_to_use = full_details.get('price') or full_details.get('list_price', 'N/A')
            if price_to_use != 'N/A':
                description_parts.append(f"Price: {price_to_use}")
            description_parts.append(f"More Info: {full_details['url']}")
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