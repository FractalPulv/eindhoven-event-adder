# Eindhoven Event Finder

Just a little desktop app to find out what's happening in Eindhoven. It grabs event info from "thisiseindhoven.com" and shows it in a list or on a map.

## Screenshots

**List View:**
![Event List View](https://i.imgur.com/3T7VNOe.png)

**Event Details Overlay:**
![Event Detail Overlay](https://i.imgur.com/lBkFTcQ.png)

**Map View:**
![Map View with Event Markers](https://i.imgur.com/Q9CYHKb.png)

## What it does (the new version)

*   **Two Ways to See Events:**
    *   **List View:** Simple cards with event basics.
    *   **Map View:** Events plotted on a map so you can see where they are.
*   **Event Details:**
    *   Click an event, and a panel pops up with more info.
    *   Big image at the top, full description, date, time, location, price.
    *   Little map in the panel too.
*   **Loads Quick:** Shows summaries first, then gets the full details when you click.
*   **Add to Your Calendar:** Makes an `.ics` file you can import into Google Calendar, Outlook, etc.
*   **Links:**
    *   "Buy Tickets" button if there's a link.
    *   "Open Original Page" button to see it on the source site.
*   **Front end:**
    *   Uses React, TypeScript, and Tailwind CSS.
    *   Has a light and dark mode.
*   **Back end:**
    *   Rust does the scraping and data stuff.
    *   Tauri makes it a desktop app.
    *   Gets map coordinates and ticket links directly from the site.
*   **Works On:** Windows, macOS, Linux (thanks to Tauri).

## Why This New Version? (Old Python One Had Issues)

The first try was in Python with CustomTkinter. It worked, but...

*   **No Map:** You couldn't really see where events were.
    *   *Now:* There's a proper map view.
*   **Adding to Calendar Was Clunky:** Getting all the details right for the calendar file was a bit of a pain.
    *   *Now:* It's much smoother. Click a button, save the file.
*   **UI Was a Bit Basic:** The old one looked... functional. This one tries to be a bit nicer.
*   **Speed & Stuff:** Rust should be faster, and the new setup is hopefully easier to work on.

## Tech Used

*   **Backend:** Rust (`reqwest`, `scraper`, `chrono`)
*   **Desktop:** Tauri v2
*   **Frontend:** React, TypeScript
*   **Styling:** Tailwind CSS v4
*   **Map:** Leaflet.js
*   **Build:** Vite

## How to Run It (If You Want To)

1.  **Need:**
    *   Node.js (npm/yarn/pnpm)
    *   Rust & Cargo
    *   Tauri setup stuff (check their docs: [Tauri Prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites))

2.  **Get the code:**
    ```zsh
    git clone <repository-url>
    cd <repository-name>
    ```

3.  **Install frontend bits:**
    ```zsh
    npm install
    ```

4.  **Run for development:**
    ```zsh
    npm run tauri dev
    ```

5.  **Build it for real:**
    ```zsh
    npm run tauri build
    ```
    Find the app in `src-tauri/target/release/bundle/`.

## What's Next (Maybe)

*   Make sure calendar files work everywhere.
*   Better error messages.
*   Maybe some filters (date, price).
*   Clean up the map if too many events are close together.

## Heads-Ups

*   If "thisiseindhoven.com" changes its website, the scraper might break.
*   Dates and times from websites can be weird to parse.

## Contributing

Sure, if you have ideas or find bugs, feel free to open an issue or PR.

## Note

To be honest, I only spent about a day and a half on this project and speedran it with some help from the new Gemini model. I’m not sure if I’ll continue working on it — I might even consider turning the concept into a browser extension instead.