// Modal script for Thunderbird-Todoist Integration
console.log('Modal script loaded');

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Modal DOM loaded');
  
  try {
    // Initialize UI
    await initializeModal();
    
    // Set up event listeners
    setupEventListeners();
    
    console.log('Modal initialization completed');
  } catch (error) {
    console.error('Error during modal initialization:', error);
    const status = document.getElementById('status');
    if (status) {
      status.className = 'status error';
      status.textContent = 'Error: ' + error.message;
    }
  }
});

async function initializeModal() {
  console.log('Starting modal initialization...');
  
  const status = document.getElementById('status');
  const tokenSection = document.getElementById('tokenSection');
  const messageSection = document.getElementById('messageSection');
  
  if (!status) {
    console.error('Could not find status element');
    return;
  }
  
  status.className = 'status info';
  status.textContent = 'Checking connection...';
  
  try {
    console.log('Sending TEST_TODOIST_CONNECTION message...');
    // Check if we have a stored token
    const response = await browser.runtime.sendMessage({ type: 'TEST_TODOIST_CONNECTION' });
    console.log('Response received:', response);
    
    if (response && response.success) {
      // We have a valid token
      let projectCount = 'unknown number of';
      if (response.data && response.data.results && Array.isArray(response.data.results)) {
        projectCount = response.data.results.length;
      } else if (Array.isArray(response.data)) {
        projectCount = response.data.length;
      }
      
      status.className = 'status success';
      status.textContent = `✅ Connected to Todoist (${projectCount} projects found)`;
      if (tokenSection) tokenSection.style.display = 'none';
      if (messageSection) messageSection.classList.remove('hidden');
      
      // Try to get current message
      await loadCurrentMessage();
    } else {
      // No token or invalid token - always show token section
      status.className = 'status warning';
      status.textContent = response?.error ? `❌ Connection failed: ${response.error}` : '⚠️ Not connected to Todoist - Please enter your API token below';
      if (tokenSection) tokenSection.style.display = 'block';
      if (messageSection) messageSection.classList.add('hidden');
    }
  } catch (error) {
    console.error('Error in initializeModal:', error);
    status.className = 'status error';
    status.textContent = 'Error connecting to background script: ' + error.message;
  }
}

function setupEventListeners() {
  console.log('Setting up event listeners...');
  
  // Close modal button
  const closeBtn = document.getElementById('closeModal');
  if (closeBtn) {
    console.log('Found close button, adding listener');
    closeBtn.addEventListener('click', () => {
      console.log('Close button clicked');
      window.close();
    });
  }
  
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
    console.error('Could not find testConnection button');
  }
  
  // Clear token button
  const clearTokenBtn = document.getElementById('clearToken');
  if (clearTokenBtn) {
    console.log('Found clearToken button, adding listener');
    clearTokenBtn.addEventListener('click', (e) => {
      console.log('Clear token button clicked');
      e.preventDefault();
      clearToken();
    });
  } else {
    console.error('Could not find clearToken button');
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
  }
  
  // Clear token button (in connected state)
  const clearTokenConnectedBtn = document.getElementById('clearTokenConnected');
  if (clearTokenConnectedBtn) {
    console.log('Found clearTokenConnected button, adding listener');
    clearTokenConnectedBtn.addEventListener('click', (e) => {
      console.log('Clear token connected button clicked');
      e.preventDefault();
      clearToken();
    });
  }
  
  // Change token button
  const changeTokenBtn = document.getElementById('changeToken');
  if (changeTokenBtn) {
    console.log('Found changeToken button, adding listener');
    changeTokenBtn.addEventListener('click', (e) => {
      console.log('Change token button clicked');
      e.preventDefault();
      showTokenSection();
    });
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
  
  // ESC key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.close();
    }
  });
  
  console.log('Event listeners setup completed');
}

function showTokenSection() {
  console.log('showTokenSection function called');
  
  const tokenSection = document.getElementById('tokenSection');
  const messageSection = document.getElementById('messageSection');
  const status = document.getElementById('status');
  
  if (tokenSection) tokenSection.style.display = 'block';
  if (messageSection) messageSection.classList.add('hidden');
  if (status) {
    status.className = 'status info';
    status.textContent = '🔄 You can enter a new token below';
  }
}

async function clearToken() {
  console.log('clearToken function called');
  
  const status = document.getElementById('status');
  const tokenInput = document.getElementById('tokenInput');
  const clearTokenBtn = document.getElementById('clearToken');
  const tokenSection = document.getElementById('tokenSection');
  const messageSection = document.getElementById('messageSection');
  
  if (!confirm('Are you sure you want to clear the stored token?')) {
    return;
  }
  
  // Show loading state
  if (clearTokenBtn) {
    clearTokenBtn.disabled = true;
    clearTokenBtn.innerHTML = '<div class="loading-spinner"></div>Clearing...';
    clearTokenBtn.classList.add('btn-loading');
  }
  
  try {
    console.log('Sending CLEAR_TODOIST_TOKEN message...');
    const response = await browser.runtime.sendMessage({ type: 'CLEAR_TODOIST_TOKEN' });
    
    console.log('Clear token response:', response);
    
    if (response && response.success) {
      status.className = 'status warning';
      status.textContent = '⚠️ Token cleared - Please enter your API token below';
      
      // Clear the input field
      if (tokenInput) {
        tokenInput.value = '';
      }
      
      // Show token section, hide message section
      if (tokenSection) tokenSection.style.display = 'block';
      if (messageSection) messageSection.classList.add('hidden');
    } else {
      status.className = 'status error';
      status.textContent = '❌ Failed to clear token: ' + (response?.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Error clearing token:', error);
    status.className = 'status error';
    status.textContent = '❌ Error clearing token: ' + error.message;
  } finally {
    if (clearTokenBtn) {
      clearTokenBtn.disabled = false;
      clearTokenBtn.innerHTML = 'Clear Token';
      clearTokenBtn.classList.remove('btn-loading');
    }
  }
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
    status.className = 'status error';
    status.textContent = '❌ Please enter a valid token';
    return;
  }
  
  // Show loading state
  saveTokenBtn.disabled = true;
  saveTokenBtn.innerHTML = '<div class="loading-spinner"></div>Saving...';
  saveTokenBtn.classList.add('btn-loading');
  status.className = 'status info';
  status.textContent = '⏳ Saving token...';
  
  try {
    console.log('Sending SAVE_TODOIST_TOKEN message...');
    // Save token
    const response = await browser.runtime.sendMessage({ 
      type: 'SAVE_TODOIST_TOKEN', 
      token: token 
    });
    
    console.log('Save token response:', response);
    
    if (response && response.success) {
      status.className = 'status success';
      status.textContent = '✅ Token saved! Testing connection...';
      
      // Test the connection
      await testConnection();
    } else {
      status.className = 'status error';
      status.textContent = '❌ Failed to save token: ' + (response?.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Error saving token:', error);
    status.className = 'status error';
    status.textContent = '❌ Error saving token: ' + error.message;
  } finally {
    saveTokenBtn.disabled = false;
    saveTokenBtn.innerHTML = 'Save Token';
    saveTokenBtn.classList.remove('btn-loading');
  }
}

async function testConnection() {
  console.log('testConnection function called');
  
  const status = document.getElementById('status');
  const testConnectionBtn = document.getElementById('testConnection');
  const tokenSection = document.getElementById('tokenSection');
  const messageSection = document.getElementById('messageSection');
  
  // Show loading state
  if (testConnectionBtn) {
    testConnectionBtn.disabled = true;
    testConnectionBtn.innerHTML = '<div class="loading-spinner"></div>Testing...';
    testConnectionBtn.classList.add('btn-loading');
  }
  
  try {
    const response = await browser.runtime.sendMessage({ type: 'TEST_TODOIST_CONNECTION' });
    
    if (response && response.success) {
      let projectCount = 'unknown number of';
      
      // Handle the new response format from background.js
      if (response.data && typeof response.data.projectCount === 'number') {
        projectCount = response.data.projectCount;
      } else if (response.data && response.data.results && Array.isArray(response.data.results)) {
        projectCount = response.data.results.length;
      } else if (Array.isArray(response.data)) {
        projectCount = response.data.length;
      }
      
      status.className = 'status success';
      status.textContent = `✅ Connected to Todoist (${projectCount} projects found)`;
      
      // Hide token section and show message section
      if (tokenSection) tokenSection.style.display = 'none';
      if (messageSection) messageSection.classList.remove('hidden');
      
      // Load current message
      await loadCurrentMessage();
    } else {
      status.className = 'status error';
      status.textContent = `❌ Connection failed: ${response?.error || 'Unknown error'}`;
    }
  } catch (error) {
    console.error('Error testing connection:', error);
    status.className = 'status error';
    status.textContent = '❌ Error testing connection: ' + error.message;
  } finally {
    if (testConnectionBtn) {
      testConnectionBtn.disabled = false;
      testConnectionBtn.innerHTML = 'Test Connection';
      testConnectionBtn.classList.remove('btn-loading');
    }
  }
}

async function loadCurrentMessage() {
  console.log('loadCurrentMessage function called');
  
  const messageInfo = document.getElementById('messageInfo');
  const refreshMessageBtn = document.getElementById('refreshMessage');
  
  // Show loading state
  if (refreshMessageBtn) {
    refreshMessageBtn.disabled = true;
    refreshMessageBtn.innerHTML = '<div class="loading-spinner"></div>Loading...';
    refreshMessageBtn.classList.add('btn-loading');
  }
  
  if (messageInfo) {
    messageInfo.innerHTML = '<div class="loading-spinner"></div>Loading email information...';
  }
  
  try {
    const response = await browser.runtime.sendMessage({ type: 'GET_CURRENT_MESSAGE' });
    
    if (response && response.success && response.message) {
      const message = response.message;
      
      if (messageInfo) {
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
            <strong>Message ID:</strong> <code>${escapeHtml(message.id)}</code>
          </div>
        `;
      }
    } else {
      if (messageInfo) {
        messageInfo.innerHTML = `
          <div class="message-item" style="color: #856404; font-size: 14px;">
            📧 No email currently selected in Thunderbird
          </div>
          <div class="message-item" style="font-size: 13px; color: #666; margin-top: 8px;">
            To use this feature, try one of these steps:
          </div>
          <div style="margin-left: 16px; margin-top: 4px; font-size: 13px; color: #666;">
            1. <strong>Click on an email</strong> in your inbox to select it<br>
            2. <strong>Open the email</strong> in the message pane (preview)<br>
            3. <strong>Double-click</strong> an email to open it in a new tab/window<br>
            4. Then click <strong>"Refresh Email"</strong> below<br><br>
            💡 Make sure you have an email <strong>visible/selected</strong> before using this extension
          </div>
        `;
      }
    }
  } catch (error) {
    console.error('Error loading current message:', error);
    if (messageInfo) {
      messageInfo.innerHTML = `
        <div class="message-item" style="color: #721c24;">
          ❌ Error loading message: ${escapeHtml(error.message)}
        </div>
      `;
    }
  } finally {
    if (refreshMessageBtn) {
      refreshMessageBtn.disabled = false;
      refreshMessageBtn.innerHTML = 'Refresh Email';
      refreshMessageBtn.classList.remove('btn-loading');
    }
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}