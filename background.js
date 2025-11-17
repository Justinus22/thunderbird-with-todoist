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

// Note: messageDisplayAction popup is now handled automatically by Thunderbird
// via the "default_popup" in manifest.json - no click handler needed

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
      const data = await response.json();
      console.log('Todoist connection successful, response:', data);
      
      // Handle both direct array (documented format) and paginated format (actual format)
      let projects;
      let projectCount;
      
      if (Array.isArray(data)) {
        // Direct array format (as per documentation)
        projects = data;
        projectCount = data.length;
      } else if (data && data.results && Array.isArray(data.results)) {
        // Paginated format (actual API response)
        projects = data.results;
        projectCount = data.results.length;
      } else {
        console.log('Unexpected response format:', data);
        return { success: false, error: 'Unexpected response format from Todoist API' };
      }
      
      console.log('Projects count:', projectCount);
      return { 
        success: true, 
        data: {
          projectCount: projectCount,
          message: `Connected successfully! Found ${projectCount} projects.`
        }
      };
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
        return await enrichMessageData(message);
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
        return await enrichMessageData(message);
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
          return await enrichMessageData(message);
        }
        
        // Try to get selected messages for this specific tab
        const selectedMessages = await browser.mailTabs.getSelectedMessages(activeTab.tabId);
        console.log('Method 3 - Selected messages in tab:', selectedMessages?.messages?.length || 0);
        
        if (selectedMessages && selectedMessages.messages && selectedMessages.messages.length > 0) {
          const message = selectedMessages.messages[0];
          console.log('Found selected message in active tab:', message.subject);
          return await enrichMessageData(message);
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
            return await enrichMessageData(message);
          }
        } catch (e) {
          console.log(`Failed to get displayed messages for tab ${mailTab.tabId}:`, e.message);
        }
        
        try {
          const selectedMessages = await browser.mailTabs.getSelectedMessages(mailTab.tabId);
          if (selectedMessages && selectedMessages.messages && selectedMessages.messages.length > 0) {
            const message = selectedMessages.messages[0];
            console.log('Found selected message in tab', mailTab.tabId, ':', message.subject);
            return await enrichMessageData(message);
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

// Function to enrich message data with body
async function enrichMessageData(message) {
  try {
    console.log('Enriching message data for:', message.subject);
    
    // Get message full content including body
    const fullMessage = await browser.messages.getFull(message.id);
    console.log('Full message retrieved, parts:', fullMessage.parts?.length || 0);
    
    // Extract plain text body from message parts
    const body = extractTextBody(fullMessage);
    console.log('Body extracted, length:', body?.length || 0);
    
    return {
      ...message,
      body: body
    };
  } catch (error) {
    console.error('Error enriching message data:', error);
    // Return basic message if enrichment fails
    return {
      ...message,
      body: ''
    };
  }
}

// Function to extract text body from message parts
function extractTextBody(fullMessage) {
  try {
    if (!fullMessage || !fullMessage.parts) {
      return '';
    }
    
    // Look for text/plain part
    const textPart = findMessagePart(fullMessage.parts, 'text/plain');
    if (textPart && textPart.body) {
      return textPart.body;
    }
    
    // If no plain text, look for text/html and strip tags
    const htmlPart = findMessagePart(fullMessage.parts, 'text/html');
    if (htmlPart && htmlPart.body) {
      // Basic HTML tag removal (for security, we keep it simple)
      return htmlPart.body
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
        .replace(/&lt;/g, '<') // Basic HTML entity decode
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .trim();
    }
    
    return '';
  } catch (error) {
    console.error('Error extracting text body:', error);
    return '';
  }
}

// Recursive function to find message part by content type
function findMessagePart(parts, contentType) {
  if (!parts || !Array.isArray(parts)) {
    return null;
  }
  
  for (const part of parts) {
    // Check if this part matches
    if (part.contentType && part.contentType.includes(contentType)) {
      return part;
    }
    
    // Check nested parts
    if (part.parts) {
      const nested = findMessagePart(part.parts, contentType);
      if (nested) {
        return nested;
      }
    }
  }
  
  return null;
}

// Additional Todoist API functions

async function getAllTasks(filter = {}) {
  const token = await getTodoistToken();
  
  if (!token) {
    return { success: false, error: 'No API token found' };
  }

  try {
    let allTasks = [];
    let cursor = null;
    
    do {
      // Build query parameters for filtering and pagination
      const params = new URLSearchParams();
      if (filter.project_id) params.append('project_id', filter.project_id);
      if (filter.section_id) params.append('section_id', filter.section_id);
      if (filter.label) params.append('label', filter.label);
      if (filter.filter) params.append('filter', filter.filter); // Todoist natural language filter
      if (cursor) params.append('cursor', cursor);
      
      const url = `${TODOIST_API_BASE}/tasks${params.toString() ? '?' + params.toString() : ''}`;
      console.log('Fetching tasks from:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Tasks API response:', data);
        
        // API v1 uses paginated format: {results: [...], next_cursor: null}
        if (data && data.results && Array.isArray(data.results)) {
          allTasks = allTasks.concat(data.results);
          cursor = data.next_cursor;
          console.log(`Fetched ${data.results.length} tasks, total so far: ${allTasks.length}`);
          
          if (cursor) {
            console.log('More tasks available, fetching next page...');
          }
        } else {
          console.log('Unexpected tasks response format:', data);
          return { success: false, error: 'Unexpected response format from Todoist API' };
        }
      } else {
        const errorText = await response.text();
        console.error('Tasks API error:', response.status, response.statusText, errorText);
        return { success: false, error: `API Error: ${response.status} - ${errorText}` };
      }
    } while (cursor); // Continue while there are more pages
    
    console.log(`All tasks fetched successfully: ${allTasks.length} total tasks`);
    return { 
      success: true, 
      data: allTasks 
    };
  } catch (error) {
    console.error('Network error fetching tasks:', error);
    return { success: false, error: error.message };
  }
}

async function getSections(projectId = null) {
  const token = await getTodoistToken();
  
  if (!token) {
    return { success: false, error: 'No API token found' };
  }
  
  try {
    let allSections = [];
    let cursor = null;
    
    do {
      const params = new URLSearchParams();
      if (projectId) params.append('project_id', projectId);
      if (cursor) params.append('cursor', cursor);
      
      const url = `${TODOIST_API_BASE}/sections${params.toString() ? '?' + params.toString() : ''}`;
      console.log('Fetching sections from:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Sections API response:', data);
        
        // API v1 uses paginated format: {results: [...], next_cursor: null}
        if (data && data.results && Array.isArray(data.results)) {
          allSections = allSections.concat(data.results);
          cursor = data.next_cursor;
          console.log(`Fetched ${data.results.length} sections, total so far: ${allSections.length}`);
          
          if (cursor) {
            console.log('More sections available, fetching next page...');
          }
        } else {
          console.log('Unexpected sections response format:', data);
          return { success: false, error: 'Unexpected response format from Todoist API' };
        }
      } else {
        const errorText = await response.text();
        console.error('Sections API error:', response.status, response.statusText, errorText);
        return { success: false, error: `API Error: ${response.status} - ${errorText}` };
      }
    } while (cursor); // Continue while there are more pages
    
    console.log(`All sections fetched successfully: ${allSections.length} total sections`);
    return { 
      success: true, 
      data: allSections 
    };
  } catch (error) {
    console.error('Network error fetching sections:', error);
    return { success: false, error: error.message };
  }
}

async function getLabels() {
  const token = await getTodoistToken();
  
  if (!token) {
    return { success: false, error: 'No API token found' };
  }
  
  try {
    let allLabels = [];
    let cursor = null;
    
    do {
      const params = new URLSearchParams();
      if (cursor) params.append('cursor', cursor);
      
      const url = `${TODOIST_API_BASE}/labels${params.toString() ? '?' + params.toString() : ''}`;
      console.log('Fetching labels from:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Labels API response:', data);
        
        // API v1 uses paginated format: {results: [...], next_cursor: null}
        if (data && data.results && Array.isArray(data.results)) {
          allLabels = allLabels.concat(data.results);
          cursor = data.next_cursor;
          console.log(`Fetched ${data.results.length} labels, total so far: ${allLabels.length}`);
          
          if (cursor) {
            console.log('More labels available, fetching next page...');
          }
        } else {
          console.log('Unexpected labels response format:', data);
          return { success: false, error: 'Unexpected response format from Todoist API' };
        }
      } else {
        const errorText = await response.text();
        console.error('Labels API error:', response.status, response.statusText, errorText);
        return { success: false, error: `API Error: ${response.status} - ${errorText}` };
      }
    } while (cursor); // Continue while there are more pages
    
    console.log(`All labels fetched successfully: ${allLabels.length} total labels`);
    return { 
      success: true, 
      data: allLabels 
    };
  } catch (error) {
    console.error('Network error fetching labels:', error);
    return { success: false, error: error.message };
  }
}

// Create email as subtask
async function createEmailSubtask(parentTaskId, emailSubject, emailBody) {
  const token = await getTodoistToken();
  
  if (!token) {
    return { success: false, error: 'No API token found' };
  }
  
  if (!parentTaskId || !emailSubject) {
    return { success: false, error: 'Parent task ID and email subject are required' };
  }
  
  try {
    // Create subtask with "*" prefix for Todoist task recognition
    const taskContent = `* ${emailSubject}`;
    const taskDescription = emailBody || 'No email content available';
    
    console.log('Creating subtask with content:', taskContent);
    console.log('Task description length:', taskDescription.length);
    
    const taskResponse = await fetch(`${TODOIST_API_BASE}/tasks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: taskContent,
        description: taskDescription,
        parent_id: parentTaskId,
        priority: 1
      })
    });
    
    if (!taskResponse.ok) {
      const errorText = await taskResponse.text();
      console.error('Failed to create subtask:', errorText);
      return { success: false, error: `Failed to create subtask: ${errorText}` };
    }
    
    const subtask = await taskResponse.json();
    console.log('Subtask created successfully:', subtask.id);
    console.log('Subtask content:', subtask.content);
    console.log('Subtask description:', subtask.description);
    
    return { 
      success: true, 
      data: {
        subtask: subtask
      }
    };
  } catch (error) {
    console.error('Error creating email subtask:', error);
    return { success: false, error: error.message };
  }
}

async function addEmailComment(taskId, content) {
  const token = await getTodoistToken();
  
  if (!token) {
    return { success: false, error: 'No API token found' };
  }
  
  if (!taskId || !content) {
    return { success: false, error: 'Task ID and content are required' };
  }
  
  try {
    const response = await fetch(`${TODOIST_API_BASE}/comments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        task_id: taskId,
        content: content
      })
    });
    
    if (response.ok) {
      const comment = await response.json();
      console.log('Comment added successfully:', comment.id);
      
      return { 
        success: true, 
        data: comment 
      };
    } else {
      const errorText = await response.text();
      console.error('Comments API error:', response.status, response.statusText, errorText);
      return { success: false, error: `API Error: ${response.status} - ${errorText}` };
    }
  } catch (error) {
    console.error('Network error adding comment:', error);
    return { success: false, error: error.message };
  }
}

async function getProjects() {
  const token = await getTodoistToken();
  
  if (!token) {
    return { success: false, error: 'No API token found' };
  }
  
  try {
    let allProjects = [];
    let cursor = null;
    
    do {
      const params = new URLSearchParams();
      if (cursor) params.append('cursor', cursor);
      
      const url = `${TODOIST_API_BASE}/projects${params.toString() ? '?' + params.toString() : ''}`;
      console.log('Fetching projects from:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Projects API response:', data);
        
        // API v1 uses paginated format: {results: [...], next_cursor: null}
        if (data && data.results && Array.isArray(data.results)) {
          allProjects = allProjects.concat(data.results);
          cursor = data.next_cursor;
          console.log(`Fetched ${data.results.length} projects, total so far: ${allProjects.length}`);
          
          if (cursor) {
            console.log('More projects available, fetching next page...');
          }
        } else {
          console.log('Unexpected projects response format:', data);
          return { success: false, error: 'Unexpected response format from Todoist API' };
        }
      } else {
        const errorText = await response.text();
        console.error('Projects API error:', response.status, response.statusText, errorText);
        return { success: false, error: `API Error: ${response.status} - ${errorText}` };
      }
    } while (cursor); // Continue while there are more pages
    
    console.log(`All projects fetched successfully: ${allProjects.length} total projects`);
    return { 
      success: true, 
      projects: allProjects
    };
  } catch (error) {
    console.error('Network error fetching projects:', error);
    return { success: false, error: error.message };
  }
}

// Message passing handler
browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  try {
    switch (message.action || message.type) {
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

      case 'GET_ALL_TASKS':
        console.log('Getting all tasks with filter:', message.filter || {});
        const tasksResult = await getAllTasks(message.filter || {});
        console.log('Tasks result:', tasksResult.success ? `${tasksResult.data.length} tasks` : tasksResult.error);
        return tasksResult;

      case 'GET_TASKS':
        console.log('Getting tasks for project:', message.projectId || 'all');
        const projectTasksResult = await getAllTasks(message.projectId ? { project_id: message.projectId } : {});
        console.log('Project tasks result:', projectTasksResult.success ? `${projectTasksResult.data.length} tasks` : projectTasksResult.error);
        return projectTasksResult;

      case 'GET_PROJECTS':
        console.log('Getting projects...');
        const projectsResult = await getProjects();
        console.log('Projects result:', projectsResult.success ? `${projectsResult.projects.length} projects` : projectsResult.error);
        return projectsResult;

      case 'GET_SECTIONS':
        console.log('Getting sections for project:', message.projectId || 'all');
        const sectionsResult = await getSections(message.projectId);
        console.log('Sections result:', sectionsResult.success ? `${sectionsResult.data.length} sections` : sectionsResult.error);
        return sectionsResult;

      case 'GET_LABELS':
        console.log('Getting labels...');
        const labelsResult = await getLabels();
        console.log('Labels result:', labelsResult.success ? `${labelsResult.data.length} labels` : labelsResult.error);
        return labelsResult;

      case 'ADD_EMAIL_COMMENT':
        console.log('Adding email comment to task:', message.taskId);
        if (!message.taskId || !message.content) {
          return { success: false, error: 'Task ID and content are required' };
        }
        const commentResult = await addEmailComment(message.taskId, message.content);
        console.log('Comment result:', commentResult.success ? 'added successfully' : commentResult.error);
        return commentResult;

      case 'CREATE_EMAIL_SUBTASK':
        console.log('Creating email subtask for parent task:', message.parentTaskId);
        if (!message.parentTaskId || !message.emailSubject) {
          return { success: false, error: 'Parent task ID and email subject are required' };
        }
        const subtaskResult = await createEmailSubtask(
          message.parentTaskId, 
          message.emailSubject, 
          message.emailBody
        );
        console.log('Subtask result:', subtaskResult.success ? 'created successfully' : subtaskResult.error);
        return subtaskResult;
        
      default:
        console.warn('Unknown message type:', message.type);
        return { success: false, error: 'Unknown message type' };
    }
  } catch (error) {
    console.error('Error handling message:', error);
    return { success: false, error: error.message };
  }
});