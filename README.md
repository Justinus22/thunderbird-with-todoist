# Thunderbird Todoist Integration Extension

A powerful Thunderbird extension that seamlessly integrates with Todoist, allowing you to browse tasks and attach emails directly to your Todoist tasks without leaving Thunderbird.

## ✨ Features

### 🎯 Core Functionality
- **Task Management**: Browse all your Todoist tasks in a clean interface
- **Smart Search**: Real-time fuzzy search across task content and descriptions
- **Advanced Filtering**: Filter by projects and labels with persistent preferences
- **Email Integration**: Attach emails to tasks as formatted comments
- **Native Experience**: Works directly within Thunderbird's interface

### 🚀 User Experience
- **Native Popup**: Opens seamlessly within Thunderbird (350px optimized width)
- **Dark Mode Support**: Consistent with Thunderbird's dark theme
- **Persistent Preferences**: Remembers your filter settings across sessions
- **Instant Feedback**: Clear status messages for all operations
- **One-Click Actions**: Simple workflow for common tasks

## 📸 Screenshots

*Task browsing interface with search and filtering:*
- Clean, modern task list
- Project and label filtering
- Real-time search functionality
- Selected task preview with details

*Email attachment workflow:*
- Select any task from your Todoist projects
- Click "Attach Email to Task" 
- Email content formatted and added as task comment

## 🛠️ Installation

### Prerequisites
- Mozilla Thunderbird (latest version recommended)
- Active Todoist account
- Todoist API token (free to obtain)

### Steps
1. **Download Extension**: Get the latest release from releases page
2. **Install in Thunderbird**:
   - Open Thunderbird
   - Go to Add-ons Manager (Tools > Add-ons)
   - Click gear icon > Install Add-on From File
   - Select the downloaded extension file
3. **Configure API Token**:
   - Click the Todoist extension icon in toolbar
   - Go to Settings (gear icon) 
   - Enter your Todoist API token
   - Save configuration

### Getting Todoist API Token
1. Go to [Todoist Settings > Integrations](https://todoist.com/prefs/integrations)
2. Scroll to "API token" section
3. Copy your personal API token
4. Paste into extension settings

## 🎯 Usage

### Basic Workflow
1. **Open Extension**: Click Todoist icon in Thunderbird toolbar
2. **Browse Tasks**: View all tasks with search and filtering options
3. **Select Task**: Click any task to select it and see details
4. **Attach Email**: With email selected, click "Attach Email to Task"

### Advanced Features
- **Search**: Type in search box to find tasks by content
- **Project Filter**: Filter tasks by specific Todoist project
- **Label Filter**: Filter tasks by assigned labels  
- **Clear Filters**: One-click reset of all filters
- **Persistent Settings**: Preferences automatically saved

### Workflow Integration
- Read emails in Thunderbird normally
- When you want to attach an email to a task:
  1. Select the email
  2. Open Todoist extension popup
  3. Find and select the relevant task
  4. Click "Attach Email to Task"
- Email content is formatted and added as a comment to the task

## 🔧 Technical Details

### Architecture
- **WebExtension**: Modern Manifest V3 extension
- **Background Script**: Handles Todoist API communication
- **Popup Interface**: React-like interface for task management
- **Message Passing**: Secure communication between components

### API Integration
- **Todoist REST API v1**: Complete integration
- **Endpoints Used**: Projects, Tasks, Labels, Sections, Comments
- **Authentication**: Bearer token authentication
- **Error Handling**: Comprehensive error management

### Storage
- **Local Storage**: Filter preferences and settings
- **Secure Storage**: Encrypted API token storage
- **Performance**: Efficient data caching

## 🐛 Troubleshooting

### Common Issues

**Extension not loading**
- Ensure Thunderbird is up to date
- Check if extension is enabled in Add-ons Manager

**API connection failed**  
- Verify Todoist API token is correct
- Check internet connection
- Ensure Todoist account is active

**Tasks not showing**
- Verify API token has proper permissions
- Check if you have tasks in your Todoist account
- Try refreshing by reopening the popup

**Email attachment not working**
- Ensure an email is selected in Thunderbird
- Verify task is selected in extension
- Check network connection

### Support
- Check the [Issues](issues) page for known problems
- Create new issue with detailed description
- Include Thunderbird version and extension version

## 🤝 Contributing

Contributions welcome! Please see [REQUIREMENTS.md](REQUIREMENTS.md) for technical specifications.

### Development Setup
1. Clone repository
2. Load as temporary extension in Thunderbird
3. Make changes and test
4. Submit pull request

## 📄 License

This project is licensed under the MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- Todoist for providing excellent API
- Mozilla Thunderbird team for WebExtension support
- Community contributors and testers

---

**Status**: ✅ **Production Ready** - All core features implemented and working!

*Last updated: December 2024*