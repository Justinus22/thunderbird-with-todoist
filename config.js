// Configuration page script for Todoist Integration
console.log('Configuration page loaded');

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Initializing configuration page');
  
  await initializePage();
  setupEventListeners();
  await loadCurrentSettings();
});

// Initialize the configuration page
async function initializePage() {
  // Check if we have a token
  const token = await getTodoistToken();
  if (token) {
    await testConnection();
  }
}

// Set up all event listeners
function setupEventListeners() {
  // Close button
  document.getElementById('closeConfig').addEventListener('click', () => {
    window.close();
  });
  
  // Tab navigation
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => switchTab(button.dataset.tab));
  });

  // Connection tab
  document.getElementById('saveToken').addEventListener('click', saveTokenHandler);
  document.getElementById('testConnection').addEventListener('click', testConnectionHandler);
  document.getElementById('clearToken').addEventListener('click', clearTokenHandler);

  // Allow Enter key to save token
  document.getElementById('apiToken').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveTokenHandler();
    }
  });

  // Preferences tab
  document.getElementById('savePreferences').addEventListener('click', savePreferencesHandler);
}

// Tab switching functionality
function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  
  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(tabName).classList.add('active');
}

// Token management functions
async function getTodoistToken() {
  try {
    const result = await browser.storage.local.get('todoistToken');
    return result.todoistToken;
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
}

async function saveTodoistToken(token) {
  try {
    await browser.storage.local.set({ todoistToken: token });
    console.log('Token saved successfully');
    return true;
  } catch (error) {
    console.error('Error saving token:', error);
    return false;
  }
}

async function clearTodoistToken() {
  try {
    await browser.storage.local.remove('todoistToken');
    console.log('Token cleared successfully');
    return true;
  } catch (error) {
    console.error('Error clearing token:', error);
    return false;
  }
}

// Event handlers
async function saveTokenHandler() {
  const tokenInput = document.getElementById('apiToken');
  const token = tokenInput.value.trim();
  
  if (!token) {
    updateStatus('Please enter a valid API token', 'error');
    return;
  }
  
  updateStatus('Saving token...', 'info');
  
  const saved = await saveTodoistToken(token);
  if (saved) {
    updateStatus('Token saved successfully!', 'success');
    tokenInput.value = '';
    await testConnection();
  } else {
    updateStatus('Failed to save token', 'error');
  }
}

async function testConnectionHandler() {
  const token = await getTodoistToken();
  
  if (!token) {
    updateStatus('No token found. Please save your API token first.', 'error');
    return;
  }
  
  await testConnection();
}

async function clearTokenHandler() {
  if (confirm('Are you sure you want to clear your stored API token?')) {
    const cleared = await clearTodoistToken();
    if (cleared) {
      updateStatus('Token cleared successfully', 'success');
      document.getElementById('apiToken').value = '';
      document.getElementById('statsSection').classList.add('hidden');
    } else {
      updateStatus('Failed to clear token', 'error');
    }
  }
}


// API functions
async function testConnection() {
  const token = await getTodoistToken();
  
  if (!token) {
    updateStatus('No API token found', 'error');
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
      console.log('Connection test successful:', projects);
      
      // Handle v1 API response format
      if (projects.results && Array.isArray(projects.results)) {
        const projectCount = projects.results.length;
        updateStatus(`Connected successfully! Found ${projectCount} projects.`, 'success');
        updateStats({ projects: projectCount });
        document.getElementById('statsSection').classList.remove('hidden');
        return true;
      } else {
        updateStatus('Unexpected response format from Todoist API', 'error');
        return false;
      }
    } else {
      const errorText = await response.text();
      console.error('API error:', response.status, errorText);
      updateStatus(`Connection failed: ${response.status} - ${errorText}`, 'error');
      return false;
    }
  } catch (error) {
    console.error('Network error:', error);
    updateStatus(`Connection failed: ${error.message}`, 'error');
    return false;
  }
}


async function loadCurrentSettings() {
  try {
    // Load current token status
    const token = await getTodoistToken();
    const tokenInput = document.getElementById('apiToken');

    if (token) {
      tokenInput.placeholder = 'Token is saved (hidden for security)';
    } else {
      tokenInput.placeholder = 'Enter your Todoist API token...';
    }

    // Load preferences
    const { preferences } = await browser.storage.local.get('preferences');
    const hideSubtasksCheckbox = document.getElementById('hideSubtasksInMove');

    // Default to true (hide subtasks by default)
    if (hideSubtasksCheckbox) {
      hideSubtasksCheckbox.checked = preferences?.hideSubtasksInMove !== false;
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// UI helper functions
function updateStatus(message, type = 'info') {
  const statusEl = document.getElementById('connectionStatus');
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

function updateStats(stats) {
  if (stats.projects !== undefined) {
    document.getElementById('projectCount').textContent = stats.projects;
  }
  if (stats.tasks !== undefined) {
    document.getElementById('taskCount').textContent = stats.tasks;
  }
  if (stats.emails !== undefined) {
    document.getElementById('emailsProcessed').textContent = stats.emails;
  }
}

// Preferences handlers
async function savePreferencesHandler() {
  try {
    const hideSubtasksCheckbox = document.getElementById('hideSubtasksInMove');

    const preferences = {
      hideSubtasksInMove: hideSubtasksCheckbox.checked
    };

    await browser.storage.local.set({ preferences });

    const statusEl = document.getElementById('preferencesStatus');
    statusEl.textContent = 'Preferences saved successfully!';
    statusEl.className = 'status success';
    statusEl.classList.remove('hidden');

    setTimeout(() => {
      statusEl.classList.add('hidden');
    }, 3000);

  } catch (error) {
    const statusEl = document.getElementById('preferencesStatus');
    statusEl.textContent = 'Failed to save preferences';
    statusEl.className = 'status error';
    statusEl.classList.remove('hidden');
  }
}

// Error handler
window.addEventListener('error', (error) => {
  console.error('Configuration page error:', error);
  updateStatus('An unexpected error occurred', 'error');
});