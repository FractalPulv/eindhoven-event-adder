import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import 'leaflet/dist/leaflet.css'; // <-- Add this line globally
import L from 'leaflet'; // Import L

// --- BEGIN Leaflet Icon Fix ---
// Delete the original _getIconUrl to ensure our paths are used
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet-images/marker-icon-2x.png', // Path relative to public folder
  iconUrl: '/leaflet-images/marker-icon.png',        // Path relative to public folder
  shadowUrl: '/leaflet-images/marker-shadow.png',    // Path relative to public folder
});
// --- END Leaflet Icon Fix ---

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);