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
}

// Show the setup interface (when not configured)
function showSetupInterface() {
  document.getElementById('setupSection').style.display = 'block';
  document.getElementById('main-content').innerHTML = '';
}

// Show the connected interface (when token exists)
async function showConnectedInterface() {
  document.getElementById('setupSection').style.display = 'none';
  
  // Test the connection first
  const isConnected = await testTodoistConnection();
  if (isConnected) {
    await loadTaskInterface();
  } else {
    // Connection failed, show setup again
    document.getElementById('main-content').innerHTML = '<div class="status error">Connection to Todoist failed. Please reconfigure.</div>';
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
      url: browser.runtime.getURL('config/config.html'),
      active: true
    });
    
    console.log('Configuration tab opened:', newTab.id);
  } catch (error) {
    console.error('Error opening configuration page:', error);
    updateStatus('Failed to open configuration page', 'error');
  }
}

async function attachEmailToTask() {
  const selectedTask = getSelectedTask();
  if (!selectedTask) {
    updateStatus('Please select a task first', 'error');
    return;
  }
  
  const attachBtn = document.getElementById('attachEmailBtn');
  if (attachBtn) {
    attachBtn.disabled = true;
    attachBtn.innerHTML = '<span class="loading-spinner"></span>Creating Subtask...';
  }
  
  try {
    // Get current email
    const message = await getCurrentMessage();
    if (!message) {
      updateStatus('No email found to attach', 'error');
      return;
    }

    // Send to background script to create subtask
    const response = await browser.runtime.sendMessage({
      type: 'CREATE_EMAIL_SUBTASK',
      parentTaskId: selectedTask.id,
      emailSubject: message.subject || 'No Subject',
      emailBody: message.body || '',
      attachments: message.attachments || []
    });

    if (response.success) {
      updateStatus(`Email added as subtask to "${selectedTask.content}" successfully!`, 'success');
      // Reset selection
      clearTaskSelection();
    } else {
      updateStatus(`Failed to create subtask: ${response.error}`, 'error');
    }
  } catch (error) {
    console.error('Error creating subtask:', error);
    updateStatus('Failed to create subtask', 'error');
  } finally {
    if (attachBtn) {
      attachBtn.disabled = true; // Will be re-enabled when task is selected
      attachBtn.innerHTML = 'Add Email as Subtask';
    }
  }
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
    return false;
  }
}

// Utility function for HTML escaping
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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

// Task interface functions
let allTasks = [];
let allProjects = [];
let allLabels = [];
let filteredTasks = [];
let selectedTask = null;

async function loadTaskInterface() {
  try {
    // Clear existing content
    document.getElementById('main-content').innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        Loading tasks...
      </div>
    `;
    
    console.log('Loading task interface - fetching data...');
    
    // Get all data in parallel
    const [tasksResponse, sectionsResponse, labelsResponse] = await Promise.all([
      browser.runtime.sendMessage({action: 'GET_ALL_TASKS'}),
      browser.runtime.sendMessage({action: 'GET_SECTIONS'}),
      browser.runtime.sendMessage({action: 'GET_LABELS'})
    ]);
    
    console.log('API Responses:', { tasksResponse, sectionsResponse, labelsResponse });
    
    allTasks = tasksResponse.success ? tasksResponse.data : [];
    filteredTasks = [...allTasks];
    allSections = sectionsResponse.success ? sectionsResponse.data : [];
    allLabels = labelsResponse.success ? labelsResponse.data : [];
    
    console.log('Loaded data:', { 
      tasks: allTasks.length, 
      sections: allSections.length, 
      labels: allLabels.length 
    });
    
    // Build the task interface
    document.getElementById('main-content').innerHTML = buildTaskInterface();
    
    // Load projects and populate filters after building interface 
    await loadProjects();
    populateLabelFilter();
    
    // Set up event listeners
    document.getElementById('taskSearch').addEventListener('input', debounce(handleTaskSearch, 300));
    document.getElementById('projectFilter').addEventListener('change', handleFilterChange);
    document.getElementById('labelFilter').addEventListener('change', handleFilterChange);
    document.getElementById('clearFilters').addEventListener('click', clearAllFilters);
    document.getElementById('attachEmailBtn').addEventListener('click', attachEmailToSelectedTask);
    
    // Load saved filters and apply them
    await loadSavedFilters();
    applyFiltersAndDisplay();
    
    console.log('Task interface loaded successfully');
    
  } catch (error) {
    console.error('Error loading task interface:', error);
    document.getElementById('main-content').innerHTML = '<div class="status error">Error loading tasks. Please try again.</div>';
  }
}

function buildTaskInterface() {
  return `
    <div class="task-interface">
      <div id="status" class="status info hidden"></div>
      
      <div class="search-filters">
        <div class="search-container">
          <input type="text" id="taskSearch" placeholder="Search tasks..." class="search-input">
          <button id="clearFilters" class="clear-filters-btn">Clear</button>
        </div>
        <div class="filter-row">
          <select id="projectFilter" class="filter-select">
            <option value="">All Projects</option>
          </select>
          <select id="labelFilter" class="filter-select">
            <option value="">All Labels</option>
          </select>
        </div>
      </div>
      
      <div class="task-list-container">
        <div id="taskList" class="task-list"></div>
      </div>
      
      <div class="selected-task-area">
        <div id="selectedTaskDisplay" class="selected-task">
          <p>No task selected</p>
        </div>
        <button id="attachEmailBtn" class="attach-email-btn" disabled>
          Add Email as Subtask
        </button>
      </div>
    </div>
  `;
}

async function loadProjects() {
  try {
    // Get projects from background script
    const response = await browser.runtime.sendMessage({action: 'GET_PROJECTS'});
    if (response && response.success) {
      allProjects = response.projects || [];
    } else {
      // Fallback: extract unique projects from tasks
      const projectMap = new Map();
      allTasks.forEach(task => {
        if (task.project_id && !projectMap.has(task.project_id)) {
          projectMap.set(task.project_id, {
            id: task.project_id,
            name: `Project ${task.project_id}` // Will be replaced with actual names when available
          });
        }
      });
      allProjects = Array.from(projectMap.values());
    }
    
    populateProjectFilter();
  } catch (error) {
    console.error('Error loading projects:', error);
    // Fallback: extract from tasks
    const projectMap = new Map();
    allTasks.forEach(task => {
      if (task.project_id && !projectMap.has(task.project_id)) {
        projectMap.set(task.project_id, {
          id: task.project_id,
          name: `Project ${task.project_id}`
        });
      }
    });
    allProjects = Array.from(projectMap.values());
    populateProjectFilter();
  }
}

function populateProjectFilter() {
  const projectFilter = document.getElementById('projectFilter');
  if (!projectFilter) return;
  
  // Clear existing options except "All Projects"
  projectFilter.innerHTML = '<option value="">All Projects</option>';
  
  allProjects.forEach(project => {
    const option = document.createElement('option');
    option.value = project.id;
    option.textContent = project.name;
    projectFilter.appendChild(option);
  });
}

function populateLabelFilter() {
  const labelFilter = document.getElementById('labelFilter');
  if (!labelFilter) return;
  
  // Clear existing options except "All Labels"
  labelFilter.innerHTML = '<option value="">All Labels</option>';
  
  allLabels.forEach(label => {
    const option = document.createElement('option');
    option.value = label.name;
    option.textContent = label.name;
    labelFilter.appendChild(option);
  });
}

function displayTasks(tasks) {
  const taskList = document.getElementById('taskList');
  if (!taskList) return;
  
  if (tasks.length === 0) {
    taskList.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No tasks found</div>';
    return;
  }
  
  taskList.innerHTML = '';
  
  tasks.forEach(task => {
    const taskItem = createTaskElement(task);
    taskList.appendChild(taskItem);
  });
}

function createTaskElement(task) {
  const taskItem = document.createElement('div');
  taskItem.className = 'task-item';
  taskItem.dataset.taskId = task.id;
  
  // Format due date
  let dueDateText = '';
  if (task.due && task.due.date) {
    const dueDate = new Date(task.due.date);
    const today = new Date();
    const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      dueDateText = `<span class="task-due">Overdue</span>`;
    } else if (diffDays === 0) {
      dueDateText = `<span class="task-due">Today</span>`;
    } else if (diffDays === 1) {
      dueDateText = `<span class="task-due">Tomorrow</span>`;
    } else if (diffDays <= 7) {
      dueDateText = `Due in ${diffDays} days`;
    }
  }
  
  taskItem.innerHTML = `
    <div class="task-title">${escapeHtml(task.content)}</div>
    <div class="task-meta">
      <span class="task-project">Project ${task.project_id}</span>
      ${dueDateText}
      ${task.labels && task.labels.length > 0 ? 
        '<span>' + task.labels.map(label => `#${label}`).join(' ') + '</span>' : ''}
    </div>
  `;
  
  taskItem.addEventListener('click', () => selectTask(task));
  
  return taskItem;
}

function selectTask(task) {
  // Clear previous selection
  document.querySelectorAll('.task-item').forEach(item => {
    item.classList.remove('selected');
  });
  
  // Select new task
  const taskElement = document.querySelector(`[data-task-id="${task.id}"]`);
  if (taskElement) {
    taskElement.classList.add('selected');
  }
  
  selectedTask = task;
  
  // Update selected task display
  const selectedDisplay = document.getElementById('selectedTaskDisplay');
  if (selectedDisplay) {
    selectedDisplay.innerHTML = `
      <div class="selected-task-info">
        <h4>${task.content}</h4>
        ${task.description ? `<p class="task-description">${task.description}</p>` : ''}
        <div class="task-meta">
          ${task.labels && task.labels.length > 0 ? 
            `<span class="task-labels">${task.labels.join(', ')}</span>` : ''}
          ${task.due ? `<span class="task-due">Due: ${new Date(task.due.date).toLocaleDateString()}</span>` : ''}
        </div>
      </div>
    `;
  }
  
  // Enable attach button
  const attachBtn = document.getElementById('attachEmailBtn');
  if (attachBtn) {
    attachBtn.disabled = false;
  }
}

function getSelectedTask() {
  return selectedTask;
}

function clearTaskSelection() {
  selectedTask = null;
  
  document.querySelectorAll('.task-item').forEach(item => {
    item.classList.remove('selected');
  });
  
  const selectedDisplay = document.getElementById('selectedTaskDisplay');
  if (selectedDisplay) {
    selectedDisplay.innerHTML = '<p>No task selected</p>';
  }
  
  const attachBtn = document.getElementById('attachEmailBtn');
  if (attachBtn) {
    attachBtn.disabled = true;
  }
}

async function attachEmailToSelectedTask() {
  if (!selectedTask) {
    updateStatus('No task selected', 'error');
    return;
  }
  
  try {
    updateStatus('Creating subtask from email...', 'info');
    
    // Get current email content
    const response = await browser.runtime.sendMessage({type: 'GET_CURRENT_MESSAGE'});
    if (!response.success || !response.message) {
      updateStatus('No email selected', 'error');
      return;
    }

    // Create subtask from email
    const subtaskResponse = await browser.runtime.sendMessage({
      type: 'CREATE_EMAIL_SUBTASK',
      parentTaskId: selectedTask.id,
      emailSubject: response.message.subject || 'No Subject',
      emailBody: response.message.body || '',
      attachments: response.message.attachments || []
    });
    
    if (subtaskResponse.success) {
      updateStatus('Email added as subtask successfully!', 'success');
      setTimeout(() => {
        updateStatus('', 'info');
      }, 3000);
    } else {
      updateStatus(`Failed to create subtask: ${subtaskResponse.error}`, 'error');
    }
    
  } catch (error) {
    console.error('Error creating subtask:', error);
    updateStatus('Error creating subtask', 'error');
  }
}

function handleTaskSearch() {
  const searchTerm = document.getElementById('taskSearch').value.toLowerCase();
  applyFiltersAndDisplay();
}

function handleFilterChange() {
  saveCurrentFilters();
  applyFiltersAndDisplay();
}

function clearAllFilters() {
  document.getElementById('taskSearch').value = '';
  document.getElementById('projectFilter').value = '';
  document.getElementById('labelFilter').value = '';
  
  clearSavedFilters();
  applyFiltersAndDisplay();
}

async function loadSavedFilters() {
  try {
    const result = await browser.storage.local.get('taskFilters');
    const savedFilters = result.taskFilters || {};
    
    // Apply saved filters to UI (but not search - that's not persistent)
    if (savedFilters.projectId) {
      const projectFilter = document.getElementById('projectFilter');
      if (projectFilter) projectFilter.value = savedFilters.projectId;
    }
    
    if (savedFilters.label) {
      const labelFilter = document.getElementById('labelFilter');
      if (labelFilter) labelFilter.value = savedFilters.label;
    }
    
    console.log('Loaded saved filters:', savedFilters);
  } catch (error) {
    console.error('Error loading saved filters:', error);
  }
}

async function saveCurrentFilters() {
  try {
    const filters = {
      projectId: document.getElementById('projectFilter').value,
      label: document.getElementById('labelFilter').value
      // Note: search is not persisted as per requirements
    };
    
    await browser.storage.local.set({ taskFilters: filters });
    console.log('Saved filters:', filters);
  } catch (error) {
    console.error('Error saving filters:', error);
  }
}

async function clearSavedFilters() {
  try {
    await browser.storage.local.remove('taskFilters');
    console.log('Cleared saved filters');
  } catch (error) {
    console.error('Error clearing filters:', error);
  }
}

function applyFiltersAndDisplay() {
  const searchTerm = document.getElementById('taskSearch').value.toLowerCase();
  const projectFilter = document.getElementById('projectFilter').value;
  const labelFilter = document.getElementById('labelFilter').value;
  
  filteredTasks = allTasks.filter(task => {
    // Text search (fuzzy search - not persistent)
    const matchesSearch = !searchTerm || 
      task.content.toLowerCase().includes(searchTerm) ||
      (task.description && task.description.toLowerCase().includes(searchTerm));
    
    // Project filter (persistent)
    const matchesProject = !projectFilter || task.project_id === projectFilter;
    
    // Label filter (persistent)
    const matchesLabel = !labelFilter || 
      (task.labels && task.labels.some(label => label === labelFilter));
    
    return matchesSearch && matchesProject && matchesLabel;
  });
  
  displayTasks(filteredTasks);
  clearTaskSelection();
}

function formatEmailForTodoist(message) {
  const lines = [];
  
  // Add bullet point as specified in requirements
  lines.push('* **Email from Thunderbird**');
  lines.push('');
  
  // Email metadata
  lines.push(`**Subject:** ${message.subject || 'No Subject'}`);
  lines.push(`**From:** ${message.author || 'Unknown'}`);
  lines.push(`**Date:** ${message.date ? new Date(message.date).toLocaleString() : 'Unknown'}`);
  
  // Add Thunderbird link if possible (this might not work in all cases)
  if (message.id) {
    lines.push(`**Message ID:** ${message.id}`);
  }
  
  lines.push('');
  
  // Add email preview (first 200 characters as per requirements)
  if (message.snippet || message.preview) {
    const preview = (message.snippet || message.preview).substring(0, 200);
    lines.push(`**Preview:** ${preview}${preview.length === 200 ? '...' : ''}`);
  }
  
  return lines.join('\n');
}

// Utility function for debouncing search input
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Error handler
window.addEventListener('error', (error) => {
  console.error('Modal error:', error);
  updateStatus('An unexpected error occurred', 'error');
});