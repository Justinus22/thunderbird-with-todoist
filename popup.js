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

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}