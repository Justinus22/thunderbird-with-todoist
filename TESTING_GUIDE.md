# Testing Guide: Thunderbird-Todoist Integration Extension

## Prerequisites

1. **Thunderbird Desktop Application**
   - Download and install Thunderbird from https://thunderbird.net
   - Make sure it's version 91 or higher (for WebExtension support)
   - Set up at least one email account

2. **Todoist Account**
   - Create a free account at https://todoist.com if you don't have one
   - You'll need to get an API token (we'll show you how below)

## Step 1: Get Your Todoist API Token

1. **Log into Todoist Web App**
   - Go to https://app.todoist.com
   - Sign in with your account

2. **Navigate to Integrations Settings**
   - Click your profile picture/avatar (top right)
   - Select "Settings"
   - In the left sidebar, click "Integrations"
   - Scroll down to find "API Token" section
   - Copy the token (it looks like: `abc123def456...`) - keep this safe!

## Step 2: Prepare the Extension Files

1. **Verify Extension Structure**
   ```
   thunderbird-with-todoist/
   ├── manifest.json
   ├── background.js
   ├── popup.html
   ├── popup.js
   ├── REQUIREMENTS.md
   └── icons/
       ├── icon-16.svg
       ├── icon-32.svg
       └── icon-64.svg
   ```

2. **Check File Contents**
   - Make sure all files exist and have content
   - Verify `background.js` uses the correct API URL: `https://api.todoist.com/api/v1`

## Step 3: Install the Extension in Thunderbird

### Method 1: Temporary Installation (Recommended for Testing)

1. **Open Thunderbird**

2. **Access Add-on Manager**
   - Press `Ctrl+Shift+A` (or `Cmd+Shift+A` on Mac)
   - Or go to: Tools → Add-ons and Themes

3. **Enable Debug Mode**
   - Click the gear icon (⚙️) in the top-right corner
   - Select "Debug Add-ons"
   - This opens the Add-on Debugging page

4. **Load Temporary Extension**
   - Click "Load Temporary Add-on..."
   - Navigate to your extension folder
   - Select the `manifest.json` file
   - Click "Open"

5. **Verify Installation**
   - You should see "Thunderbird-Todoist Integration" in the list
   - Look for any error messages in the console

### Method 2: Permanent Installation (Advanced)

1. **Package as XPI** (if you want to keep it permanently)
   - Create a ZIP file containing all extension files
   - Rename the `.zip` extension to `.xpi`
   - Drag and drop the `.xpi` file onto Thunderbird

## Step 4: Test the Extension

### 4.1 Find and Use the Extension

1. **Look for the Extension Button**
   - The Todoist integration icon should appear in the message toolbar
   - It looks like a red circle with a white checkmark
   - The button appears when you're viewing an email

2. **Open the Modal Dialog**
   - Click the "Add to Todoist" button
   - A centered modal window will open on your screen (600x700 pixels)
   - This is much better than the small popup that was clipping!

### 4.2 Test Token Setup

1. **Open the Modal Dialog**
   - Click the "Add to Todoist" button when viewing an email
   - A centered modal window will open
   - You should see "Ready to connect to Todoist" or a connection status

2. **Enter Your API Token**
   - The token field is now a password field for security
   - Paste the Todoist API token you copied earlier
   - Press Enter or click "Save Token"
   - You should see "Token saved! Testing connection..."

3. **Verify Connection**
   - The modal will automatically test the connection
   - You should see "✅ Connected to Todoist (X projects found)"
   - If you see an error, double-check your token

### 4.3 Test Email Reading

1. **Open an Email**
   - Select any email in your inbox
   - Make sure it's displayed in the reading pane

2. **Open the Modal Again**
   - Click the "Add to Todoist" button
   - The modal will automatically show the "Email Information" section
   - It should display:
     - Subject of the selected email
     - Sender (From field)  
     - Date
     - Message ID

3. **Test with Different Emails**
   - Click on different emails
   - Open the modal again to see updated info
   - Use the "Refresh Email" button to update the information
   - Verify the extension reads the correct email details

## Step 5: Troubleshooting

### Common Issues and Solutions

#### Issue: Buttons don't respond when clicked
**Solutions:**
1. **Check the Extension Console for errors:**
   - Go to `Tools` → `Add-ons and Themes` (Ctrl+Shift+A)
   - Click gear icon ⚙️ → "Debug Add-ons"
   - Find "Thunderbird-Todoist Integration" → Click "Inspect"
   - Look in the **Console tab** for error messages
   - Try clicking the buttons again and watch for new errors

2. **Check if JavaScript is enabled:**
   - Make sure JavaScript is not disabled in Thunderbird

3. **Verify extension installation:**
   - Reload the temporary add-on if needed

#### Issue: Extension doesn't appear after installation
**Solutions:**
- Restart Thunderbird
- Check if using Thunderbird 91+ (older versions don't support WebExtensions)
- Look in the Error Console: Tools → Developer Tools → Error Console

#### Issue: "Connection failed" when testing Todoist API
**Solutions:**
- Verify your API token is correct (copy it again from Todoist)
- Check your internet connection
- Look in the Browser Console for detailed error messages

#### Issue: "No email selected" always shows
**Solutions:**
- Make sure you're viewing an email in the message pane (not just selected in the list)
- Try opening the email in a new tab/window
- Check if you have the necessary permissions in Thunderbird

#### Issue: Extension icon missing from toolbar
**Solutions:**
- Right-click on the toolbar → Customize
- Look for the Todoist icon and drag it to your preferred position
- Try restarting Thunderbird

### Debug Information

#### View Extension Console
1. Go to Tools → Developer Tools → Add-on Debugging
2. Find your extension and click "Inspect"
3. Check the Console tab for error messages

#### Check Background Script Logs
1. In the Add-on Debugging page
2. Find "Thunderbird-Todoist Integration"
3. Click "Inspect"
4. Look at Console tab for `console.log` messages

#### Test API Calls Manually
You can test your API token directly:
```bash
curl -X GET \
  https://api.todoist.com/api/v1/projects \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Step 6: Verify Everything is Working

✅ **Checklist for Success:**

1. Extension loads without errors
2. Extension icon appears in toolbar
3. Popup opens when clicking icon
4. Token can be saved successfully
5. Connection test shows "Connected to Todoist ✅"
6. Email information displays correctly when viewing emails
7. Message info updates when switching between emails

## Step 7: Next Steps (Development)

Once the minimal example is working, you can:

1. **Add Task Creation Features**
   - Modify popup.html to include task creation form
   - Extend background.js with task creation functions
   - Test creating tasks from email content

2. **Add Project Selection**
   - Fetch user's projects from Todoist API
   - Add dropdown to select target project

3. **Enhance Email Processing**
   - Extract email content/body
   - Parse and clean email text for task creation

## Getting Help

If you encounter issues:

1. **Check the Extension Console** (most common source of errors)
2. **Verify API Token** (test it manually with curl/Postman)
3. **Check Thunderbird Version** (needs 91+)
4. **Look at Network Tab** in Developer Tools to see API requests
5. **Review the background.js logs** for debugging information

## Security Notes

- Keep your Todoist API token secure (don't share it)
- The extension stores the token locally in Thunderbird
- Consider revoking and regenerating the token if needed (from Todoist settings)

---

**Congratulations!** If you've completed all these steps successfully, you have a working minimal Thunderbird extension that can connect to Todoist and read email information. This foundation can be extended to implement the full email-to-task workflow described in the requirements.