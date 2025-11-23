// Main Popup - Tabbed interface

// State
let currentTab = 'subnote'; // 'subnote', 'addtask', 'move', 'notes'
let allTasks = [];
let allProjects = [];
let allLabels = [];
let allSections = [];
let selectedTask = null;
let selectedLabels = []; // For include
let excludedLabels = []; // For exclude
let moveSelectedTask = null; // For move tab

// Shared search text across all tabs
let sharedSearchText = '';

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

function truncateText(text, maxLines = 2) {
  if (!text) return '';
  const lines = text.split('\n');
  if (lines.length <= maxLines) return text;
  return lines.slice(0, maxLines).join('\n') + '...';
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
          <button class="tab-btn" data-tab="move">Move</button>
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
            <div class="label-filter-container">
              <button id="labelFilterBtn" class="label-filter-btn">Labels <span class="label-count"></span> ▼</button>
              <div id="labelFilterDropdown" class="label-dropdown hidden">
                <input type="text" id="labelSearch" placeholder="Search labels..." class="label-search">
                <div id="labelList" class="label-list"></div>
              </div>
            </div>
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

      <!-- Move Tab Content -->
      <div class="tab-content" id="move-tab">
        <div class="search-filters">
          <div class="filter-row">
            <select id="moveProjectFilter" class="filter-select">
              <option value="">Select a project</option>
              ${allProjects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
            </select>
          </div>
          <div class="search-container">
            <input type="text" id="moveTaskSearch" placeholder="Search tasks..." class="search-input">
          </div>
        </div>

        <div class="task-list-container">
          <div id="moveTaskList" class="task-list"></div>
        </div>

        <div class="selected-task-area">
          <div id="moveSelectedTaskDisplay" class="selected-task">
            <p>No task selected</p>
          </div>

          <label class="form-label" style="margin-top: 12px;">
            Target Section <span class="required">*</span>
            <select id="moveTargetSection" class="form-select">
              <option value="">Select a section</option>
            </select>
          </label>

          <button id="moveTaskBtn" class="action-btn" disabled style="width: 100%; background: #FF9800;">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 2v12m4-8l-4-4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
            Move Task
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
            <div class="label-filter-container">
              <button id="notesLabelFilterBtn" class="label-filter-btn">Labels <span class="label-count"></span> ▼</button>
              <div id="notesLabelFilterDropdown" class="label-dropdown hidden">
                <input type="text" id="notesLabelSearch" placeholder="Search labels..." class="label-search">
                <div id="notesLabelList" class="label-list"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="task-list-container">
          <div id="notesList" class="task-list"></div>
        </div>

        <div class="selected-task-area">
          <div id="selectedNoteDisplay" class="selected-task">
            <p>No note selected</p>
          </div>
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
  setupLabelFilter('labelFilterBtn', 'labelFilterDropdown', 'labelSearch', 'labelList', 'subnote');
  document.getElementById('clearFilters').addEventListener('click', clearFilters);
  document.getElementById('attachEmailBtn').addEventListener('click', attachEmail);

  // Add task tab listeners
  document.getElementById('projectSelect').addEventListener('change', updateSectionOptions);
  document.getElementById('createTaskBtn').addEventListener('click', createTask);

  // Move tab listeners
  document.getElementById('moveProjectFilter').addEventListener('change', onMoveProjectChange);
  document.getElementById('moveTargetSection').addEventListener('change', onMoveSectionChange);
  document.getElementById('moveTaskSearch').addEventListener('input', debounce(applyMoveFilters, 300));
  document.getElementById('moveTaskBtn').addEventListener('click', moveTask);

  // Notes tab listeners
  document.getElementById('notesSearch').addEventListener('input', debounce(applyNotesFilters, 300));
  document.getElementById('notesProjectFilter').addEventListener('change', applyNotesFilters);
  setupLabelFilter('notesLabelFilterBtn', 'notesLabelFilterDropdown', 'notesLabelSearch', 'notesLabelList', 'notes');
  document.getElementById('clearNotesFilters').addEventListener('click', clearNotesFilters);

  // Initialize Move tab with saved settings
  initializeMoveTab();
}

async function initializeMoveTab() {
  const settings = await getMoveSettings();

  if (settings.projectId) {
    const moveProjectFilter = document.getElementById('moveProjectFilter');
    if (moveProjectFilter) {
      moveProjectFilter.value = settings.projectId;
      updateMoveSectionOptions(settings.projectId, settings.sectionId);
      applyMoveFilters();
    }
  }
}

// Label filter management
function setupLabelFilter(btnId, dropdownId, searchId, listId, tabType) {
  const btn = document.getElementById(btnId);
  const dropdown = document.getElementById(dropdownId);
  const search = document.getElementById(searchId);
  const list = document.getElementById(listId);

  // Populate label list
  renderLabelList(listId, allLabels, tabType);

  // Toggle dropdown
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== btn) {
      dropdown.classList.add('hidden');
    }
  });

  // Search labels
  search.addEventListener('input', () => {
    const query = search.value.toLowerCase();
    const filtered = allLabels.filter(l => l.name.toLowerCase().includes(query));
    renderLabelList(listId, filtered, tabType);
  });

  // Update count display
  updateLabelCount(btn);
}

function renderLabelList(listId, labels, tabType) {
  const list = document.getElementById(listId);
  if (!list) return;

  list.innerHTML = labels.map(label => {
    const isSelected = selectedLabels.includes(label.name);
    const isExcluded = excludedLabels.includes(label.name);

    return `
      <div class="label-item" data-label="${escapeHtml(label.name)}">
        <input type="checkbox"
          class="label-checkbox"
          ${isSelected ? 'checked' : ''}
          data-label="${escapeHtml(label.name)}">
        <span>${escapeHtml(label.name)}</span>
        <button class="label-exclude-btn ${isExcluded ? 'excluded' : ''}"
          data-label="${escapeHtml(label.name)}">
          ${isExcluded ? '✗ Excl' : 'Excl'}
        </button>
      </div>
    `;
  }).join('');

  // Add event listeners for checkboxes
  list.querySelectorAll('.label-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      e.stopPropagation();
      const labelName = cb.dataset.label;
      if (cb.checked) {
        if (!selectedLabels.includes(labelName)) {
          selectedLabels.push(labelName);
        }
        // Remove from excluded if adding
        excludedLabels = excludedLabels.filter(l => l !== labelName);
      } else {
        selectedLabels = selectedLabels.filter(l => l !== labelName);
      }
      updateLabelCount(document.getElementById(tabType === 'subnote' ? 'labelFilterBtn' : 'notesLabelFilterBtn'));
      renderLabelList(listId, labels, tabType); // Re-render to update exclude button
      if (tabType === 'subnote') {
        applyFilters();
      } else {
        applyNotesFilters();
      }
    });
  });

  // Add event listeners for exclude buttons
  list.querySelectorAll('.label-exclude-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const labelName = btn.dataset.label;
      if (excludedLabels.includes(labelName)) {
        excludedLabels = excludedLabels.filter(l => l !== labelName);
      } else {
        excludedLabels.push(labelName);
        // Remove from selected if excluding
        selectedLabels = selectedLabels.filter(l => l !== labelName);
      }
      updateLabelCount(document.getElementById(tabType === 'subnote' ? 'labelFilterBtn' : 'notesLabelFilterBtn'));
      renderLabelList(listId, labels, tabType); // Re-render to update
      if (tabType === 'subnote') {
        applyFilters();
      } else {
        applyNotesFilters();
      }
    });
  });
}

function updateLabelCount(btn) {
  if (!btn) return;
  const countSpan = btn.querySelector('.label-count');
  if (!countSpan) return;

  const total = selectedLabels.length + excludedLabels.length;
  if (total > 0) {
    countSpan.textContent = `(${selectedLabels.length > 0 ? '+' + selectedLabels.length : ''}${excludedLabels.length > 0 ? ' -' + excludedLabels.length : ''})`;
  } else {
    countSpan.textContent = '';
  }
}

function showTab(tabName) {
  // Save current search text before switching
  saveSharedSearchText();

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

  // Restore shared search text for the new tab and display tasks
  if (tabName === 'subnote') {
    restoreSharedSearchText('taskSearch');
    applyFilters();
  } else if (tabName === 'move') {
    restoreSharedSearchText('moveTaskSearch');
    applyMoveFilters();
  } else if (tabName === 'notes') {
    restoreSharedSearchText('notesSearch');
    applyNotesFilters();
  }
}

function saveSharedSearchText() {
  let input = null;
  if (currentTab === 'subnote') {
    input = document.getElementById('taskSearch');
  } else if (currentTab === 'move') {
    input = document.getElementById('moveTaskSearch');
  } else if (currentTab === 'notes') {
    input = document.getElementById('notesSearch');
  }

  if (input) {
    sharedSearchText = input.value;
  }
}

function restoreSharedSearchText(inputId) {
  const input = document.getElementById(inputId);
  if (input) {
    input.value = sharedSearchText;
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

  const filtered = allTasks.filter(task => {
    const matchesSearch = !searchTerm ||
      task.content.toLowerCase().includes(searchTerm) ||
      (task.description?.toLowerCase().includes(searchTerm));

    const matchesProject = !projectFilter || task.project_id === projectFilter;

    // Label filtering: must have ALL selected labels AND must NOT have any excluded labels
    let matchesLabels = true;
    if (selectedLabels.length > 0) {
      matchesLabels = selectedLabels.every(label => task.labels?.includes(label));
    }
    if (excludedLabels.length > 0) {
      matchesLabels = matchesLabels && !excludedLabels.some(label => task.labels?.includes(label));
    }

    return matchesSearch && matchesProject && matchesLabels;
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
        <span class="task-project">${escapeHtml(getProjectName(task.project_id))}</span>
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
    const description = task.description ? task.description.split('---')[0].trim() : '';
    const truncatedDesc = truncateText(description, 2);

    display.innerHTML = `
      <div class="selected-task-info">
        <h4>${escapeHtml(task.content)}</h4>
        ${truncatedDesc ? `<p class="task-description" style="max-height: 3em; overflow: hidden; line-height: 1.5em;">${escapeHtml(truncatedDesc)}</p>` : ''}
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

  if (taskSearch) taskSearch.value = '';
  if (projectFilter) projectFilter.value = '';

  // Clear label selections
  selectedLabels = [];
  excludedLabels = [];
  updateLabelCount(document.getElementById('labelFilterBtn'));
  renderLabelList('labelList', allLabels, 'subnote');

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

// Move tab functions
async function getMoveSettings() {
  const { moveSettings } = await browser.storage.local.get('moveSettings');
  return moveSettings || { projectId: '', sectionId: '' };
}

async function saveMoveSettings(settings) {
  await browser.storage.local.set({ moveSettings: settings });
}

async function onMoveProjectChange() {
  const projectId = document.getElementById('moveProjectFilter').value;

  // Save the selected project
  const settings = await getMoveSettings();
  settings.projectId = projectId;
  settings.sectionId = ''; // Reset section when project changes
  await saveMoveSettings(settings);

  updateMoveSectionOptions(projectId, '');
  applyMoveFilters();
}

async function onMoveSectionChange() {
  const sectionId = document.getElementById('moveTargetSection').value;

  // Save the selected section
  const settings = await getMoveSettings();
  settings.sectionId = sectionId;
  await saveMoveSettings(settings);
}

function updateMoveSectionOptions(projectId, selectedSectionId = '') {
  const sectionSelect = document.getElementById('moveTargetSection');

  if (!projectId) {
    sectionSelect.innerHTML = '<option value="">Select a section</option>';
    return;
  }

  const projectSections = allSections.filter(s => s.project_id === projectId);
  sectionSelect.innerHTML = '<option value="">Select a section</option>' +
    projectSections.map(s => `<option value="${s.id}" ${s.id === selectedSectionId ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('');
}

async function applyMoveFilters() {
  const searchTerm = document.getElementById('moveTaskSearch')?.value.toLowerCase() || '';
  const projectFilter = document.getElementById('moveProjectFilter')?.value || '';

  // Get preference for hiding subtasks (default: true)
  const { preferences } = await browser.storage.local.get('preferences');
  const hideSubtasks = preferences?.hideSubtasksInMove !== false;

  const filtered = allTasks.filter(task => {
    const matchesSearch = !searchTerm ||
      task.content.toLowerCase().includes(searchTerm) ||
      (task.description?.toLowerCase().includes(searchTerm));

    const matchesProject = !projectFilter || task.project_id === projectFilter;

    // Filter out subtasks if preference is enabled
    const isNotSubtask = !hideSubtasks || !task.parent_id;

    return matchesSearch && matchesProject && isNotSubtask;
  });

  displayMoveTasks(filtered);
}

function displayMoveTasks(tasks) {
  const taskList = document.getElementById('moveTaskList');
  if (!taskList) return;

  if (tasks.length === 0) {
    taskList.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No tasks found</div>';
    return;
  }

  taskList.innerHTML = tasks.map(task => `
    <div class="task-item" data-move-task-id="${task.id}">
      <div class="task-title">${escapeHtml(task.content)}</div>
      <div class="task-meta">
        <span class="task-project">${escapeHtml(getProjectName(task.project_id))}</span>
        ${task.due ? `<span class="task-due">${formatDueDate(task.due.date)}</span>` : ''}
        ${task.labels?.length ? `<span class="task-labels">${task.labels.map(l => `#${l}`).join(' ')}</span>` : ''}
      </div>
    </div>
  `).join('');

  taskList.querySelectorAll('.task-item').forEach(el => {
    el.addEventListener('click', () => {
      const taskId = el.dataset.moveTaskId;
      const task = allTasks.find(t => t.id === taskId);
      if (task) selectMoveTask(task);
    });
  });
}

function selectMoveTask(task) {
  document.querySelectorAll('[data-move-task-id]').forEach(el => el.classList.remove('selected'));

  const taskElement = document.querySelector(`[data-move-task-id="${task.id}"]`);
  if (taskElement) taskElement.classList.add('selected');

  moveSelectedTask = task;

  const display = document.getElementById('moveSelectedTaskDisplay');
  if (display) {
    const description = task.description ? task.description.split('---')[0].trim() : '';
    const truncatedDesc = truncateText(description, 2);

    display.innerHTML = `
      <div class="selected-task-info">
        <h4>${escapeHtml(task.content)}</h4>
        ${truncatedDesc ? `<p class="task-description" style="max-height: 3em; overflow: hidden; line-height: 1.5em;">${escapeHtml(truncatedDesc)}</p>` : ''}
        <div class="task-meta">
          <span class="task-project">${escapeHtml(getProjectName(task.project_id))}</span>
        </div>
      </div>
    `;
  }

  const moveBtn = document.getElementById('moveTaskBtn');
  if (moveBtn) moveBtn.disabled = false;
}

async function moveTask() {
  if (!moveSelectedTask) {
    updateStatus('No task selected', 'error');
    return;
  }

  const targetSection = document.getElementById('moveTargetSection').value;
  if (!targetSection) {
    updateStatus('Please select a target section', 'error');
    return;
  }

  try {
    updateStatus('Moving task...', 'info');

    const response = await browser.runtime.sendMessage({
      action: 'MOVE_TASK',
      taskId: moveSelectedTask.id,
      sectionId: targetSection
    });

    if (response.success) {
      updateStatus('Task moved successfully!', 'success');

      // Refresh task list
      const tasksResponse = await browser.runtime.sendMessage({ action: 'GET_ALL_TASKS' });
      if (tasksResponse.success) {
        allTasks = tasksResponse.data;
        applyMoveFilters();
      }

      // Clear selection
      moveSelectedTask = null;
      document.getElementById('moveSelectedTaskDisplay').innerHTML = '<p>No task selected</p>';
      document.getElementById('moveTaskBtn').disabled = true;
    } else {
      updateStatus(`Failed: ${response.error}`, 'error');
    }
  } catch (error) {
    updateStatus('Error moving task', 'error');
  }
}

// Notes tab functions
function applyNotesFilters() {
  const searchTerm = document.getElementById('notesSearch')?.value.toLowerCase() || '';
  const projectFilter = document.getElementById('notesProjectFilter')?.value || '';

  // Filter tasks that have the 'Note' label
  const filtered = allTasks.filter(task => {
    const hasNoteLabel = task.labels && task.labels.includes('Note');
    if (!hasNoteLabel) return false;

    const matchesSearch = !searchTerm ||
      task.content.toLowerCase().includes(searchTerm) ||
      (task.description?.toLowerCase().includes(searchTerm));

    const matchesProject = !projectFilter || task.project_id === projectFilter;

    // Label filtering: must have ALL selected labels AND must NOT have any excluded labels
    let matchesLabels = true;
    if (selectedLabels.length > 0) {
      matchesLabels = selectedLabels.every(label => task.labels?.includes(label));
    }
    if (excludedLabels.length > 0) {
      matchesLabels = matchesLabels && !excludedLabels.some(label => task.labels?.includes(label));
    }

    return matchesSearch && matchesProject && matchesLabels;
  });

  displayNotes(filtered);
}

function displayNotes(tasks) {
  const notesList = document.getElementById('notesList');
  if (!notesList) return;

  if (tasks.length === 0) {
    notesList.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No notes found</div>';
    return;
  }

  notesList.innerHTML = tasks.map(task => `
    <div class="task-item" data-note-id="${task.id}">
      <div class="task-title">${escapeHtml(task.content)}</div>
      <div class="task-meta">
        <span class="task-project">${escapeHtml(getProjectName(task.project_id))}</span>
        ${task.due ? `<span class="task-due">${formatDueDate(task.due.date)}</span>` : ''}
        <span style="color: #4CAF50;">📝</span>
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
    const description = task.description || '';
    const truncatedDesc = truncateText(description, 2);

    display.innerHTML = `
      <div class="selected-task-info">
        <h4>${escapeHtml(task.content)}</h4>
        ${truncatedDesc ? `<p class="task-description" style="max-height: 3em; overflow: hidden; line-height: 1.5em;">${escapeHtml(truncatedDesc)}</p>` : ''}
        <div class="task-meta">
          ${task.labels?.length ? `<span class="task-labels">${task.labels.join(', ')}</span>` : ''}
          ${task.due ? `<span class="task-due">Due: ${new Date(task.due.date).toLocaleDateString()}</span>` : ''}
        </div>
      </div>
    `;
  }
}

function clearNotesFilters() {
  const notesSearch = document.getElementById('notesSearch');
  const notesProjectFilter = document.getElementById('notesProjectFilter');

  if (notesSearch) notesSearch.value = '';
  if (notesProjectFilter) notesProjectFilter.value = '';

  // Clear label selections
  selectedLabels = [];
  excludedLabels = [];
  updateLabelCount(document.getElementById('notesLabelFilterBtn'));
  renderLabelList('notesLabelList', allLabels, 'notes');

  applyNotesFilters();
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);

// Error handler
window.addEventListener('error', () => {
  updateStatus('An unexpected error occurred', 'error');
});
