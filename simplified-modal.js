// Simplified modal script for Todoist Integration
console.log('Simplified modal loaded');

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Initializing simplified modal');
  await initializeModal();
  setupEventListeners();
});

// Initialize the modal
async function initializeModal() {
  const token = await getTodoistToken();
  
  if (token) {
    console.log('Token found, showing connected interface');
    await showConnectedInterface();
  } else {
    console.log('No token found, showing setup interface');
    showSetupInterface();
  }
}

// Set up all event listeners
function setupEventListeners() {
  // Setup section
  const openConfigBtn = document.getElementById('openConfigBtn');
  if (openConfigBtn) {
    openConfigBtn.addEventListener('click', openConfigurationPage);
  }
  
  // Connected section
  const refreshEmailBtn = document.getElementById('refreshEmail');
  if (refreshEmailBtn) {
    refreshEmailBtn.addEventListener('click', refreshEmailInfo);
  }
  
  const addToTodoistBtn = document.getElementById('addToTodoist');
  if (addToTodoistBtn) {
    addToTodoistBtn.addEventListener('click', addEmailToTodoist);
  }
  
  const openSettingsBtn = document.getElementById('openSettings');
  if (openSettingsBtn) {
    openSettingsBtn.addEventListener('click', openConfigurationPage);
  }
}

// Show the setup interface (when not configured)
function showSetupInterface() {
  document.getElementById('setupSection').classList.remove('hidden');
  document.getElementById('connectedSection').classList.remove('active');
}

// Show the connected interface (when token exists)
async function showConnectedInterface() {
  document.getElementById('setupSection').classList.add('hidden');
  document.getElementById('connectedSection').classList.add('active');
  
  // Test the connection first
  const isConnected = await testTodoistConnection();
  if (isConnected) {
    await loadEmailInformation();
  } else {
    // Connection failed, show setup again
    updateStatus('Connection to Todoist failed. Please reconfigure.', 'error');
    setTimeout(() => {
      showSetupInterface();
    }, 3000);
  }
}

// Event handlers
async function openConfigurationPage() {
  try {
    console.log('Opening configuration page as tab');
    
    const newTab = await browser.tabs.create({
      url: browser.runtime.getURL('config.html'),
      active: true
    });
    
    console.log('Configuration tab opened:', newTab.id);
  } catch (error) {
    console.error('Error opening configuration page:', error);
    updateStatus('Failed to open configuration page', 'error');
  }
}

async function refreshEmailInfo() {
  const refreshBtn = document.getElementById('refreshEmail');
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '<span class="loading-spinner"></span>Refreshing...';
  }
  
  await loadEmailInformation();
  
  if (refreshBtn) {
    refreshBtn.disabled = false;
    refreshBtn.innerHTML = 'Refresh Email';
  }
}

async function addEmailToTodoist() {
  const addBtn = document.getElementById('addToTodoist');
  if (addBtn) {
    addBtn.disabled = true;
    addBtn.innerHTML = '<span class="loading-spinner"></span>Adding...';
  }
  
  // TODO: Implement actual Todoist task creation
  updateStatus('Adding to Todoist is coming soon!', 'info');
  
  setTimeout(() => {
    if (addBtn) {
      addBtn.disabled = false;
      addBtn.innerHTML = 'Add to Todoist';
    }
  }, 2000);
}

// API functions
async function getTodoistToken() {
  try {
    const result = await browser.storage.local.get('todoistToken');
    return result.todoistToken;
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
}

async function testTodoistConnection() {
  const token = await getTodoistToken();
  
  if (!token) {
    return false;
  }
  
  updateStatus('Testing connection...', 'info');
  
  try {
    const response = await fetch('https://api.todoist.com/api/v1/projects', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const projects = await response.json();
      console.log('Connection test successful');
      
      // Handle v1 API response format
      if (projects.results && Array.isArray(projects.results)) {
        const projectCount = projects.results.length;
        updateStatus(`Connected! Found ${projectCount} projects.`, 'success');
        return true;
      } else {
        updateStatus('Unexpected response format from Todoist API', 'error');
        return false;
      }
    } else {
      const errorText = await response.text();
      console.error('API error:', response.status, errorText);
      updateStatus(`Connection failed: ${response.status}`, 'error');
      return false;
    }
  } catch (error) {
    console.error('Network error:', error);
    updateStatus(`Connection failed: ${error.message}`, 'error');
    return false;
  }
}

async function loadEmailInformation() {
  const emailInfo = document.getElementById('emailInfo');
  
  try {
    emailInfo.innerHTML = '<div class="loading-spinner"></div>Loading email information...';
    
    // Get current email message
    const message = await getCurrentMessage();
    
    if (message) {
      console.log('Loaded email message:', message.subject);
      
      emailInfo.innerHTML = `
        <div class="email-item">
          <strong>Subject:</strong> ${escapeHtml(message.subject || 'No Subject')}
        </div>
        <div class="email-item">
          <strong>From:</strong> ${escapeHtml(message.author || 'Unknown')}
        </div>
        <div class="email-item">
          <strong>Date:</strong> ${message.date ? new Date(message.date).toLocaleString() : 'Unknown'}
        </div>
        <div class="email-item">
          <strong>ID:</strong> ${message.id || 'Unknown'}
        </div>
      `;
    } else {
      emailInfo.innerHTML = `
        <div class="email-item">
          <strong>No email selected</strong><br>
          Please select an email in Thunderbird and try again.
        </div>
      `;
    }
  } catch (error) {
    console.error('Error loading email info:', error);
    emailInfo.innerHTML = `
      <div class="email-item">
        <strong>Error:</strong> Failed to load email information<br>
        ${escapeHtml(error.message)}
      </div>
    `;
  }
}

async function getCurrentMessage() {
  try {
    console.log('Getting current message...');
    
    // Try to get displayed messages from the active tab
    try {
      const displayedMessages = await browser.messageDisplay.getDisplayedMessages();
      console.log('Method 1 - Displayed messages found:', displayedMessages?.messages?.length || 0);
      
      if (displayedMessages && displayedMessages.messages && displayedMessages.messages.length > 0) {
        const message = displayedMessages.messages[0];
        console.log('Found displayed message:', message.subject);
        return message;
      }
    } catch (error) {
      console.log('Method 1 failed:', error.message);
    }
    
    // Try to get selected messages from active mail tab
    try {
      const selectedMessages = await browser.mailTabs.getSelectedMessages();
      console.log('Method 2 - Selected messages found:', selectedMessages?.messages?.length || 0);
      
      if (selectedMessages && selectedMessages.messages && selectedMessages.messages.length > 0) {
        const message = selectedMessages.messages[0];
        console.log('Found selected message:', message.subject);
        return message;
      }
    } catch (error) {
      console.log('Method 2 failed:', error.message);
    }
    
    console.log('No message found with available methods');
    return null;
  } catch (error) {
    console.error('Error in getCurrentMessage:', error);
    return null;
  }
}

// UI helper functions
function updateStatus(message, type = 'info') {
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    statusEl.classList.remove('hidden');
    
    // Auto-hide success/info messages after 5 seconds
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        statusEl.classList.add('hidden');
      }, 5000);
    }
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Error handler
window.addEventListener('error', (error) => {
  console.error('Modal error:', error);
  updateStatus('An unexpected error occurred', 'error');
});