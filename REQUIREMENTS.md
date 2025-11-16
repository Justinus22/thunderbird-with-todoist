# Thunderbird-Todoist Integration Requirements

## Project Overview
A Thunderbird extension that integrates with Todoist to allow users to attach emails as sub-task notes to existing tasks through an intuitive popup interface with persistent filtering capabilities and fuzzy text search.

---

## 1. Functional Requirements

### 1.1 Core Email-to-Task Integration
- **F1.1** ❌: Users shall be able to open a popup interface from any displayed email message
- **F1.2** ❌: The popup shall display a searchable list of existing Todoist tasks
- **F1.3** ❌: Users shall be able to select a task and attach the current email as a sub-task note
- **F1.4** ❌: Email attachments shall be formatted with a bullet point (*) at the beginning as specified
- **F1.5** ❌: The attached email note shall include:
  - Email subject line
  - Sender information
  - Email date/time
  - Link back to the email (if possible via Thunderbird URLs)
  - Email content preview (first 200 characters)

### 1.2 Task Filtering and Search
- **F2.1** ❌: Users shall be able to filter tasks by:
  - Project (dropdown/multi-select)
  - Sections within projects (dropdown/multi-select)  
  - Labels (multi-select with checkbox interface)
  - Due date ranges (date picker interface)
- **F2.2** ❌: Filter settings shall persist across email sessions until manually cleared
- **F2.3** ❌: Users shall have access to a fuzzy text search that:
  - Searches task titles and descriptions
  - Does not persist (resets with each popup open)
  - Provides real-time results as user types
- **F2.4** ❌: Combined filtering (persistent filters + text search) shall work together
- **F2.5** ❌: Users shall be able to clear all persistent filters with a single action

### 1.3 User Interface
- **F3.1** ❌: A button/action shall be added to the message display toolbar
- **F3.2** ❌: The popup interface shall be responsive and usable within 400px width
- **F3.3** ❌: Task list shall support pagination for large result sets
- **F3.4** ❌: Visual feedback shall be provided during API operations (loading states)
- **F3.5** ❌: Success/error notifications shall be shown for all operations

---

## 2. Non-Functional Requirements

### 2.1 Performance
- **NF1.1** ❌: Initial popup load shall complete within 3 seconds
- **NF1.2** ❌: Task filtering shall provide results within 1 second
- **NF1.3** ❌: Fuzzy search shall provide real-time results with <200ms latency
- **NF1.4** ❌: API calls shall be debounced to prevent excessive requests
- **NF1.5** ❌: Task data shall be cached locally for 5 minutes to improve responsiveness

### 2.2 Reliability
- **NF2.1** ❌: Extension shall handle network connectivity issues gracefully
- **NF2.2** ❌: API rate limiting (1000 requests/15 minutes) shall be respected
- **NF2.3** ❌: Extension shall recover from Todoist API errors without crashing
- **NF2.4** ❌: Extension shall work offline with cached data when possible

### 2.3 Usability
- **NF3.1** ❌: Interface shall follow Thunderbird's native UI design patterns
- **NF3.2** ❌: Keyboard navigation shall be fully supported
- **NF3.3** ❌: Popup shall remember last used filters for user convenience
- **NF3.4** ❌: Error messages shall be user-friendly and actionable

### 2.4 Security
- **NF4.1** ❌: User's Todoist API token shall be stored securely in encrypted storage
- **NF4.2** ❌: No sensitive email content shall be logged or stored permanently
- **NF4.3** ❌: All communications with Todoist API shall use HTTPS

---

## 3. Technical Requirements

### 3.1 Thunderbird Integration
- **T1.1** ✅: Extension shall use Manifest V3 format for future compatibility
- **T1.2** ✅: Required permissions:
  - `messagesRead` - to access email content
  - `messageDisplayAction` - for toolbar button
  - `storage` - for persistent settings
  - `activeTab` - for popup display
- **T1.3** ✅: Extension shall use `messageDisplayAction` API for toolbar integration
- **T1.4** ❌: Extension shall use `messages` API to access email content and metadata

### 3.2 Todoist API Integration  
- **T2.1** ✅: Extension shall use Todoist REST API v1
- **T2.2** ❌: OAuth 2.0 authentication shall be implemented for secure token acquisition
- **T2.3** ❌: Required API endpoints:
  - `GET /projects` - fetch user projects
  - `GET /sections` - fetch project sections  
  - `GET /labels` - fetch user labels
  - `GET /tasks` - fetch tasks with filtering
  - `POST /comments` - add email as task comment
- **T2.4** ❌: API calls shall include proper error handling and retry logic
- **T2.5** ❌: Rate limiting shall be implemented client-side

### 3.3 Data Management
- **T3.1** ❌: Filter preferences shall be stored using `storage.local` API
- **T3.2** ❌: Todoist authentication tokens shall be stored using `storage.local` with encryption
- **T3.3** ❌: Task data shall be cached with timestamps for smart refreshing
- **T3.4** ❌: Cache size shall be limited to prevent excessive storage usage

---

## 4. Architectural Requirements

### 4.1 Extension Architecture
- **A1.1** ❌: Background script shall handle all API communications
- **A1.2** ❌: Content scripts shall be minimal and focused on UI injection
- **A1.3** ❌: Popup script shall handle user interactions and display logic
- **A1.4** ❌: Message passing between components shall use `runtime.sendMessage`

### 4.2 API Layer
- **A2.1** ❌: Todoist API wrapper shall abstract all REST API calls
- **A2.2** ❌: Error handling shall be centralized in API layer
- **A2.3** ❌: Request/response interceptors shall handle authentication and rate limiting
- **A2.4** ❌: API responses shall be normalized for consistent data structures

### 4.3 State Management
- **A3.1** ❌: Application state shall be managed centrally in background script
- **A3.2** ❌: UI state shall be synchronized between popup and background script
- **A3.3** ❌: Filter state shall persist independently of session state

### 4.4 Security Architecture
- **A4.1** ❌: Token storage shall use WebExtension storage encryption
- **A4.2** ❌: No secrets shall be stored in content scripts
- **A4.3** ❌: Cross-origin requests shall be properly configured

---

## 5. Design Requirements

### 5.1 Visual Design
- **D1.1** ❌: UI shall match Thunderbird's native Photon design system
- **D1.2** ❌: Color scheme shall adapt to user's Thunderbird theme (light/dark)
- **D1.3** ❌: Icons shall be SVG-based for scalability
- **D1.4** ❌: Typography shall use system fonts for consistency

### 5.2 Interaction Design
- **D2.1** ❌: Filter controls shall be collapsible to save screen real estate
- **D2.2** ❌: Task selection shall support both click and keyboard navigation
- **D2.3** ❌: Search input shall have clear/reset functionality
- **D2.4** ❌: Loading states shall use progressive disclosure

### 5.3 Responsive Design
- **D3.1** ❌: Interface shall work on popup widths from 350px to 800px
- **D3.2** ❌: Task list shall support virtual scrolling for performance
- **D3.3** ❌: Filter panels shall stack vertically on narrow screens

---

## 6. Integration Requirements

### 6.1 Authentication Flow
- **I1.1** ❌: Initial setup shall guide users through Todoist OAuth connection
- **I1.2** ❌: Token refresh shall be handled automatically
- **I1.3** ❌: Users shall be able to disconnect/reconnect their Todoist account

### 6.2 Email Processing
- **I2.1** ❌: Email content shall be sanitized before sending to Todoist
- **I2.2** ❌: Large emails shall be truncated with indication to user
- **I2.3** ❌: Email attachments shall be referenced but not uploaded to Todoist

### 6.3 Error Handling
- **I3.1** ❌: Network errors shall show retry options
- **I3.2** ❌: Authentication errors shall prompt for re-authentication  
- **I3.3** ❌: API quota exceeded errors shall show appropriate messaging

---

## 7. Development and Deployment

### 7.1 Development Environment
- **DV1.1** ❌: Extension shall be developed using modern JavaScript (ES2020+)
- **DV1.2** ❌: Build system shall use webpack or similar for optimization
- **DV1.3** ❌: Code shall follow ESLint and Prettier formatting standards
- **DV1.4** ❌: Comprehensive unit tests shall be included

### 7.2 Distribution
- **DV2.1** ❌: Extension shall be packaged for Thunderbird Add-ons (ATN) store
- **DV2.2** ❌: Installation package shall include clear setup instructions
- **DV2.3** ❌: Extension shall support auto-updates through ATN

---

## Development Status

### Current Sprint: Minimal Working Example
**Objective**: Create basic extension with Thunderbird integration and Todoist API connection

#### Completed Requirements:
- **T1.1** ✅: Manifest V3 structure
- **T1.2** ✅: Basic permissions setup 
- **T1.3** ✅: messageDisplayAction integration
- **T2.1** ✅: Todoist API v1 setup

#### Next Priority:
- **F3.1**: Add button to message display toolbar
- **F1.1**: Create basic popup interface
- **T2.3**: Basic Todoist API connection test