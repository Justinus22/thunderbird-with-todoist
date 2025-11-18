// Popup script for Thunderbird-Todoist Integration

// State
let allTasks = [];
let allProjects = [];
let allLabels = [];
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
    const [tasksResponse, projectsResponse, labelsResponse] = await Promise.all([
      browser.runtime.sendMessage({ action: 'GET_ALL_TASKS' }),
      browser.runtime.sendMessage({ action: 'GET_PROJECTS' }),
      browser.runtime.sendMessage({ action: 'GET_LABELS' })
    ]);

    allTasks = tasksResponse.success ? tasksResponse.data : [];
    allProjects = projectsResponse.success ? projectsResponse.projects : [];
    allLabels = labelsResponse.success ? labelsResponse.data : [];

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
        <button id="attachEmailBtn" class="attach-email-btn" disabled>
          Add Email as Subtask
        </button>
      </div>
    </div>
  `;

  // Attach event listeners
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

// Initialize on load
document.addEventListener('DOMContentLoaded', init);

// Error handler
window.addEventListener('error', () => {
  updateStatus('An unexpected error occurred', 'error');
});
