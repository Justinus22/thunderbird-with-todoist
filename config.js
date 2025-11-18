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
    await loadProjects();
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
  
  // Preferences tab
  document.getElementById('savePreferences').addEventListener('click', savePreferencesHandler);
  document.getElementById('resetPreferences').addEventListener('click', resetPreferencesHandler);
  
  // Allow Enter key to save token
  document.getElementById('apiToken').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveTokenHandler();
    }
  });
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
    await loadProjects();
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
      document.getElementById('defaultProject').innerHTML = '<option value="">Select a project...</option>';
    } else {
      updateStatus('Failed to clear token', 'error');
    }
  }
}

async function savePreferencesHandler() {
  const preferences = {
    defaultProject: document.getElementById('defaultProject').value,
    includeBody: document.getElementById('includeBody').checked,
    includeAttachments: document.getElementById('includeAttachments').checked,
    includeHeaders: document.getElementById('includeHeaders').checked,
    autoAddTodoist: document.getElementById('autoAddTodoist').checked,
    markAsProcessed: document.getElementById('markAsProcessed').checked
  };

  const iconOnlyMode = document.getElementById('iconOnlyMode').checked;

  try {
    await browser.storage.local.set({
      todoistPreferences: preferences,
      iconOnlyMode: iconOnlyMode
    });
    updateStatus('Preferences saved successfully!', 'success');
  } catch (error) {
    console.error('Error saving preferences:', error);
    updateStatus('Failed to save preferences', 'error');
  }
}

async function resetPreferencesHandler() {
  if (confirm('Are you sure you want to reset all preferences to defaults?')) {
    const defaultPreferences = {
      defaultProject: '',
      includeBody: true,
      includeAttachments: false,
      includeHeaders: true,
      autoAddTodoist: false,
      markAsProcessed: false
    };

    try {
      await browser.storage.local.set({
        todoistPreferences: defaultPreferences,
        iconOnlyMode: false
      });
      await loadCurrentSettings();
      updateStatus('Preferences reset to defaults', 'success');
    } catch (error) {
      console.error('Error resetting preferences:', error);
      updateStatus('Failed to reset preferences', 'error');
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

async function loadProjects() {
  const token = await getTodoistToken();
  
  if (!token) {
    return;
  }
  
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
      const projectSelect = document.getElementById('defaultProject');
      
      // Clear existing options
      projectSelect.innerHTML = '<option value="">Select a project...</option>';
      
      // Handle v1 API response format
      const projectList = projects.results || projects;
      
      if (Array.isArray(projectList)) {
        projectList.forEach(project => {
          const option = document.createElement('option');
          option.value = project.id;
          option.textContent = project.name;
          projectSelect.appendChild(option);
        });
        
        console.log(`Loaded ${projectList.length} projects for selection`);
      }
    }
  } catch (error) {
    console.error('Error loading projects:', error);
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
    const result = await browser.storage.local.get(['todoistPreferences', 'iconOnlyMode']);
    const preferences = result.todoistPreferences || {
      defaultProject: '',
      includeBody: true,
      includeAttachments: false,
      includeHeaders: true,
      autoAddTodoist: false,
      markAsProcessed: false
    };
    const iconOnlyMode = result.iconOnlyMode || false;

    // Apply preferences to form
    document.getElementById('defaultProject').value = preferences.defaultProject;
    document.getElementById('includeBody').checked = preferences.includeBody;
    document.getElementById('includeAttachments').checked = preferences.includeAttachments;
    document.getElementById('includeHeaders').checked = preferences.includeHeaders;
    document.getElementById('autoAddTodoist').checked = preferences.autoAddTodoist;
    document.getElementById('markAsProcessed').checked = preferences.markAsProcessed;
    document.getElementById('iconOnlyMode').checked = iconOnlyMode;

    console.log('Settings loaded:', preferences, 'Icon-only mode:', iconOnlyMode);
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

// Error handler
window.addEventListener('error', (error) => {
  console.error('Configuration page error:', error);
  updateStatus('An unexpected error occurred', 'error');
});