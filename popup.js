// Main Popup - Tabbed interface

// State
let currentTab = 'subnote'; // 'subnote', 'addtask'
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

  if (token) {
    const isConnected = await testConnection();
    if (isConnected) {
      await loadTabbedInterface();
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

// Tabbed Interface
async function loadTabbedInterface() {
  document.getElementById('setupSection').classList.add('hidden');

  // Load all data first
  document.getElementById('main-content').innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      Loading...
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

    renderTabbedInterface();
    await loadSavedFilters();
    showTab('subnote'); // Default to subnote tab
  } catch (error) {
    document.getElementById('main-content').innerHTML = '<div class="status error">Error loading data</div>';
  }
}

function renderTabbedInterface() {
  document.getElementById('main-content').innerHTML = `
    <div class="tabbed-interface">
      <div class="header">
        <div class="tab-buttons">
          <button class="tab-btn active" data-tab="subnote">Subnote</button>
          <button class="tab-btn" data-tab="addtask">Add Task</button>
          <button class="tab-btn" data-tab="notes">Notes</button>
        </div>
        <button id="settingsBtn" class="icon-btn" title="Settings">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 6a4 4 0 100 8 4 4 0 000-8zm-2 4a2 2 0 114 0 2 2 0 01-4 0z"/>
            <path d="M10 0C9.651 0 9.303.025 8.959.075l-.866 2.033A8.07 8.07 0 006.5 3.232L4.232 2.366l-.866.5a10 10 0 00-1.5 2.598l.866.5 1.768 1.036v2l-1.768 1.036-.866.5a10 10 0 001.5 2.598l.866.5 2.268-.866a8.07 8.07 0 001.593 1.124l.866 2.033c.344.05.692.075 1.041.075s.697-.025 1.041-.075l.866-2.033a8.07 8.07 0 001.593-1.124l2.268.866.866-.5a10 10 0 001.5-2.598l-.866-.5-1.768-1.036v-2l1.768-1.036.866-.5a10 10 0 00-1.5-2.598l-.866-.5-2.268.866a8.07 8.07 0 00-1.593-1.124L11.041.075A10.07 10.07 0 0010 0z"/>
          </svg>
        </button>
      </div>

      <div id="status" class="status info hidden"></div>

      <!-- Subnote Tab Content -->
      <div class="tab-content active" id="subnote-tab">
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

      <!-- Add Task Tab Content -->
      <div class="tab-content" id="addtask-tab">
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

      <!-- Notes Tab Content -->
      <div class="tab-content" id="notes-tab">
        <div class="search-filters">
          <div class="search-container">
            <input type="text" id="notesSearch" placeholder="Search notes..." class="search-input">
            <button id="clearNotesFilters" class="clear-filters-btn">Clear</button>
          </div>
          <div class="filter-row">
            <select id="notesProjectFilter" class="filter-select">
              <option value="">All Projects</option>
              ${allProjects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
            </select>
            <select id="notesLabelFilter" class="filter-select">
              <option value="">All Labels</option>
              ${allLabels.map(l => `<option value="${l.name}">${escapeHtml(l.name)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="task-list-container">
          <div id="notesList" class="task-list"></div>
        </div>

        <div class="selected-task-area">
          <div id="selectedNoteDisplay" class="selected-task">
            <p>No note selected</p>
          </div>
          <button id="openEmailFromNoteBtn" class="action-btn" disabled style="width: 100%; background: #4CAF50;">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 3h12v10H2V3zm0 0l6 4 6-4M2 13l4-3m8 3l-4-3" stroke="currentColor" stroke-width="1.5" fill="none"/>
            </svg>
            Open Email
          </button>
        </div>
      </div>
    </div>
  `;

  // Setup tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      showTab(tab);
    });
  });

  // Setup event listeners
  document.getElementById('settingsBtn').addEventListener('click', openSettings);

  // Subnote tab listeners
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

  // Add task tab listeners
  document.getElementById('projectSelect').addEventListener('change', updateSectionOptions);
  document.getElementById('createTaskBtn').addEventListener('click', createTask);

  // Notes tab listeners
  document.getElementById('notesSearch').addEventListener('input', debounce(applyNotesFilters, 300));
  document.getElementById('notesProjectFilter').addEventListener('change', applyNotesFilters);
  document.getElementById('notesLabelFilter').addEventListener('change', applyNotesFilters);
  document.getElementById('clearNotesFilters').addEventListener('click', clearNotesFilters);
  document.getElementById('openEmailFromNoteBtn').addEventListener('click', openEmailFromNote);
}

function showTab(tabName) {
  currentTab = tabName;

  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.dataset.tab === tabName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`${tabName}-tab`).classList.add('active');

  // If showing subnote tab, display tasks
  if (tabName === 'subnote') {
    applyFilters();
  } else if (tabName === 'notes') {
    applyNotesFilters();
  }
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
        ${task.description ? `<p class="task-description">${escapeHtml(task.description.split('---')[0].trim())}</p>` : ''}
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
      emailBody: response.message.body || '',
      headerMessageId: response.message.headerMessageId
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

    let taskTitle, taskDescription, headerMessageId;

    if (response.success && response.message) {
      taskTitle = customTitle || response.message.subject || 'No Subject';
      taskDescription = response.message.body || '';
      headerMessageId = response.message.headerMessageId;
    } else {
      if (!customTitle) {
        updateStatus('Please enter a task title or select an email', 'error');
        return;
      }
      taskTitle = customTitle;
      taskDescription = '';
      headerMessageId = null;
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
      taskData: taskPayload,
      headerMessageId: headerMessageId
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

// Notes tab functions
function applyNotesFilters() {
  const searchTerm = document.getElementById('notesSearch')?.value.toLowerCase() || '';
  const projectFilter = document.getElementById('notesProjectFilter')?.value || '';
  const labelFilter = document.getElementById('notesLabelFilter')?.value || '';

  // Filter tasks that have email IDs
  const filtered = allTasks.filter(task => {
    const hasEmailId = task.description && task.description.includes('📧 Email ID:');
    if (!hasEmailId) return false;

    const matchesSearch = !searchTerm ||
      task.content.toLowerCase().includes(searchTerm) ||
      (task.description?.toLowerCase().includes(searchTerm));

    const matchesProject = !projectFilter || task.project_id === projectFilter;
    const matchesLabel = !labelFilter || task.labels?.includes(labelFilter);

    return matchesSearch && matchesProject && matchesLabel;
  });

  displayNotes(filtered);
}

function displayNotes(tasks) {
  const notesList = document.getElementById('notesList');
  if (!notesList) return;

  if (tasks.length === 0) {
    notesList.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No notes with emails found</div>';
    return;
  }

  notesList.innerHTML = tasks.map(task => `
    <div class="task-item" data-note-id="${task.id}">
      <div class="task-title">${escapeHtml(task.content)}</div>
      <div class="task-meta">
        <span class="task-project">Project ${task.project_id}</span>
        ${task.due ? `<span class="task-due">${formatDueDate(task.due.date)}</span>` : ''}
        <span style="color: #4CAF50;">📧</span>
      </div>
    </div>
  `).join('');

  notesList.querySelectorAll('.task-item').forEach(el => {
    el.addEventListener('click', () => {
      const taskId = el.dataset.noteId;
      const task = allTasks.find(t => t.id === taskId);
      if (task) selectNote(task);
    });
  });
}

function selectNote(task) {
  document.querySelectorAll('.task-item').forEach(el => el.classList.remove('selected'));

  const noteElement = document.querySelector(`[data-note-id="${task.id}"]`);
  if (noteElement) noteElement.classList.add('selected');

  selectedTask = task;

  const display = document.getElementById('selectedNoteDisplay');
  if (display) {
    display.innerHTML = `
      <div class="selected-task-info">
        <h4>${escapeHtml(task.content)}</h4>
        ${task.description ? `<p class="task-description">${escapeHtml(task.description.split('---')[0].trim())}</p>` : ''}
        <div class="task-meta">
          ${task.labels?.length ? `<span class="task-labels">${task.labels.join(', ')}</span>` : ''}
          ${task.due ? `<span class="task-due">Due: ${new Date(task.due.date).toLocaleDateString()}</span>` : ''}
        </div>
      </div>
    `;
  }

  const openEmailBtn = document.getElementById('openEmailFromNoteBtn');
  if (openEmailBtn) openEmailBtn.disabled = false;
}

async function openEmailFromNote() {
  if (!selectedTask || !selectedTask.description) {
    updateStatus('No note selected', 'error');
    return;
  }

  const match = selectedTask.description.match(/📧 Email ID: (.+?)(?:\n|$)/);
  if (!match) {
    updateStatus('No email ID found', 'error');
    return;
  }

  const headerMessageId = match[1].trim();

  try {
    const response = await browser.runtime.sendMessage({
      type: 'OPEN_EMAIL_FROM_LINK',
      headerMessageId: headerMessageId
    });

    if (response.success) {
      updateStatus('Opening email...', 'success');
    } else {
      updateStatus(`Failed to open email: ${response.error}`, 'error');
    }
  } catch (error) {
    updateStatus('Error opening email', 'error');
  }
}

function clearNotesFilters() {
  const notesSearch = document.getElementById('notesSearch');
  const notesProjectFilter = document.getElementById('notesProjectFilter');
  const notesLabelFilter = document.getElementById('notesLabelFilter');

  if (notesSearch) notesSearch.value = '';
  if (notesProjectFilter) notesProjectFilter.value = '';
  if (notesLabelFilter) notesLabelFilter.value = '';

  applyNotesFilters();
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);

// Error handler
window.addEventListener('error', () => {
  updateStatus('An unexpected error occurred', 'error');
});
