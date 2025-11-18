// Main Popup - Choose action or browse tasks

// State
let currentView = 'menu'; // 'menu', 'subnote', 'addtask'
let allTasks = [];
let allProjects = [];
let allLabels = [];
let allSections = [];
let selectedTask = null;
let iconOnlyMode = false;

// Utility functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function updateStatus(message, type = 'info') {
  const status = document.getElementById('status');
  if (status) {
    status.textContent = message;
    status.className = `status ${type}`;
    status.classList.remove('hidden');

    if (type === 'success' || type === 'info') {
      setTimeout(() => status.classList.add('hidden'), 5000);
    }
  }
}

function debounce(func, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// API helpers
async function getTodoistToken() {
  const { todoistToken } = await browser.storage.local.get('todoistToken');
  return todoistToken;
}

async function getIconOnlyMode() {
  const { iconOnlyMode } = await browser.storage.local.get('iconOnlyMode');
  return iconOnlyMode || false;
}

async function testConnection() {
  const token = await getTodoistToken();
  if (!token) return false;

  try {
    const response = await fetch('https://api.todoist.com/api/v1/projects', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

// Initialization
async function init() {
  const token = await getTodoistToken();
  iconOnlyMode = await getIconOnlyMode();

  if (token) {
    const isConnected = await testConnection();
    if (isConnected) {
      showMenu();
    } else {
      showSetup();
    }
  } else {
    showSetup();
  }

  setupEventListeners();
}

function showSetup() {
  document.getElementById('setupSection').classList.remove('hidden');
  document.getElementById('main-content').innerHTML = '';
}

function setupEventListeners() {
  const openConfigBtn = document.getElementById('openConfigBtn');
  if (openConfigBtn) {
    openConfigBtn.addEventListener('click', async () => {
      try {
        await browser.tabs.create({
          url: browser.runtime.getURL('config.html'),
          active: true
        });
      } catch (error) {
        updateStatus('Failed to open configuration', 'error');
      }
    });
  }
}

// Main Menu
function showMenu() {
  document.getElementById('setupSection').classList.add('hidden');
  currentView = 'menu';

  const buttonContent = iconOnlyMode ? '' : `
    <span class="action-text">Add as Subnote</span>
  `;

  const buttonContent2 = iconOnlyMode ? '' : `
    <span class="action-text">Add Task</span>
  `;

  document.getElementById('main-content').innerHTML = `
    <div class="action-menu">
      <div class="header">
        <h3>Todoist Actions</h3>
        <button id="settingsBtn" class="icon-btn" title="Settings">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 6a4 4 0 100 8 4 4 0 000-8zm-2 4a2 2 0 114 0 2 2 0 01-4 0z"/>
            <path d="M10 0C9.651 0 9.303.025 8.959.075l-.866 2.033A8.07 8.07 0 006.5 3.232L4.232 2.366l-.866.5a10 10 0 00-1.5 2.598l.866.5 1.768 1.036v2l-1.768 1.036-.866.5a10 10 0 001.5 2.598l.866.5 2.268-.866a8.07 8.07 0 001.593 1.124l.866 2.033c.344.05.692.075 1.041.075s.697-.025 1.041-.075l.866-2.033a8.07 8.07 0 001.593-1.124l2.268.866.866-.5a10 10 0 001.5-2.598l-.866-.5-1.768-1.036v-2l1.768-1.036.866-.5a10 10 0 00-1.5-2.598l-.866-.5-2.268.866a8.07 8.07 0 00-1.593-1.124L11.041.075A10.07 10.07 0 0010 0z"/>
          </svg>
        </button>
      </div>

      <div class="action-buttons-large">
        <button id="subnoteBtn" class="action-btn-large subnote-btn" title="Attach email to existing task as subnote">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="currentColor">
            <path d="M16 4v24M4 16h24" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
            <circle cx="16" cy="16" r="14" stroke="currentColor" stroke-width="2" fill="none"/>
          </svg>
          ${buttonContent}
        </button>

        <button id="addTaskBtn" class="action-btn-large add-task-btn" title="Create new task from email">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="currentColor">
            <rect x="6" y="6" width="20" height="20" rx="2" stroke="currentColor" stroke-width="2" fill="none"/>
            <line x1="10" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="2"/>
            <line x1="10" y1="16" x2="18" y2="16" stroke="currentColor" stroke-width="2"/>
            <line x1="10" y1="20" x2="20" y2="20" stroke="currentColor" stroke-width="2"/>
          </svg>
          ${buttonContent2}
        </button>
      </div>
    </div>
  `;

  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document.getElementById('subnoteBtn').addEventListener('click', () => loadSubnoteView());
  document.getElementById('addTaskBtn').addEventListener('click', () => loadAddTaskView());
}

async function openSettings() {
  try {
    await browser.tabs.create({
      url: browser.runtime.getURL('config.html'),
      active: true
    });
  } catch (error) {
    updateStatus('Failed to open settings', 'error');
  }
}

// Subnote View
async function loadSubnoteView() {
  currentView = 'subnote';
  document.getElementById('main-content').innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      Loading tasks...
    </div>
  `;

  try {
    const [tasksResponse, projectsResponse, labelsResponse] = await Promise.all([
      browser.runtime.sendMessage({ action: 'GET_ALL_TASKS' }),
      browser.runtime.sendMessage({ action: 'GET_PROJECTS' }),
      browser.runtime.sendMessage({ action: 'GET_LABELS' })
    ]);

    allTasks = tasksResponse.success ? tasksResponse.data : [];
    allProjects = projectsResponse.success ? projectsResponse.projects : [];
    allLabels = labelsResponse.success ? labelsResponse.data : [];

    renderSubnoteInterface();
    await loadSavedFilters();
    applyFilters();
  } catch (error) {
    document.getElementById('main-content').innerHTML = '<div class="status error">Error loading tasks</div>';
  }
}

function renderSubnoteInterface() {
  document.getElementById('main-content').innerHTML = `
    <div class="task-interface">
      <div class="header">
        <button id="backBtn" class="icon-btn" title="Back">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 4l-6 6 6 6V4z"/>
          </svg>
        </button>
        <h3>Select Task</h3>
        <button id="settingsBtn" class="icon-btn" title="Settings">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 6a4 4 0 100 8 4 4 0 000-8zm-2 4a2 2 0 114 0 2 2 0 01-4 0z"/>
            <path d="M10 0C9.651 0 9.303.025 8.959.075l-.866 2.033A8.07 8.07 0 006.5 3.232L4.232 2.366l-.866.5a10 10 0 00-1.5 2.598l.866.5 1.768 1.036v2l-1.768 1.036-.866.5a10 10 0 001.5 2.598l.866.5 2.268-.866a8.07 8.07 0 001.593 1.124l.866 2.033c.344.05.692.075 1.041.075s.697-.025 1.041-.075l.866-2.033a8.07 8.07 0 001.593-1.124l2.268.866.866-.5a10 10 0 001.5-2.598l-.866-.5-1.768-1.036v-2l1.768-1.036.866-.5a10 10 0 00-1.5-2.598l-.866-.5-2.268.866a8.07 8.07 0 00-1.593-1.124L11.041.075A10.07 10.07 0 0010 0z"/>
          </svg>
        </button>
      </div>

      <div id="status" class="status info hidden"></div>

      <div class="search-filters">
        <div class="search-container">
          <input type="text" id="taskSearch" placeholder="Search tasks..." class="search-input">
          <button id="clearFilters" class="clear-filters-btn">Clear</button>
        </div>
        <div class="filter-row">
          <select id="projectFilter" class="filter-select">
            <option value="">All Projects</option>
            ${allProjects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
          </select>
          <select id="labelFilter" class="filter-select">
            <option value="">All Labels</option>
            ${allLabels.map(l => `<option value="${l.name}">${escapeHtml(l.name)}</option>`).join('')}
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
        <button id="attachEmailBtn" class="action-btn subnote-btn" disabled style="width: 100%;">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          Add as Subnote
        </button>
      </div>
    </div>
  `;

  document.getElementById('backBtn').addEventListener('click', showMenu);
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document.getElementById('taskSearch').addEventListener('input', debounce(applyFilters, 300));
  document.getElementById('projectFilter').addEventListener('change', () => {
    saveFilters();
    applyFilters();
  });
  document.getElementById('labelFilter').addEventListener('change', () => {
    saveFilters();
    applyFilters();
  });
  document.getElementById('clearFilters').addEventListener('click', clearFilters);
  document.getElementById('attachEmailBtn').addEventListener('click', attachEmail);
}

function applyFilters() {
  const searchTerm = document.getElementById('taskSearch')?.value.toLowerCase() || '';
  const projectFilter = document.getElementById('projectFilter')?.value || '';
  const labelFilter = document.getElementById('labelFilter')?.value || '';

  const filtered = allTasks.filter(task => {
    const matchesSearch = !searchTerm ||
      task.content.toLowerCase().includes(searchTerm) ||
      (task.description?.toLowerCase().includes(searchTerm));

    const matchesProject = !projectFilter || task.project_id === projectFilter;
    const matchesLabel = !labelFilter || task.labels?.includes(labelFilter);

    return matchesSearch && matchesProject && matchesLabel;
  });

  displayTasks(filtered);
}

function displayTasks(tasks) {
  const taskList = document.getElementById('taskList');
  if (!taskList) return;

  if (tasks.length === 0) {
    taskList.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No tasks found</div>';
    return;
  }

  taskList.innerHTML = tasks.map(task => `
    <div class="task-item" data-task-id="${task.id}">
      <div class="task-title">${escapeHtml(task.content)}</div>
      <div class="task-meta">
        <span class="task-project">Project ${task.project_id}</span>
        ${task.due ? `<span class="task-due">${formatDueDate(task.due.date)}</span>` : ''}
        ${task.labels?.length ? `<span class="task-labels">${task.labels.map(l => `#${l}`).join(' ')}</span>` : ''}
      </div>
    </div>
  `).join('');

  taskList.querySelectorAll('.task-item').forEach(el => {
    el.addEventListener('click', () => {
      const taskId = el.dataset.taskId;
      const task = allTasks.find(t => t.id === taskId);
      if (task) selectTask(task);
    });
  });
}

function formatDueDate(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  const diffDays = Math.ceil((date - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays <= 7) return `Due in ${diffDays} days`;
  return '';
}

function selectTask(task) {
  document.querySelectorAll('.task-item').forEach(el => el.classList.remove('selected'));

  const taskElement = document.querySelector(`[data-task-id="${task.id}"]`);
  if (taskElement) taskElement.classList.add('selected');

  selectedTask = task;

  const display = document.getElementById('selectedTaskDisplay');
  if (display) {
    display.innerHTML = `
      <div class="selected-task-info">
        <h4>${escapeHtml(task.content)}</h4>
        ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}
        <div class="task-meta">
          ${task.labels?.length ? `<span class="task-labels">${task.labels.join(', ')}</span>` : ''}
          ${task.due ? `<span class="task-due">Due: ${new Date(task.due.date).toLocaleDateString()}</span>` : ''}
        </div>
      </div>
    `;
  }

  const attachBtn = document.getElementById('attachEmailBtn');
  if (attachBtn) attachBtn.disabled = false;
}

async function attachEmail() {
  if (!selectedTask) {
    updateStatus('No task selected', 'error');
    return;
  }

  try {
    updateStatus('Creating subnote...', 'info');

    const response = await browser.runtime.sendMessage({ type: 'GET_CURRENT_MESSAGE' });
    if (!response.success || !response.message) {
      updateStatus('No email selected', 'error');
      return;
    }

    const subtaskResponse = await browser.runtime.sendMessage({
      type: 'CREATE_EMAIL_SUBTASK',
      parentTaskId: selectedTask.id,
      emailSubject: response.message.subject || 'No Subject',
      emailBody: response.message.body || ''
    });

    if (subtaskResponse.success) {
      updateStatus('Email added as subnote!', 'success');
    } else {
      updateStatus(`Failed: ${subtaskResponse.error}`, 'error');
    }
  } catch (error) {
    updateStatus('Error creating subnote', 'error');
  }
}

async function loadSavedFilters() {
  try {
    const { taskFilters } = await browser.storage.local.get('taskFilters');
    if (taskFilters) {
      const projectFilter = document.getElementById('projectFilter');
      const labelFilter = document.getElementById('labelFilter');

      if (projectFilter && taskFilters.projectId) {
        projectFilter.value = taskFilters.projectId;
      }
      if (labelFilter && taskFilters.label) {
        labelFilter.value = taskFilters.label;
      }
    }
  } catch (error) {
    // Ignore
  }
}

async function saveFilters() {
  try {
    await browser.storage.local.set({
      taskFilters: {
        projectId: document.getElementById('projectFilter')?.value || '',
        label: document.getElementById('labelFilter')?.value || ''
      }
    });
  } catch (error) {
    // Ignore
  }
}

function clearFilters() {
  const taskSearch = document.getElementById('taskSearch');
  const projectFilter = document.getElementById('projectFilter');
  const labelFilter = document.getElementById('labelFilter');

  if (taskSearch) taskSearch.value = '';
  if (projectFilter) projectFilter.value = '';
  if (labelFilter) labelFilter.value = '';

  browser.storage.local.remove('taskFilters');
  applyFilters();
}

// Add Task View
async function loadAddTaskView() {
  currentView = 'addtask';
  document.getElementById('main-content').innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      Loading...
    </div>
  `;

  try {
    const [projectsResponse, sectionsResponse] = await Promise.all([
      browser.runtime.sendMessage({ action: 'GET_PROJECTS' }),
      browser.runtime.sendMessage({ action: 'GET_SECTIONS' })
    ]);

    allProjects = projectsResponse.success ? projectsResponse.projects : [];
    allSections = sectionsResponse.success ? sectionsResponse.data : [];

    renderAddTaskForm();
  } catch (error) {
    document.getElementById('main-content').innerHTML = '<div class="status error">Error loading data</div>';
  }
}

function renderAddTaskForm() {
  document.getElementById('main-content').innerHTML = `
    <div class="add-task-form">
      <div class="header">
        <button id="backBtn" class="icon-btn" title="Back">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 4l-6 6 6 6V4z"/>
          </svg>
        </button>
        <h3>Create Task</h3>
        <button id="settingsBtn" class="icon-btn" title="Settings">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 6a4 4 0 100 8 4 4 0 000-8zm-2 4a2 2 0 114 0 2 2 0 01-4 0z"/>
            <path d="M10 0C9.651 0 9.303.025 8.959.075l-.866 2.033A8.07 8.07 0 006.5 3.232L4.232 2.366l-.866.5a10 10 0 00-1.5 2.598l.866.5 1.768 1.036v2l-1.768 1.036-.866.5a10 10 0 001.5 2.598l.866.5 2.268-.866a8.07 8.07 0 001.593 1.124l.866 2.033c.344.05.692.075 1.041.075s.697-.025 1.041-.075l.866-2.033a8.07 8.07 0 001.593-1.124l2.268.866.866-.5a10 10 0 001.5-2.598l-.866-.5-1.768-1.036v-2l1.768-1.036.866-.5a10 10 0 00-1.5-2.598l-.866-.5-2.268.866a8.07 8.07 0 00-1.593-1.124L11.041.075A10.07 10.07 0 0010 0z"/>
          </svg>
        </button>
      </div>

      <div id="status" class="status info hidden"></div>

      <div class="form-container">
        <label class="form-label">
          Task Title
          <input type="text" id="taskTitle" class="form-input" placeholder="Email subject will be used if empty">
        </label>

        <label class="form-label">
          Project <span class="required">*</span>
          <select id="projectSelect" class="form-select">
            <option value="">Select a project</option>
            ${allProjects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
          </select>
        </label>

        <label class="form-label">
          Section (optional)
          <select id="sectionSelect" class="form-select">
            <option value="">No section</option>
          </select>
        </label>

        <button id="createTaskBtn" class="btn create-task-btn">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>
            <line x1="4" y1="6" x2="12" y2="6" stroke="currentColor" stroke-width="1.5"/>
            <line x1="4" y1="8" x2="10" y2="8" stroke="currentColor" stroke-width="1.5"/>
            <line x1="4" y1="10" x2="11" y2="10" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          Create Task
        </button>
      </div>
    </div>
  `;

  document.getElementById('backBtn').addEventListener('click', showMenu);
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document.getElementById('projectSelect').addEventListener('change', updateSectionOptions);
  document.getElementById('createTaskBtn').addEventListener('click', createTask);
}

function updateSectionOptions() {
  const projectId = document.getElementById('projectSelect').value;
  const sectionSelect = document.getElementById('sectionSelect');

  if (!projectId) {
    sectionSelect.innerHTML = '<option value="">No section</option>';
    return;
  }

  const projectSections = allSections.filter(s => s.project_id === projectId);
  sectionSelect.innerHTML = '<option value="">No section</option>' +
    projectSections.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
}

async function createTask() {
  const projectId = document.getElementById('projectSelect').value;
  const sectionId = document.getElementById('sectionSelect').value;
  const customTitle = document.getElementById('taskTitle').value.trim();

  if (!projectId) {
    updateStatus('Please select a project', 'error');
    return;
  }

  try {
    updateStatus('Creating task...', 'info');

    const response = await browser.runtime.sendMessage({ type: 'GET_CURRENT_MESSAGE' });

    let taskTitle, taskDescription;

    if (response.success && response.message) {
      taskTitle = customTitle || response.message.subject || 'No Subject';
      taskDescription = response.message.body || '';
    } else {
      if (!customTitle) {
        updateStatus('Please enter a task title or select an email', 'error');
        return;
      }
      taskTitle = customTitle;
      taskDescription = '';
    }

    const taskPayload = {
      content: taskTitle,
      description: taskDescription,
      project_id: projectId
    };

    if (sectionId) {
      taskPayload.section_id = sectionId;
    }

    const taskResponse = await browser.runtime.sendMessage({
      type: 'CREATE_TASK',
      taskData: taskPayload
    });

    if (taskResponse.success) {
      updateStatus('Task created!', 'success');
      document.getElementById('taskTitle').value = '';
      document.getElementById('projectSelect').value = '';
      document.getElementById('sectionSelect').value = '';
    } else {
      updateStatus(`Failed: ${taskResponse.error}`, 'error');
    }
  } catch (error) {
    updateStatus('Error creating task', 'error');
  }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);

// Error handler
window.addEventListener('error', () => {
  updateStatus('An unexpected error occurred', 'error');
});
