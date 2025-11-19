// ============================================================================
// Gmail to GTD via Google Sheets
// ============================================================================// This script runs from a Google Sheet and processes emails via Gmail API
// Much easier to set up than a full Gmail Add-on

const FIREBASE_PROJECT_ID = PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID');
const CLOUD_FUNCTION_URL = `https://us-central1-${FIREBASE_PROJECT_ID}.cloudfunctions.net/addEmailTask`;
const GTD_LABEL = 'GTD/ToProcess';
const PROCESSED_LABEL = 'GTD/Added';

/**
 * Add custom menu to Sheet
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📧 GTD Email Processor')
    .addItem('▶️ Process Labeled Emails', 'processLabeledEmails')
    .addItem('📋 Check Gmail Labels', 'listLabels')
    .addSeparator()
    .addItem('⚙️ Setup Instructions', 'showSetupInstructions')
    .addItem('🧪 Test Connection', 'testSetup')
    .addToUi();
}

/**
 * Main function: Process all emails with GTD label
 * This is what you run manually or set up as a trigger
 */
function processLabeledEmails() {
  const ui = SpreadsheetApp.getUi();
  
  try {
    // Get the GTD/ToProcess label
    const labels = Gmail.Users.Labels.list('me').labels;
    const toProcessLabel = labels.find(l => l.name === GTD_LABEL);
    
    if (!toProcessLabel) {
      ui.alert('⚠️ Label Not Found',
        `Please create a Gmail label called "${GTD_LABEL}" first.\n\n` +
        'Then label any emails you want to add to GTD with this label.',
        ui.ButtonSet.OK);
      return;
    }
    
    // Get messages with the label
    const query = `label:${GTD_LABEL}`;
    const searchResults = Gmail.Users.Messages.list('me', {
      q: query,
      maxResults: 50
    });
    
    if (!searchResults.messages || searchResults.messages.length === 0) {
      ui.alert('ℹ️ No Emails Found',
        `No emails found with label "${GTD_LABEL}".\n\n` +
        'Label emails in Gmail that you want to add to your GTD system.',
        ui.ButtonSet.OK);
      return;
    }
    
    // Process each message
    const idToken = ScriptApp.getOAuthToken();
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (const messageRef of searchResults.messages) {
      try {
        const message = Gmail.Users.Messages.get('me', messageRef.id);
        const emailData = extractEmailFromMessage(message);
        
        // Call Cloud Function
        const response = UrlFetchApp.fetch(CLOUD_FUNCTION_URL, {
          method: 'post',
          contentType: 'application/json',
          headers: {
            'Authorization': `Bearer ${idToken}`
          },
          payload: JSON.stringify({
            data: {
              ...emailData,
              priority: 'normal'
            }
          }),
          muteHttpExceptions: true
        });
        
        const result = JSON.parse(response.getContentText());
        
        if (result.data && result.data.success) {
          // Success - move from ToProcess to Added
          moveLabel(messageRef.id, toProcessLabel.id);
          successCount++;
          
          Logger.log(`✓ Added: ${emailData.subject}`);
        } else {
          errorCount++;
          errors.push(`${emailData.subject}: ${result.data?.error || 'Unknown'}`);
          Logger.log(`✗ Failed: ${emailData.subject} - ${result.data?.error}`);
        }
        
      } catch (error) {
        errorCount++;
        errors.push(`Message ${messageRef.id}: ${error.message}`);
        Logger.log(`✗ Error processing message: ${error.toString()}`);
      }
      
      // Avoid rate limits
      Utilities.sleep(500);
    }
    
    // Show summary
    let summary = `✅ Successfully added ${successCount} email(s) to GTD\n`;
    if (errorCount > 0) {
      summary += `
❌ Failed to add ${errorCount} email(s)\n\nErrors:\n`;
      summary += errors.slice(0, 5).join('\n');
      if (errors.length > 5) {
        summary += `
... and ${errors.length - 5} more`;
      }
    }
    
    ui.alert('GTD Email Processing Complete', summary, ui.ButtonSet.OK);
    
  } catch (error) {
    Logger.log('Error in processLabeledEmails: ' + error.toString());
    ui.alert('❌ Error',
      'Failed to process emails: ' + error.message + '\n\nCheck Execution log for details.',
      ui.ButtonSet.OK);
  }
}

/**
 * Extract email data from Gmail message object
 */
function extractEmailFromMessage(message) {
  Logger.log('Processing message: ' + message.id);
  Logger.log('Message payload: ' + JSON.stringify(message.payload, null, 2));

  const headers = message.payload.headers;
  
  const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
  const from = headers.find(h => h.name === 'From')?.value || '';
  const date = headers.find(h => h.name === 'Date')?.value || '';
  
  // Extract body
  let body = '';
  if (message.payload.body.data) {
    try {
      body = Utilities.newBlob(Utilities.base64Decode(message.payload.body.data)).getDataAsString();
    } catch (e) {
      Logger.log('Error decoding message payload body: ' + e.message);
      body = '(Could not decode body)';
    }
  } else if (message.payload.parts) {
    const textPart = message.payload.parts.find(p => p.mimeType === 'text/plain');
    if (textPart) {
      Logger.log('Found text/plain part: ' + JSON.stringify(textPart, null, 2));
      if (textPart.body.data) {
        try {
          body = Utilities.newBlob(Utilities.base64Decode(textPart.body.data)).getDataAsString();
        } catch (e) {
          Logger.log('Error decoding text part body: ' + e.message);
          body = '(Could not decode body)';
        }
      }
    }
  }
  
  const threadId = message.threadId;
  const gmailLink = `https://mail.google.com/mail/u/0/#inbox/${threadId}`;
  
  const senderMatch = from.match(/^(.+?)\s*<(.+?)>$/) || [null, from, from];
  const senderName = senderMatch[1] ? senderMatch[1].trim() : '';
  const senderEmail = senderMatch[2] ? senderMatch[2].trim() : from;
  
  const bodyTruncated = body.length > 2000 ? body.substring(0, 1997) + '...' : body;
  
  return {
    subject: subject,
    sender: senderEmail,
    senderName: senderName,
    body: bodyTruncated,
    gmailLink: gmailLink,
    date: new Date(date).toISOString(),
    messageId: message.id,
    threadId: threadId
  };
}

/**
 * Move message from one label to another
 */
function moveLabel(messageId, fromLabelId) {
  try {
    // Get or create the "Added" label
    const labels = Gmail.Users.Labels.list('me').labels;
    let addedLabelId = labels.find(l => l.name === PROCESSED_LABEL)?.id;
    
    if (!addedLabelId) {
      const newLabel = Gmail.Users.Labels.create({
        name: PROCESSED_LABEL,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show'
      }, 'me');
      addedLabelId = newLabel.id;
    }
    
    // Remove "ToProcess" label, add "Added" label
    Gmail.Users.Messages.modify({
      removeLabelIds: [fromLabelId],
      addLabelIds: [addedLabelId]
    }, 'me', messageId);
  } catch (error) {
    Logger.log('Label error: ' + error.toString());
  }
}

/**
 * List available Gmail labels (for debugging)
 */
function listLabels() {
  const ui = SpreadsheetApp.getUi();
  
  try {
    const labels = Gmail.Users.Labels.list('me').labels;
    
    let labelList = 'Your Gmail Labels:\n\n';
    labels.forEach(label => {
      labelList += `• ${label.name}\n`;
    });
    
    labelList += `\n\nTo use this script, create or use the label: "${GTD_LABEL}"`;
    
    ui.alert('Gmail Labels', labelList, ui.ButtonSet.OK);
  } catch (error) {
    ui.alert('Error', 'Failed to list labels: ' + error.message, ui.ButtonSet.OK);
  }
}

/**
 * Show setup instructions
 */
function showSetupInstructions() {
  const ui = SpreadsheetApp.getUi();
  
  const instructions = `
📧 Gmail to GTD Setup Instructions

STEP 1: Create Gmail Labels
━━━━━━━━━━━━━━━━━━━━━━
In Gmail, create these labels:
• ${GTD_LABEL} (for emails to process)
• ${PROCESSED_LABEL} (for processed emails)

STEP 2: Label Emails
━━━━━━━━━━━━━━━━━━━━━━
When you want to add an email to GTD:
1. Open the email in Gmail
2. Add the "${GTD_LABEL}" label
3. The email is queued for processing

STEP 3: Process Emails
━━━━━━━━━━━━━━━━━━━━━━
Back in this Sheet:
1. Click "GTD Email Processor" menu
2. Click "Process Labeled Emails"
3. All labeled emails will be added to GTD

OPTIONAL: Auto-Process
━━━━━━━━━━━━━━━━━━━━━━
Set up a time-based trigger:
1. Extensions > Apps Script
2. Click "Triggers" (clock icon)
3. Add Trigger > processLabeledEmails
4. Time-driven > Hour timer > Every hour

This will automatically check and process 
labeled emails every hour!

TROUBLESHOOTING
━━━━━━━━━━━━━━━━━━━━━━
• Run "Test Connection" to verify setup
• Check "View > Execution log" for errors
• Ensure you're signed in to the same Google
  account for both Gmail and GTD app
  `.trim();
  
  ui.alert('Setup Instructions', instructions, ui.ButtonSet.OK);
}

/**
 * Test function - verify setup
 */
function testSetup() {
  const ui = SpreadsheetApp.getUi();
  let results = '🧪 Testing GTD Email Setup...\n\n';
  
  // Test 1: OAuth token
  try {
    const token = ScriptApp.getOAuthToken();
    results += '✅ OAuth token obtained\n';
  } catch (error) {
    results += '❌ Failed to get OAuth token: ' + error.message + '\n';
    ui.alert('Test Failed', results, ui.ButtonSet.OK);
    return;
  }
  
  // Test 2: Gmail API access
  try {
    const labels = Gmail.Users.Labels.list('me').labels;
    results += `✅ Gmail API access OK (${labels.length} labels found)\n`;
  } catch (error) {
    results += '❌ Gmail API access failed: ' + error.message + '\n';
    ui.alert('Test Failed', results, ui.ButtonSet.OK);
    return;
  }
  
  // Test 3: Check for GTD label
  try {
    const labels = Gmail.Users.Labels.list('me').labels;
    const gtdLabel = labels.find(l => l.name === GTD_LABEL);
    if (gtdLabel) {
      results += `✅ Found "${GTD_LABEL}" label\n`;
    } else {
      results += `⚠️  Label "${GTD_LABEL}" not found - please create it\n`;
    }
  } catch (error) {
    results += '⚠️  Could not check labels\n';
  }
  
  // Test 4: Cloud Function connection
  try {
    const token = ScriptApp.getOAuthToken();
    const testUrl = 'https://us-central1-' + FIREBASE_PROJECT_ID + '.cloudfunctions.net/getExtensionAuth';
    const response = UrlFetchApp.fetch(testUrl, {
      method: 'post',
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true
    });
    
    const responseCode = response.getResponseCode();
    if (responseCode === 200) {
      const data = JSON.parse(response.getContentText());
      results += `✅ Cloud Function connection OK\n`;
      results += `   Authenticated as: ${data.email}\n`;
      results += `   Auth method: ${data.method}\n`;
    } else {
      results += `⚠️  Cloud Function returned code: ${responseCode}\n`;
      results += `   Response: ${response.getContentText()}\n`;
    }
  } catch (error) {
    results += '❌ Cloud Function test failed: ' + error.message + '\n';
  }
  
  results += '\n' + (results.includes('❌') ? '❌ Setup incomplete' : '✅ All tests passed!');
  
  ui.alert('Setup Test Results', results, ui.ButtonSet.OK);
  Logger.log(results);
}
