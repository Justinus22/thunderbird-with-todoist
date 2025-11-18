// Background script for Thunderbird-Todoist Integration

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

async function createTask(taskData, headerMessageId = null) {
  if (!taskData || !taskData.content || !taskData.project_id) {
    return { success: false, error: 'Task content and project ID are required' };
  }

  try {
    // Add email link to description if headerMessageId is provided
    if (headerMessageId && taskData.description) {
      const emailLink = generateEmailLink(headerMessageId, taskData.content);
      taskData.description = taskData.description + emailLink;
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

    const subtask = await fetchTodoist('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        content: `* ${emailSubject}`,
        description: description,
        parent_id: parentTaskId,
        priority: 1
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
