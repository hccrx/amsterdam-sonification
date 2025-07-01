# Urban Form Sonification

An interactive web application that explores Amsterdam's urban environments through both sight and sound.

## ⚠️ IMPORTANT: Setup Required

**This application cannot be run by simply opening the HTML file.** It requires a web server due to security restrictions with loading data files.

## Quick Setup Instructions

### Option 1: Using Python (Recommended)
1. Download or clone this repository
2. Open Terminal/Command Prompt
3. Navigate to the project folder: `cd path/to/your/project`
4. Run a local server:
   - **Python 3:** `python -m http.server 8000`
   - **Python 2:** `python -m SimpleHTTPServer 8000`
5. Open your browser and go to: `http://localhost:8000/urban-sonification-app.html`

### Option 2: Using Node.js
1. Install [Node.js](https://nodejs.org/)
2. Install http-server: `npm install -g http-server`
3. Navigate to project folder in terminal
4. Run: `http-server`
5. Open the URL shown in the terminal

### Option 3: Using VS Code Live Server
1. Install [Visual Studio Code](https://code.visualstudio.com/)
2. Install the "Live Server" extension
3. Open the project folder in VS Code
4. Right-click on `urban-sonification-app.html`
5. Select "Open with Live Server"

## Online Demo
[If deployed to GitHub Pages, add link here]

## Troubleshooting

### Common Issues:
- **Blank map or missing layers:** You're probably opening the file directly. Use a web server.
- **Console errors about CORS:** Use a web server, don't open the HTML file directly.
- **"file:// protocol" error:** This confirms you need a web server.

### Browser Console:
Press F12 to open browser developer tools and check the Console tab for error messages.

## File Structure
/
├── urban-sonification-app.html    # Main application
├── map-sound-connector.js          # Map-sound integration
├── sonification.js                 # Audio engine
├── sonificationUtils.js            # Audio utilities
├── clusters.geojson                # Cluster data
├── boundary.geojson                # City boundary
├── street.geojson                  # Street network
├── height_age.zip                  # Building data (compressed)
├── landuse.zip                     # Land use data (compressed)
├── landuse_block.zip               # Block land use data (compressed)
├── icon/                           # UI icons
├── sounds/                         # Audio samples
└── street/                         # Street pattern images

## Features
- Interactive urban form visualization
- Audio sonification of urban data
- Multiple data layers (building age, height, land use, street patterns)
- Urban form clustering analysis

## Technical Requirements
- Modern web browser with JavaScript enabled
- Web server (see setup instructions above)
- Audio support for sonification features

## About
This tool was developed as part of a Master's thesis in Geo-information Science and Earth Observation at ITC, University of Twente (2025).