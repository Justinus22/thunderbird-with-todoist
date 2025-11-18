// Popup script for Thunderbird-Todoist Integration

// State
let allTasks = [];
let allProjects = [];
let allLabels = [];
let allSections = [];
let selectedTask = null;

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

async function testConnection() {
  const token = await getTodoistToken();
  if (!token) return false;

  updateStatus('Testing connection...', 'info');

  try {
    const response = await fetch('https://api.todoist.com/api/v1/projects', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      const projectCount = data.results?.length || 0;
      updateStatus(`Connected! Found ${projectCount} projects.`, 'success');
      return true;
    }
    updateStatus('Connection failed', 'error');
    return false;
  } catch (error) {
    return false;
  }
}

// Initialization
async function init() {
  const token = await getTodoistToken();

  if (token) {
    const isConnected = await testConnection();
    if (isConnected) {
      await loadTaskInterface();
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

// Task Interface
async function loadTaskInterface() {
  document.getElementById('setupSection').classList.add('hidden');
  document.getElementById('main-content').innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      Loading tasks...
    </div>
  `;

  try {
    const [tasksResponse, projectsResponse, labelsResponse, sectionsResponse] = await Promise.all([
      browser.runtime.sendMessage({ action: 'GET_ALL_TASKS' }),
      browser.runtime.sendMessage({ action: 'GET_PROJECTS' }),
      browser.runtime.sendMessage({ action: 'GET_LABELS' }),
      browser.runtime.sendMessage({ action: 'GET_SECTIONS' })
    ]);

    allTasks = tasksResponse.success ? tasksResponse.data : [];
    allProjects = projectsResponse.success ? projectsResponse.projects : [];
    allLabels = labelsResponse.success ? labelsResponse.data : [];
    allSections = sectionsResponse.success ? sectionsResponse.data : [];

    renderInterface();
    await loadSavedFilters();
    applyFilters();
  } catch (error) {
    document.getElementById('main-content').innerHTML = '<div class="status error">Error loading tasks</div>';
  }
}

function renderInterface() {
  document.getElementById('main-content').innerHTML = `
    <div class="task-interface">
      <div class="header">
        <h3>Tasks</h3>
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
        <div class="action-buttons">
          <button id="attachEmailBtn" class="action-btn subnote-btn" disabled>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            Subnote
          </button>
          <button id="addTaskBtn" class="action-btn add-task-btn">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M14 3H2a1 1 0 00-1 1v8a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1zM4 6h8v1H4V6zm0 2h6v1H4V8z"/>
            </svg>
            Add Task
          </button>
        </div>
      </div>

      <!-- Add Task Modal -->
      <div id="addTaskModal" class="modal hidden">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Create New Task from Email</h3>
            <button id="closeModal" class="close-btn">&times;</button>
          </div>
          <div class="modal-body">
            <label>
              Task Title
              <input type="text" id="taskTitle" class="modal-input" placeholder="Email subject will be used">
            </label>
            <label>
              Project *
              <select id="modalProjectSelect" class="modal-select">
                <option value="">Select a project</option>
                ${allProjects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
              </select>
            </label>
            <label>
              Section (optional)
              <select id="modalSectionSelect" class="modal-select">
                <option value="">No section</option>
              </select>
            </label>
          </div>
          <div class="modal-footer">
            <button id="cancelTaskBtn" class="btn-secondary">Cancel</button>
            <button id="createTaskBtn" class="btn">Create Task</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach event listeners
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
  document.getElementById('addTaskBtn').addEventListener('click', openAddTaskModal);

  // Modal event listeners
  document.getElementById('closeModal').addEventListener('click', closeAddTaskModal);
  document.getElementById('cancelTaskBtn').addEventListener('click', closeAddTaskModal);
  document.getElementById('createTaskBtn').addEventListener('click', createNewTask);
  document.getElementById('modalProjectSelect').addEventListener('change', updateSectionOptions);
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

  // Add click listeners
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
    updateStatus('Creating subtask from email...', 'info');

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
      updateStatus('Email added as subtask successfully!', 'success');
    } else {
      updateStatus(`Failed: ${subtaskResponse.error}`, 'error');
    }
  } catch (error) {
    updateStatus('Error creating subtask', 'error');
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

// Settings
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

// Add Task Modal
function openAddTaskModal() {
  const modal = document.getElementById('addTaskModal');
  if (modal) {
    modal.classList.remove('hidden');

    // Reset form
    document.getElementById('taskTitle').value = '';
    document.getElementById('modalProjectSelect').value = '';
    document.getElementById('modalSectionSelect').value = '';
    document.getElementById('modalSectionSelect').innerHTML = '<option value="">No section</option>';
  }
}

function closeAddTaskModal() {
  const modal = document.getElementById('addTaskModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

function updateSectionOptions() {
  const projectId = document.getElementById('modalProjectSelect').value;
  const sectionSelect = document.getElementById('modalSectionSelect');

  if (!projectId) {
    sectionSelect.innerHTML = '<option value="">No section</option>';
    return;
  }

  const projectSections = allSections.filter(s => s.project_id === projectId);
  sectionSelect.innerHTML = '<option value="">No section</option>' +
    projectSections.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
}

async function createNewTask() {
  const projectId = document.getElementById('modalProjectSelect').value;
  const sectionId = document.getElementById('modalSectionSelect').value;
  const customTitle = document.getElementById('taskTitle').value.trim();

  if (!projectId) {
    updateStatus('Please select a project', 'error');
    return;
  }

  try {
    updateStatus('Creating task from email...', 'info');

    const response = await browser.runtime.sendMessage({ type: 'GET_CURRENT_MESSAGE' });
    if (!response.success || !response.message) {
      updateStatus('No email selected', 'error');
      return;
    }

    const taskTitle = customTitle || response.message.subject || 'No Subject';
    const taskDescription = response.message.body || '';

    // Create task via background script
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
      updateStatus('Task created successfully!', 'success');
      closeAddTaskModal();

      // Refresh tasks
      await loadTaskInterface();
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
