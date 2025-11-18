# Thunderbird Todoist Integration

A minimal Thunderbird extension to attach emails as subtasks to your Todoist tasks.

## Features

- Browse and search Todoist tasks
- Filter by projects and labels
- Attach emails as subtasks to tasks
- Dark theme UI matching Thunderbird
- Persistent filter preferences

## Installation

1. Download or build the extension
2. In Thunderbird: Tools → Add-ons → Install Add-on From File
3. Select the extension file
4. Configure your Todoist API token in settings

## Getting Your API Token

1. Visit [Todoist Settings → Integrations](https://todoist.com/prefs/integrations)
2. Find the "API token" section
3. Copy your personal API token
4. Paste it into the extension settings

## Usage

1. Select an email in Thunderbird
2. Click the Todoist icon in the toolbar
3. Browse or search for a task
4. Click "Add Email as Subtask"

The email subject becomes the subtask title, and the email body is added as the description.

## Development

### File Structure

- `background.js` - API communication layer
- `popup.js` - Main UI logic
- `popup.html` / `styles.css` - Interface
- `config.js` / `config.html` - Settings page
- `manifest.json` - Extension configuration

### Building

No build step required. Load directly in Thunderbird as a temporary add-on.

## License

MIT
