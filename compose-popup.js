// Compose Popup Script
// Handles task selection in the email compose window
// When user sends email, the selected task is moved to target section
// and email content is added as a subtask note

// State
let allTasks = [];
let allProjects = [];
let allSections = [];
let selectedTask = null;
let currentTab = null;

// Utility functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getProjectName(projectId) {
  const project = allProjects.find(p => p.id === projectId);
  return project ? project.name : 'Unknown Project';
}

function updateStatus(message, type = 'info') {
  const status = document.getElementById('status');
  if (status) {
    status.textContent = message;
    status.className = `status ${type}`;
    status.classList.remove('hidden');

    if (type === 'success' || type === 'info') {
      setTimeout(() => status.classList.add('hidden'), 3000);
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

// Storage helpers
async function getComposeSettings() {
  const { composeSettings } = await browser.storage.local.get('composeSettings');
  return composeSettings || { projectId: '', targetSectionId: '' };
}

async function saveComposeSettings(settings) {
  await browser.storage.local.set({ composeSettings: settings });
}

async function getComposeState() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tabId = tabs[0]?.id;
  if (!tabId) return null;

  const { composeStates } = await browser.storage.local.get('composeStates');
  return composeStates?.[tabId] || null;
}

async function saveComposeState(taskId, projectId, sectionId) {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tabId = tabs[0]?.id;
  if (!tabId) return;

  const { composeStates } = await browser.storage.local.get('composeStates');
  const states = composeStates || {};

  if (taskId) {
    // Store null instead of empty string for sectionId
    states[tabId] = {
      taskId,
      projectId,
      sectionId: sectionId && sectionId !== '' ? sectionId : null
    };
  } else {
    delete states[tabId];
  }

  await browser.storage.local.set({ composeStates: states });
}

// Initialization
async function init() {
  const token = await getTodoistToken();

  if (token) {
    const isConnected = await testConnection();
    if (isConnected) {
      await loadInterface();
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

// Main Interface
async function loadInterface() {
  document.getElementById('setupSection').classList.add('hidden');

  // Show loading
  document.getElementById('main-content').innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      Loading...
    </div>
  `;

  try {
    // Load data
    const [tasksResponse, projectsResponse, sectionsResponse] = await Promise.all([
      browser.runtime.sendMessage({ action: 'GET_ALL_TASKS' }),
      browser.runtime.sendMessage({ action: 'GET_PROJECTS' }),
      browser.runtime.sendMessage({ action: 'GET_SECTIONS' })
    ]);

    allTasks = tasksResponse.success ? tasksResponse.data : [];
    allProjects = projectsResponse.success ? projectsResponse.projects : [];
    allSections = sectionsResponse.success ? sectionsResponse.data : [];

    // Get current tab
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    currentTab = tabs[0];

    // Load saved settings and state
    const settings = await getComposeSettings();
    const state = await getComposeState();

    renderInterface(settings, state);
  } catch (error) {
    document.getElementById('main-content').innerHTML = '<div class="status error">Error loading data</div>';
  }
}

function renderInterface(settings, state) {
  document.getElementById('main-content').innerHTML = `
    <div id="status" class="status hidden"></div>

    <div class="form-group">
      <div class="section-header">
        Select Project
      </div>
      <select id="projectSelect" class="form-select">
        <option value="">Select a project...</option>
        ${allProjects.map(p => `<option value="${p.id}" ${p.id === settings.projectId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
      </select>
    </div>

    <div class="form-group">
      <div class="section-header">
        Select Task
        ${selectedTask ? `<button id="clearTaskBtn" class="clear-btn">Clear</button>` : ''}
      </div>
      <input type="text" id="taskSearch" placeholder="Search tasks..." class="search-input">
      <div id="taskList" class="task-list-compact"></div>
    </div>

    <div class="form-group">
      <div class="section-header">
        Selected Task
      </div>
      <div id="selectedTaskDisplay" class="selected-task-display empty">
        No task selected - email will send normally
      </div>
    </div>

    <div class="form-group">
      <div class="section-header">
        Target Section (optional)
      </div>
      <select id="sectionSelect" class="form-select">
        <option value="">No section / Keep current</option>
      </select>
    </div>

    <div class="info-text">
      When you send this email, the selected task will be moved to the target section and your email will be added as a subtask note.
    </div>
  `;

  // Restore state if exists
  if (state && state.taskId) {
    const task = allTasks.find(t => t.id === state.taskId);
    if (task) {
      selectTask(task);
      // Update section dropdown based on state
      if (state.projectId) {
        updateSectionOptions(state.projectId, state.sectionId);
      }
    }
  } else if (settings.projectId) {
    // If we have a saved project, show its tasks
    updateSectionOptions(settings.projectId, settings.targetSectionId);
    applyFilters();
  }

  // Setup event listeners
  document.getElementById('projectSelect').addEventListener('change', onProjectChange);
  document.getElementById('taskSearch').addEventListener('input', debounce(applyFilters, 300));
  document.getElementById('sectionSelect').addEventListener('change', onSectionChange);

  const clearTaskBtn = document.getElementById('clearTaskBtn');
  if (clearTaskBtn) {
    clearTaskBtn.addEventListener('click', clearTask);
  }

  // Initial task list display
  applyFilters();
}

async function onProjectChange() {
  const projectId = document.getElementById('projectSelect').value;

  // Save the selected project
  const settings = await getComposeSettings();
  settings.projectId = projectId;
  await saveComposeSettings(settings);

  // Update sections
  updateSectionOptions(projectId, '');

  // Filter tasks
  applyFilters();
}

async function onSectionChange() {
  const sectionId = document.getElementById('sectionSelect').value;

  // Save the selected section
  const settings = await getComposeSettings();
  settings.targetSectionId = sectionId;
  await saveComposeSettings(settings);

  // Update compose state if task is selected
  if (selectedTask) {
    const projectId = document.getElementById('projectSelect').value;
    await saveComposeState(selectedTask.id, projectId, sectionId);
  }
}

function updateSectionOptions(projectId, selectedSectionId = '') {
  const sectionSelect = document.getElementById('sectionSelect');

  if (!projectId) {
    sectionSelect.innerHTML = '<option value="">No section / Keep current</option>';
    return;
  }

  const projectSections = allSections.filter(s => s.project_id === projectId);
  sectionSelect.innerHTML = '<option value="">No section / Keep current</option>' +
    projectSections.map(s => `<option value="${s.id}" ${s.id === selectedSectionId ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('');
}

function applyFilters() {
  const searchTerm = document.getElementById('taskSearch')?.value.toLowerCase() || '';
  const projectFilter = document.getElementById('projectSelect')?.value || '';

  const filtered = allTasks.filter(task => {
    const matchesSearch = !searchTerm ||
      task.content.toLowerCase().includes(searchTerm) ||
      (task.description?.toLowerCase().includes(searchTerm));

    const matchesProject = !projectFilter || task.project_id === projectFilter;

    return matchesSearch && matchesProject;
  });

  displayTasks(filtered);
}

function displayTasks(tasks) {
  const taskList = document.getElementById('taskList');
  if (!taskList) return;

  if (tasks.length === 0) {
    taskList.innerHTML = '<div class="no-tasks">No tasks found</div>';
    return;
  }

  taskList.innerHTML = tasks.map(task => `
    <div class="task-item-compact ${selectedTask?.id === task.id ? 'selected' : ''}" data-task-id="${task.id}">
      <div class="task-title-compact">${escapeHtml(task.content)}</div>
      <div class="task-meta-compact">
        ${escapeHtml(getProjectName(task.project_id))}
        ${task.labels?.length ? ` • ${task.labels.map(l => `#${l}`).join(' ')}` : ''}
      </div>
    </div>
  `).join('');

  taskList.querySelectorAll('.task-item-compact').forEach(el => {
    el.addEventListener('click', () => {
      const taskId = el.dataset.taskId;
      const task = allTasks.find(t => t.id === taskId);
      if (task) selectTask(task);
    });
  });
}

async function selectTask(task) {
  selectedTask = task;

  // Update visual selection
  document.querySelectorAll('.task-item-compact').forEach(el => {
    if (el.dataset.taskId === task.id) {
      el.classList.add('selected');
    } else {
      el.classList.remove('selected');
    }
  });

  // Update display
  const display = document.getElementById('selectedTaskDisplay');
  if (display) {
    display.innerHTML = `
      <div style="font-weight: 500; margin-bottom: 4px;">${escapeHtml(task.content)}</div>
      <div style="font-size: 11px; color: #666;">${escapeHtml(getProjectName(task.project_id))}</div>
    `;
    display.classList.remove('empty');
  }

  // Save state
  const projectId = document.getElementById('projectSelect').value;
  const sectionId = document.getElementById('sectionSelect').value;
  await saveComposeState(task.id, projectId, sectionId);

  // Re-render to show clear button
  updateClearButton();
}

function updateClearButton() {
  const header = document.querySelector('.form-group:nth-child(3) .section-header');
  if (header) {
    const existingBtn = document.getElementById('clearTaskBtn');
    if (selectedTask && !existingBtn) {
      header.innerHTML = `
        Select Task
        <button id="clearTaskBtn" class="clear-btn">Clear</button>
      `;
      document.getElementById('clearTaskBtn').addEventListener('click', clearTask);
    } else if (!selectedTask && existingBtn) {
      existingBtn.remove();
    }
  }
}

async function clearTask() {
  selectedTask = null;

  // Clear visual selection
  document.querySelectorAll('.task-item-compact').forEach(el => {
    el.classList.remove('selected');
  });

  // Clear display
  const display = document.getElementById('selectedTaskDisplay');
  if (display) {
    display.innerHTML = 'No task selected - email will send normally';
    display.classList.add('empty');
  }

  // Clear state
  await saveComposeState(null, null, null);

  // Update UI
  updateClearButton();
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);

// Error handler
window.addEventListener('error', () => {
  updateStatus('An unexpected error occurred', 'error');
});
