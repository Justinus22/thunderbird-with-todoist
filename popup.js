// Popup script for Thunderbird-Todoist Integration
console.log('Popup script loaded');

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup DOM loaded');
  
  try {
    // Initialize UI
    await initializePopup();
    
    // Set up event listeners
    setupEventListeners();
    
    console.log('Popup initialization completed');
  } catch (error) {
    console.error('Error during popup initialization:', error);
    const status = document.getElementById('status');
    if (status) {
      status.textContent = 'Error: ' + error.message;
      status.style.color = 'red';
    }
  }
});

async function initializePopup() {
  console.log('Starting popup initialization...');
  
  const status = document.getElementById('status');
  const messageInfo = document.getElementById('messageInfo');
  const tokenSection = document.getElementById('tokenSection');
  const messageSection = document.getElementById('messageSection');
  
  if (!status) {
    console.error('Could not find status element');
    return;
  }
  
  status.textContent = 'Checking connection...';
  status.style.color = 'blue';
  
  try {
    console.log('Sending TEST_TODOIST_CONNECTION message...');
    // Check if we have a stored token
    const response = await browser.runtime.sendMessage({ type: 'TEST_TODOIST_CONNECTION' });
    console.log('Response received:', response);
    
    if (response && response.success) {
      // We have a valid token
      status.textContent = 'Connected to Todoist ✅';
      status.style.color = 'green';
      if (tokenSection) tokenSection.style.display = 'none';
      if (messageSection) messageSection.style.display = 'block';
      
      // Try to get current message
      await loadCurrentMessage();
    } else {
      // No token or invalid token
      status.textContent = 'Not connected to Todoist ❌';
      status.style.color = 'red';
      if (tokenSection) tokenSection.style.display = 'block';
      if (messageSection) messageSection.style.display = 'none';
    }
  } catch (error) {
    console.error('Error in initializePopup:', error);
    status.textContent = 'Error connecting to background script: ' + error.message;
    status.style.color = 'red';
  }
}

function setupEventListeners() {
  console.log('Setting up event listeners...');
  
  // Save token button
  const saveTokenBtn = document.getElementById('saveToken');
  if (saveTokenBtn) {
    console.log('Found saveToken button, adding listener');
    saveTokenBtn.addEventListener('click', (e) => {
      console.log('Save token button clicked');
      e.preventDefault();
      saveToken();
    });
  } else {
    console.error('Could not find saveToken button');
  }
  
  // Test connection button
  const testConnectionBtn = document.getElementById('testConnection');
  if (testConnectionBtn) {
    console.log('Found testConnection button, adding listener');
    testConnectionBtn.addEventListener('click', (e) => {
      console.log('Test connection button clicked');
      e.preventDefault();
      testConnection();
    });
  } else {
    console.warn('Could not find testConnection button');
  }
  
  // Refresh message button
  const refreshMessageBtn = document.getElementById('refreshMessage');
  if (refreshMessageBtn) {
    console.log('Found refreshMessage button, adding listener');
    refreshMessageBtn.addEventListener('click', (e) => {
      console.log('Refresh message button clicked');
      e.preventDefault();
      loadCurrentMessage();
    });
  } else {
    console.warn('Could not find refreshMessage button');
  }

  // Project dropdown change event
  const projectDropdown = document.getElementById('projectDropdown');
  if (projectDropdown) {
    console.log('Found projectDropdown, adding listener');
    projectDropdown.addEventListener('change', (e) => {
      console.log('Project dropdown changed to:', e.target.value);
      loadTasksForProject(e.target.value);
    });
  } else {
    console.warn('Could not find projectDropdown');
  }

  // Add as subtask button
  const addAsSubtaskBtn = document.getElementById('addAsSubtaskButton');
  if (addAsSubtaskBtn) {
    console.log('Found addAsSubtaskButton, adding listener');
    addAsSubtaskBtn.addEventListener('click', (e) => {
      console.log('Add as subtask button clicked');
      e.preventDefault();
      addEmailAsSubtask();
    });
  } else {
    console.warn('Could not find addAsSubtaskButton');
  }
  
  // Enter key in token input
  const tokenInput = document.getElementById('tokenInput');
  if (tokenInput) {
    console.log('Found tokenInput, adding keypress listener');
    tokenInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        console.log('Enter key pressed in token input');
        e.preventDefault();
        saveToken();
      }
    });
  } else {
    console.error('Could not find tokenInput');
  }
  
  console.log('Event listeners setup completed');
}

async function saveToken() {
  console.log('saveToken function called');
  
  const tokenInput = document.getElementById('tokenInput');
  const status = document.getElementById('status');
  const saveTokenBtn = document.getElementById('saveToken');
  
  if (!tokenInput || !status || !saveTokenBtn) {
    console.error('Missing DOM elements:', {
      tokenInput: !!tokenInput,
      status: !!status,
      saveTokenBtn: !!saveTokenBtn
    });
    return;
  }
  
  const token = tokenInput.value.trim();
  console.log('Token length:', token.length);
  
  if (!token) {
    status.textContent = 'Please enter a valid token';
    status.style.color = 'red';
    return;
  }
  
  // Disable button during save
  saveTokenBtn.disabled = true;
  saveTokenBtn.textContent = 'Saving...';
  status.textContent = 'Saving token...';
  status.style.color = 'blue';
  
  try {
    console.log('Sending SAVE_TODOIST_TOKEN message...');
    // Save token
    const response = await browser.runtime.sendMessage({ 
      type: 'SAVE_TODOIST_TOKEN', 
      token: token 
    });
    
    console.log('Save token response:', response);
    
    if (response && response.success) {
      status.textContent = 'Token saved! Testing connection...';
      status.style.color = 'blue';
      
      // Test the connection
      await testConnection();
    } else {
      status.textContent = 'Failed to save token: ' + (response?.error || 'Unknown error');
      status.style.color = 'red';
    }
  } catch (error) {
    console.error('Error saving token:', error);
    status.textContent = 'Error saving token: ' + error.message;
    status.style.color = 'red';
  } finally {
    saveTokenBtn.disabled = false;
    saveTokenBtn.textContent = 'Save Token';
  }
}

async function testConnection() {
  const status = document.getElementById('status');
  const testConnectionBtn = document.getElementById('testConnection');
  const tokenSection = document.getElementById('tokenSection');
  const messageSection = document.getElementById('messageSection');
  
  // Disable button during test
  if (testConnectionBtn) {
    testConnectionBtn.disabled = true;
    testConnectionBtn.textContent = 'Testing...';
  }
  
  try {
    const response = await browser.runtime.sendMessage({ type: 'TEST_TODOIST_CONNECTION' });
    
    if (response.success) {
      status.textContent = `Connected to Todoist ✅ (${response.data.length} projects found)`;
      status.style.color = 'green';
      
      // Hide token section and show message section
      tokenSection.style.display = 'none';
      messageSection.style.display = 'block';
      
      // Load current message
      await loadCurrentMessage();
    } else {
      status.textContent = `Connection failed: ${response.error}`;
      status.style.color = 'red';
    }
  } catch (error) {
    console.error('Error testing connection:', error);
    status.textContent = 'Error testing connection';
    status.style.color = 'red';
  } finally {
    if (testConnectionBtn) {
      testConnectionBtn.disabled = false;
      testConnectionBtn.textContent = 'Test Connection';
    }
  }
}

async function loadCurrentMessage() {
  const messageInfo = document.getElementById('messageInfo');
  const refreshMessageBtn = document.getElementById('refreshMessage');
  
  // Disable button during load
  if (refreshMessageBtn) {
    refreshMessageBtn.disabled = true;
    refreshMessageBtn.textContent = 'Loading...';
  }
  
  try {
    const response = await browser.runtime.sendMessage({ type: 'GET_CURRENT_MESSAGE' });
    
    if (response.success && response.message) {
      const message = response.message;
      
      messageInfo.innerHTML = `
        <div class="message-item">
          <strong>Subject:</strong> ${escapeHtml(message.subject || 'No subject')}
        </div>
        <div class="message-item">
          <strong>From:</strong> ${escapeHtml(message.author || 'Unknown')}
        </div>
        <div class="message-item">
          <strong>Date:</strong> ${escapeHtml(message.date || 'Unknown')}
        </div>
        <div class="message-item">
          <strong>ID:</strong> ${message.id}
        </div>
      `;
      
      // Store message data for later use
      window.currentMessage = message;
      
      // Load projects for task selection
      await loadProjects();
    } else {
      messageInfo.innerHTML = `
        <div class="message-item" style="color: orange;">
          No email selected or unable to read message
        </div>
        <div class="message-item" style="font-size: 0.9em; color: #666;">
          Try opening an email in Thunderbird first
        </div>
      `;
    }
  } catch (error) {
    console.error('Error loading current message:', error);
    messageInfo.innerHTML = `
      <div class="message-item" style="color: red;">
        Error loading message: ${error.message}
      </div>
    `;
  } finally {
    if (refreshMessageBtn) {
      refreshMessageBtn.disabled = false;
      refreshMessageBtn.textContent = 'Refresh Message';
    }
  }
}

async function loadProjects() {
  console.log('Loading projects...');
  const projectDropdown = document.getElementById('projectDropdown');
  
  try {
    const response = await browser.runtime.sendMessage({ type: 'GET_PROJECTS' });
    
    if (response.success && response.data) {
      projectDropdown.innerHTML = '<option value="">Select a project...</option>';
      
      response.data.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        projectDropdown.appendChild(option);
      });
      
      console.log(`Loaded ${response.data.length} projects`);
    } else {
      projectDropdown.innerHTML = '<option value="">Error loading projects</option>';
      console.error('Failed to load projects:', response.error);
    }
  } catch (error) {
    console.error('Error loading projects:', error);
    projectDropdown.innerHTML = '<option value="">Error loading projects</option>';
  }
}

async function loadTasksForProject(projectId) {
  console.log('Loading tasks for project:', projectId);
  const taskDropdown = document.getElementById('taskDropdown');
  const addAsSubtaskBtn = document.getElementById('addAsSubtaskButton');
  
  if (!projectId) {
    taskDropdown.innerHTML = '<option value="">First select a project</option>';
    taskDropdown.disabled = true;
    addAsSubtaskBtn.disabled = true;
    return;
  }
  
  taskDropdown.innerHTML = '<option value="">Loading tasks...</option>';
  taskDropdown.disabled = false;
  
  try {
    const response = await browser.runtime.sendMessage({ 
      type: 'GET_TASKS', 
      projectId: projectId 
    });
    
    if (response.success && response.data) {
      taskDropdown.innerHTML = '<option value="">Select a parent task...</option>';
      
      response.data.forEach(task => {
        const option = document.createElement('option');
        option.value = task.id;
        option.textContent = task.content;
        taskDropdown.appendChild(option);
      });
      
      console.log(`Loaded ${response.data.length} tasks for project ${projectId}`);
      addAsSubtaskBtn.disabled = false;
    } else {
      taskDropdown.innerHTML = '<option value="">Error loading tasks</option>';
      addAsSubtaskBtn.disabled = true;
      console.error('Failed to load tasks:', response.error);
    }
  } catch (error) {
    console.error('Error loading tasks:', error);
    taskDropdown.innerHTML = '<option value="">Error loading tasks</option>';
    addAsSubtaskBtn.disabled = true;
  }
}

async function addEmailAsSubtask() {
  console.log('Adding email as subtask...');
  
  const taskDropdown = document.getElementById('taskDropdown');
  const addAsSubtaskBtn = document.getElementById('addAsSubtaskButton');
  const addingStatus = document.getElementById('addingStatus');
  
  const selectedTaskId = taskDropdown.value;
  if (!selectedTaskId) {
    addingStatus.textContent = 'Please select a parent task';
    addingStatus.style.color = 'red';
    return;
  }
  
  if (!window.currentMessage) {
    addingStatus.textContent = 'No email message available';
    addingStatus.style.color = 'red';
    return;
  }
  
  // Disable button during creation
  addAsSubtaskBtn.disabled = true;
  addAsSubtaskBtn.textContent = 'Creating Subtask...';
  addingStatus.textContent = 'Creating email subtask...';
  addingStatus.style.color = 'blue';
  
  try {
    const message = window.currentMessage;
    
    // Prepare attachments array (placeholder for now)
    const attachments = message.attachments || [];
    
    const response = await browser.runtime.sendMessage({
      type: 'CREATE_EMAIL_SUBTASK',
      parentTaskId: selectedTaskId,
      emailSubject: message.subject || 'No Subject',
      emailBody: message.body || '',
      attachments: attachments
    });
    
    if (response.success) {
      addingStatus.textContent = '✅ Email added as subtask successfully!';
      addingStatus.style.color = 'green';
      console.log('Email subtask created successfully:', response.data);
    } else {
      addingStatus.textContent = '❌ Failed to create subtask: ' + response.error;
      addingStatus.style.color = 'red';
      console.error('Failed to create subtask:', response.error);
    }
  } catch (error) {
    console.error('Error creating subtask:', error);
    addingStatus.textContent = '❌ Error creating subtask: ' + error.message;
    addingStatus.style.color = 'red';
  } finally {
    addAsSubtaskBtn.disabled = false;
    addAsSubtaskBtn.textContent = 'Add Email as Subtask';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}