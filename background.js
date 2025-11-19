// Background script for Thunderbird-Todoist Integration
//
// Features:
// - View received emails and attach them to Todoist tasks as subtask notes
// - Compose emails and attach them to Todoist tasks (moves task to section, adds subtask)
// - Create new tasks from emails
// - Open emails from Todoist task links

const TODOIST_API_BASE = 'https://api.todoist.com/api/v1';


// Storage helpers
async function getTodoistToken() {
  const { todoistToken } = await browser.storage.local.get('todoistToken');
  return todoistToken;
}

async function saveTodoistToken(token) {
  await browser.storage.local.set({ todoistToken: token });
}

async function clearTodoistToken() {
  await browser.storage.local.remove('todoistToken');
}

// Generic API helper
async function fetchTodoist(endpoint, options = {}) {
  const token = await getTodoistToken();
  if (!token) {
    throw new Error('No API token found');
  }

  const response = await fetch(`${TODOIST_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error: ${response.status} - ${errorText}`);
  }

  // Handle 204 No Content responses (e.g., from task updates)
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

// Paginated fetch helper
async function fetchPaginated(endpoint, filter = {}) {
  let allResults = [];
  let cursor = null;

  do {
    const params = new URLSearchParams({ ...filter });
    if (cursor) params.append('cursor', cursor);

    const queryString = params.toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;

    const data = await fetchTodoist(url);

    if (data?.results && Array.isArray(data.results)) {
      allResults = allResults.concat(data.results);
      cursor = data.next_cursor;
    } else {
      throw new Error('Unexpected response format from Todoist API');
    }
  } while (cursor);

  return allResults;
}

// Message extraction helpers
function extractTextBody(fullMessage) {
  if (!fullMessage?.parts) return '';

  const textPart = findMessagePart(fullMessage.parts, 'text/plain');
  if (textPart?.body) return textPart.body;

  const htmlPart = findMessagePart(fullMessage.parts, 'text/html');
  if (htmlPart?.body) {
    return htmlPart.body
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim();
  }

  return '';
}

function findMessagePart(parts, contentType) {
  if (!Array.isArray(parts)) return null;

  for (const part of parts) {
    if (part.contentType?.includes(contentType)) return part;
    if (part.parts) {
      const nested = findMessagePart(part.parts, contentType);
      if (nested) return nested;
    }
  }

  return null;
}

async function getCurrentMessage() {
  const methods = [
    async () => (await browser.messageDisplay.getDisplayedMessages()).messages?.[0],
    async () => (await browser.mailTabs.getSelectedMessages()).messages?.[0],
    async () => {
      const [activeTab] = await browser.mailTabs.query({ active: true });
      if (!activeTab) return null;
      return (await browser.messageDisplay.getDisplayedMessages(activeTab.tabId)).messages?.[0] ||
             (await browser.mailTabs.getSelectedMessages(activeTab.tabId)).messages?.[0];
    }
  ];

  for (const method of methods) {
    try {
      const message = await method();
      if (message) {
        const fullMessage = await browser.messages.getFull(message.id);
        return {
          ...message,
          body: extractTextBody(fullMessage),
          headerMessageId: message.headerMessageId
        };
      }
    } catch (error) {
      continue;
    }
  }

  return null;
}

// Generate email link for task description
function generateEmailLink(headerMessageId, subject) {
  if (!headerMessageId) return '';

  // Store the headerMessageId as plain text metadata that we can parse later
  return `\n\n---\n📧 Email ID: ${headerMessageId}`;
}

// Extract headerMessageId from task description
function extractEmailId(description) {
  if (!description) return null;
  const match = description.match(/📧 Email ID: (.+?)(?:\n|$)/);
  return match ? match[1].trim() : null;
}

// API endpoints
async function testConnection(token) {
  try {
    const data = await fetch(`${TODOIST_API_BASE}/projects`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }).then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)));

    const projectCount = data.results?.length || data.length || 0;
    return {
      success: true,
      data: {
        projectCount,
        message: `Connected successfully! Found ${projectCount} projects.`
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getAllTasks(filter = {}) {
  try {
    const data = await fetchPaginated('/tasks', filter);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getProjects() {
  try {
    const projects = await fetchPaginated('/projects');
    return { success: true, projects };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getSections(projectId = null) {
  try {
    const data = await fetchPaginated('/sections', projectId ? { project_id: projectId } : {});
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getLabels() {
  try {
    const data = await fetchPaginated('/labels');
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function ensureLabelExists(labelName) {
  try {
    const labelsResponse = await getLabels();
    if (!labelsResponse.success) return null;

    const existingLabel = labelsResponse.data.find(l => l.name === labelName);
    if (existingLabel) return existingLabel.name;

    // Create the label
    const newLabel = await fetchTodoist('/labels', {
      method: 'POST',
      body: JSON.stringify({ name: labelName })
    });

    return newLabel.name;
  } catch (error) {
    console.error(`Error ensuring label ${labelName} exists:`, error);
    return null;
  }
}

async function createTask(taskData, headerMessageId = null) {
  if (!taskData || !taskData.content || !taskData.project_id) {
    return { success: false, error: 'Task content and project ID are required' };
  }

  try {
    // Add email link to description if headerMessageId is provided
    if (headerMessageId && taskData.description) {
      const emailLink = generateEmailLink(headerMessageId, taskData.content);
      taskData.description = taskData.description + emailLink;

      // Add "E-Mail" label for tasks created from emails
      const emailLabel = await ensureLabelExists('E-Mail');
      if (emailLabel) {
        taskData.labels = taskData.labels || [];
        if (!taskData.labels.includes(emailLabel)) {
          taskData.labels.push(emailLabel);
        }
      }
    }

    const task = await fetchTodoist('/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData)
    });

    // Store last used project for keyboard shortcut
    await browser.storage.local.set({ lastUsedProjectId: taskData.project_id });

    return { success: true, data: { task } };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function createEmailSubtask(parentTaskId, emailSubject, emailBody, headerMessageId) {
  if (!parentTaskId || !emailSubject) {
    return { success: false, error: 'Parent task ID and email subject are required' };
  }

  try {
    const emailLink = generateEmailLink(headerMessageId, emailSubject);
    const description = (emailBody || 'No email content available') + emailLink;

    // Ensure labels exist and add them
    const emailLabel = await ensureLabelExists('E-Mail');
    const noteLabel = await ensureLabelExists('Note');

    const labels = [];
    if (emailLabel) labels.push(emailLabel);
    if (noteLabel) labels.push(noteLabel);

    const subtask = await fetchTodoist('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        content: `* ${emailSubject}`,
        description: description,
        parent_id: parentTaskId,
        priority: 1,
        labels: labels
      })
    });

    // Store last used task for keyboard shortcut
    await browser.storage.local.set({ lastUsedTaskId: parentTaskId });

    return { success: true, data: { subtask } };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function addEmailComment(taskId, content) {
  if (!taskId || !content) {
    return { success: false, error: 'Task ID and content are required' };
  }

  try {
    const comment = await fetchTodoist('/comments', {
      method: 'POST',
      body: JSON.stringify({ task_id: taskId, content })
    });

    return { success: true, data: comment };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Move task to section using Sync API v1
async function moveTaskToSection(taskId, sectionId) {
  if (!taskId || !sectionId) {
    return { success: false, error: 'Task ID and Section ID are required' };
  }

  try {
    const token = await getTodoistToken();
    if (!token) {
      throw new Error('No API token found');
    }

    // Generate a UUID for the Sync API command
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });

    // Build the item_move command
    const command = {
      type: 'item_move',
      uuid: uuid,
      args: {
        id: taskId,
        section_id: sectionId
      }
    };

    // Call the Sync API v1 endpoint
    const response = await fetch('https://api.todoist.com/api/v1/sync', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `commands=${encodeURIComponent(JSON.stringify([command]))}`
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    // Check if the command succeeded
    if (result.sync_status && result.sync_status[uuid] === 'ok') {
      return { success: true, data: result };
    } else {
      const error = result.sync_status?.[uuid] || 'Unknown error';
      return { success: false, error: `Sync failed: ${JSON.stringify(error)}` };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Open email from Todoist link
async function openEmailFromLink(headerMessageId) {
  try {
    await browser.messageDisplay.open({ headerMessageId });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Message handler
browser.runtime.onMessage.addListener(async (message) => {
  try {
    switch (message.action || message.type) {
      case 'TEST_TODOIST_CONNECTION': {
        const token = await getTodoistToken();
        return token ? await testConnection(token) : { success: false, error: 'No token found' };
      }
      case 'SAVE_TODOIST_TOKEN':
        if (!message.token) return { success: false, error: 'No token provided' };
        await saveTodoistToken(message.token);
        return { success: true };

      case 'CLEAR_TODOIST_TOKEN':
        await clearTodoistToken();
        return { success: true };

      case 'GET_CURRENT_MESSAGE': {
        const currentMessage = await getCurrentMessage();
        return { success: true, message: currentMessage };
      }
      case 'GET_ALL_TASKS':
      case 'GET_TASKS':
        return await getAllTasks(message.filter || (message.projectId ? { project_id: message.projectId } : {}));

      case 'GET_PROJECTS':
        return await getProjects();

      case 'GET_SECTIONS':
        return await getSections(message.projectId);

      case 'GET_LABELS':
        return await getLabels();

      case 'ADD_EMAIL_COMMENT':
        return await addEmailComment(message.taskId, message.content);

      case 'CREATE_EMAIL_SUBTASK':
        return await createEmailSubtask(
          message.parentTaskId,
          message.emailSubject,
          message.emailBody,
          message.headerMessageId
        );

      case 'CREATE_TASK':
        return await createTask(message.taskData, message.headerMessageId);

      case 'OPEN_EMAIL_FROM_LINK':
        return await openEmailFromLink(message.headerMessageId);

      default:
        return { success: false, error: 'Unknown message type' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Compose window email send interception
browser.compose.onBeforeSend.addListener(async (tab, details) => {
  try {
    // Get the compose state for this tab
    const { composeStates } = await browser.storage.local.get('composeStates');
    const state = composeStates?.[tab.id];

    // If no task is selected, allow normal send
    if (!state || !state.taskId) {
      return;
    }

    // Get compose details
    const composeDetails = await browser.compose.getComposeDetails(tab.id);

    // Move task to section if specified
    if (state.sectionId) {
      const moveResult = await moveTaskToSection(state.taskId, state.sectionId);
      if (!moveResult.success) {
        console.error('Failed to move task:', moveResult.error);
        // Continue anyway to create subtask
      }
    }

    // Create subtask note with the email content
    const emailSubject = composeDetails.subject || 'No Subject';
    const emailBody = composeDetails.plainTextBody || composeDetails.body || '';

    // Ensure labels exist and add them (E-Mail, Note, Send)
    const emailLabel = await ensureLabelExists('E-Mail');
    const noteLabel = await ensureLabelExists('Note');
    const sendLabel = await ensureLabelExists('Send');

    const labels = [];
    if (emailLabel) labels.push(emailLabel);
    if (noteLabel) labels.push(noteLabel);
    if (sendLabel) labels.push(sendLabel);

    // Create the subtask with * prefix in title
    await fetchTodoist('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        content: `* ${emailSubject}`,
        description: emailBody,
        parent_id: state.taskId,
        priority: 1,
        labels: labels
      })
    });

    // Clean up the compose state for this tab
    delete composeStates[tab.id];
    await browser.storage.local.set({ composeStates });

  } catch (error) {
    console.error('Error in onBeforeSend handler:', error);
    // Allow email to send even if there's an error
  }
});
