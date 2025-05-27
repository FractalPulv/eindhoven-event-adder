# event_app.py
import customtkinter as ctk
from tkinter import filedialog, messagebox
from ics import Calendar, Event

import scraper_service

class EventApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("Eindhoven Event Manager")
        self.geometry("750x600")

        ctk.set_appearance_mode("System")
        ctk.set_default_color_theme("blue")

        self.top_frame = ctk.CTkFrame(self, height=50)
        self.top_frame.pack(fill="x", padx=10, pady=(10,5))

        # Button now calls a direct fetch method
        self.fetch_button = ctk.CTkButton(self.top_frame, text="Fetch Events", command=self.fetch_event_list_directly)
        self.fetch_button.pack(side="left", padx=10, pady=10)

        self.status_label = ctk.CTkLabel(self.top_frame, text="Welcome! Click 'Fetch Events'.")
        self.status_label.pack(side="left", padx=10, pady=10)

        self.scrollable_event_frame = ctk.CTkScrollableFrame(self)
        self.scrollable_event_frame.pack(fill="both", expand=True, padx=10, pady=(5,10))

        self.event_widgets = []

    def display_events(self, events_summary_data):
        for widget_set in self.event_widgets:
            widget_set['frame'].destroy()
        self.event_widgets.clear()

        if not events_summary_data:
            no_event_label = ctk.CTkLabel(self.scrollable_event_frame, text="No events found or an error occurred.")
            no_event_label.pack(pady=20)
            self.event_widgets.append({'frame': no_event_label})
            return

        for event_summary in events_summary_data:
            event_item_frame = ctk.CTkFrame(self.scrollable_event_frame)
            event_item_frame.pack(fill="x", pady=5, padx=5)

            title_text = event_summary.get('title', 'Title N/A')
            date_text = event_summary.get('date_time_summary', 'Date N/A') 

            title_label = ctk.CTkLabel(event_item_frame, text=title_text, anchor="w", font=ctk.CTkFont(size=14, weight="bold"))
            title_label.pack(fill="x", padx=10, pady=(5,2))

            date_label = ctk.CTkLabel(event_item_frame, text=f"{date_text}", anchor="w")
            date_label.pack(fill="x", padx=10, pady=(0,5))
            
            url_suffix = event_summary.get('url_suffix')
            if url_suffix: 
                add_cal_button = ctk.CTkButton(
                    event_item_frame,
                    text="Add to Calendar",
                    command=lambda suffix=url_suffix: self.add_to_calendar_direct_detail_fetch(suffix)
                )
                add_cal_button.pack(pady=5, padx=10, anchor="e")
            
            self.event_widgets.append({'frame': event_item_frame})

        self.status_label.configure(text=f"Displayed {len(events_summary_data)} event summaries.")

    def fetch_event_list_directly(self):
        self.status_label.configure(text="Fetching event list...")
        self.fetch_button.configure(state="disabled")
        self.update_idletasks() # Allow UI to update status label and button state

        events_list = [] # Initialize
        try:
            # Direct call to the scraper service
            events_list = scraper_service.get_event_list_from_web()
        except Exception as e:
            print(f"Error during direct fetch_event_list: {e}")
            self.status_label.configure(text=f"Error fetching list: {e}")
            # Potentially show a messagebox here too
            # messagebox.showerror("Fetch Error", f"Could not fetch event list: {e}")
        finally:
            self.display_events(events_list) # Display whatever was fetched (or empty list)
            self.fetch_button.configure(state="normal")
            if not events_list and not isinstance(e, NameError): # Avoid double message if error already shown
                 if self.status_label.cget("text").startswith("Error fetching list:"): # check if error already shown
                    pass
                 else:
                    self.status_label.configure(text="Finished fetching. No events found or error.")


    def add_to_calendar_direct_detail_fetch(self, event_url_suffix):
        if not event_url_suffix:
            self.status_label.configure(text="Error: Event URL suffix is missing.")
            messagebox.showerror("Error", "Event URL suffix is missing.")
            return

        self.status_label.configure(text="Getting details for event...")
        # Disable button or show progress? For now, direct call might briefly freeze.
        self.fetch_button.configure(state="disabled") # Disable main fetch button too
        # Find the specific "Add to Calendar" button if possible to disable it
        self.update_idletasks()

        details = None
        try:
            details = scraper_service.get_event_details_from_web(event_url_suffix) 
            if not details:
                error_msg = "Could not retrieve event details (scraper returned None)."
                messagebox.showerror("Error", error_msg)
                self.status_label.configure(text=error_msg)
                return

            if not details.get('start_datetime'):
                error_msg = "Event details retrieved, but start date/time is missing or invalid."
                messagebox.showerror("Error", error_msg)
                self.status_label.configure(text=error_msg)
                return

            cal = Calendar()
            event_obj = Event()
            event_obj.name = details['title']
            event_obj.begin = details['start_datetime']
            if details.get('end_datetime'):
                event_obj.end = details['end_datetime']
            event_obj.location = details.get('address', 'N/A')
            description_parts = [details.get('description', '')]
            if details.get('price', 'N/A') != 'N/A':
                description_parts.append(f"Price: {details['price']}")
            description_parts.append(f"More Info: {details['url']}")
            event_obj.description = "\n\n".join(filter(None, description_parts))
            event_obj.url = details['url']
            cal.events.add(event_obj)

            safe_title = "".join(c if c.isalnum() else "_" for c in details['title'][:30]) 
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
                messagebox.showinfo("Success", f"Event '{details['title']}' saved to {filepath.split('/')[-1]}")
            else:
                self.status_label.configure(text="Save cancelled.")
        except Exception as e:
            print(f"Error in add_to_calendar_direct_detail_fetch: {e}")
            import traceback
            traceback.print_exc()
            messagebox.showerror("Error", f"Could not generate calendar file: {e}")
            self.status_label.configure(text=f"Error generating .ics: {e}")
        finally:
            self.fetch_button.configure(state="normal") # Re-enable main fetch button
            # Re-enable specific "Add to Calendar" button if you implement that logic

if __name__ == "__main__":
    app = EventApp()
    app.mainloop()