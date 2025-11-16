// Background script for Thunderbird-Todoist Integration
console.log('Thunderbird-Todoist Extension loaded');

// Handle extension installation
browser.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed:', details);
  
  // Set up default storage if needed
  browser.storage.local.get('todoistToken').then((result) => {
    if (!result.todoistToken) {
      console.log('No Todoist token found, user needs to authenticate');
    } else {
      console.log('Todoist token found');
    }
  });
});

// Handle message display action clicks (when user clicks the button)
browser.messageDisplayAction.onClicked.addListener(async (tab) => {
  console.log('Message display action clicked for tab:', tab.id);
  
  try {
    // Open the modal window
    const window = await browser.windows.create({
      url: browser.runtime.getURL('modal.html'),
      type: 'popup',
      width: 600,
      height: 700
    });
    
    console.log('Modal window opened:', window.id);
  } catch (error) {
    console.error('Error opening modal:', error);
  }
});

// Todoist API helper functions
const TODOIST_API_BASE = 'https://api.todoist.com/api/v1';

async function getTodoistToken() {
  const result = await browser.storage.local.get('todoistToken');
  return result.todoistToken;
}

async function saveTodoistToken(token) {
  await browser.storage.local.set({ todoistToken: token });
  console.log('Todoist token saved');
}

async function clearTodoistToken() {
  await browser.storage.local.remove('todoistToken');
  console.log('Todoist token cleared');
}

async function testTodoistConnection(token) {
  try {
    const response = await fetch(`${TODOIST_API_BASE}/projects`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const projects = await response.json();
      console.log('Todoist connection successful, projects:', projects);
      
      // Handle v1 API response format: {results: [...], next_cursor: null}
      if (projects.results && Array.isArray(projects.results)) {
        console.log('Projects count:', projects.results.length);
        return { 
          success: true, 
          data: {
            projectCount: projects.results.length,
            message: `Connected successfully! Found ${projects.results.length} projects.`
          }
        };
      } else {
        console.log('Unexpected response format:', projects);
        return { success: false, error: 'Unexpected response format from Todoist API' };
      }
    } else {
      const errorText = await response.text();
      console.error('Todoist API error:', response.status, response.statusText, errorText);
      return { success: false, error: `API Error: ${response.status} - ${errorText}` };
    }
  } catch (error) {
    console.error('Network error:', error);
    return { success: false, error: error.message };
  }
}

async function getCurrentMessage() {
  try {
    console.log('Getting current message...');
    
    // Method 1: Try to get displayed messages from the active tab
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
    
    // Method 2: Try to get selected messages from active mail tab
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
    
    // Method 3: Try to get the active mail tab and check for displayed messages with specific tabId
    try {
      const mailTabs = await browser.mailTabs.query({ active: true });
      console.log('Method 3 - Active mail tabs:', mailTabs.length);
      
      if (mailTabs.length > 0) {
        const activeTab = mailTabs[0];
        console.log('Active mail tab ID:', activeTab.tabId);
        
        // Try to get displayed messages for this specific tab
        const displayedMessages = await browser.messageDisplay.getDisplayedMessages(activeTab.tabId);
        console.log('Method 3 - Displayed messages in tab:', displayedMessages?.messages?.length || 0);
        
        if (displayedMessages && displayedMessages.messages && displayedMessages.messages.length > 0) {
          const message = displayedMessages.messages[0];
          console.log('Found displayed message in active tab:', message.subject);
          return message;
        }
        
        // Try to get selected messages for this specific tab
        const selectedMessages = await browser.mailTabs.getSelectedMessages(activeTab.tabId);
        console.log('Method 3 - Selected messages in tab:', selectedMessages?.messages?.length || 0);
        
        if (selectedMessages && selectedMessages.messages && selectedMessages.messages.length > 0) {
          const message = selectedMessages.messages[0];
          console.log('Found selected message in active tab:', message.subject);
          return message;
        }
      }
    } catch (error) {
      console.log('Method 3 failed:', error.message);
    }
    
    // Method 4: Check all available mail tabs
    try {
      const allMailTabs = await browser.mailTabs.query({});
      console.log('Method 4 - All mail tabs:', allMailTabs.length);
      
      for (let mailTab of allMailTabs) {
        console.log(`Checking mail tab ${mailTab.tabId}, active: ${mailTab.active}`);
        
        try {
          const displayedMessages = await browser.messageDisplay.getDisplayedMessages(mailTab.tabId);
          if (displayedMessages && displayedMessages.messages && displayedMessages.messages.length > 0) {
            const message = displayedMessages.messages[0];
            console.log('Found displayed message in tab', mailTab.tabId, ':', message.subject);
            return message;
          }
        } catch (e) {
          console.log(`Failed to get displayed messages for tab ${mailTab.tabId}:`, e.message);
        }
        
        try {
          const selectedMessages = await browser.mailTabs.getSelectedMessages(mailTab.tabId);
          if (selectedMessages && selectedMessages.messages && selectedMessages.messages.length > 0) {
            const message = selectedMessages.messages[0];
            console.log('Found selected message in tab', mailTab.tabId, ':', message.subject);
            return message;
          }
        } catch (e) {
          console.log(`Failed to get selected messages for tab ${mailTab.tabId}:`, e.message);
        }
      }
    } catch (error) {
      console.log('Method 4 failed:', error.message);
    }
    
    console.log('No message found with any method');
    return null;
  } catch (error) {
    console.error('Error getting current message:', error);
    return null;
  }
}

// Message passing handler
browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  try {
    switch (message.type) {
      case 'TEST_TODOIST_CONNECTION':
        console.log('Testing Todoist connection...');
        const token = await getTodoistToken();
        if (!token) {
          console.log('No token found');
          return { success: false, error: 'No token found' };
        }
        const result = await testTodoistConnection(token);
        console.log('Connection test result:', result);
        return result;
        
      case 'SAVE_TODOIST_TOKEN':
        console.log('Saving Todoist token...');
        if (!message.token) {
          return { success: false, error: 'No token provided' };
        }
        await saveTodoistToken(message.token);
        console.log('Token saved successfully');
        return { success: true };
        
      case 'CLEAR_TODOIST_TOKEN':
        console.log('Clearing Todoist token...');
        await clearTodoistToken();
        console.log('Token cleared successfully');
        return { success: true };
        
      case 'GET_CURRENT_MESSAGE':
        console.log('Getting current message...');
        const currentMessage = await getCurrentMessage();
        console.log('Current message result:', currentMessage ? 'found' : 'not found');
        return { success: true, message: currentMessage };
        
      default:
        console.warn('Unknown message type:', message.type);
        return { success: false, error: 'Unknown message type' };
    }
  } catch (error) {
    console.error('Error handling message:', error);
    return { success: false, error: error.message };
  }
});