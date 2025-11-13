// functions/addEmailTask.js
// Cloud Function for Chrome Extension and Apps Script
// FIXED VERSION - Corrects Gmail scope checking

const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });
const { Firestore, FieldValue } = require('@google-cloud/firestore');

/**
 * Add Email Task from Chrome Extension
 * 
 * This function receives email data from the Chrome extension
 * and creates a task in the user's Inbox.
 */
exports.addEmailTask = onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      // ... (auth logic remains the same)
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        res.status(401).json({
          data: {
            success: false,
            error: 'No authorization token provided'
          }
        });
        return;
      }

      const token = authHeader.split('Bearer ')[1];
      let userId;
      let userEmail;
      
      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        userId = decodedToken.uid;
        userEmail = decodedToken.email;
      } catch (firebaseError) {
        try {
          const tokenInfoResponse = await fetch(
            `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`
          );
          
          if (!tokenInfoResponse.ok) {
            throw new Error('Invalid access token');
          }
          
          const tokenInfo = await tokenInfoResponse.json();
          userEmail = tokenInfo.email;
          if (!userEmail) {
            throw new Error('No email found in token info');
          }
          
          const hasGmailScope = tokenInfo.scope && (
            tokenInfo.scope.includes('gmail') || 
            tokenInfo.scope.includes('mail.google.com')
          );
          
          if (!hasGmailScope) {
            throw new Error('Token does not have Gmail scope. Scopes present: ' + tokenInfo.scope);
          }
          
          const userRecord = await admin.auth().getUserByEmail(userEmail);
          userId = userRecord.uid;
          
        } catch (googleError) {
          console.error('Authentication failed:', { firebaseError: firebaseError.toString(), googleError: googleError.toString() });
          res.status(401).json({
            data: {
              success: false,
              error: 'Invalid authorization token. Please ensure you are signed in to your GTD app with the same Google account.'
            }
          });
          return;
        }
      }

      const emailData = req.body.data;

      if (!emailData || !emailData.subject) {
        res.status(400).json({
          data: {
            success: false,
            error: 'Missing email data'
          }
        });
        return;
      }

      // Initialize DB connection for gtd-database using @google-cloud/firestore
      const db = new Firestore({ databaseId: 'gtd-database' });

      // Get or create Inbox
      const inboxId = await getOrCreateInbox(userId, db);

      // Build task data
      const taskRef = db.collection('tasks').doc();
      
      const title = cleanSubject(emailData.subject);
      const description = buildDescription(emailData);
      const context = detectContext(title + ' ' + emailData.body);

      const newTask = {
        title,
        description,
        userId,
        parentId: inboxId,
        status: 'next_action',
        importance: emailData.importance || 3,
        urgency: emailData.urgency || 3,
        context: emailData.context || context || '@email',
        source: 'apps_script',
        createdDate: FieldValue.serverTimestamp(),
        modifiedDate: FieldValue.serverTimestamp(),
        computedPriority: 0,
        childCount: 0,
        completedDate: null,
        dueDate: null,
        energyLevel: 'medium',
        isProject: false,
        level: 1,
        mloEffort: 0,
        mloImportance: 0,
        mloUrgency: 0,
        path: `<Inbox>/${title}`,
        priorityBreakdown: {},
        startDate: null,
        timeEstimate: null,
        todayFocus: false
      };

      if (emailData.dueDate) {
        newTask.dueDate = emailData.dueDate;
      }

      await taskRef.set(newTask);

      res.status(200).json({
        data: {
          success: true,
          taskId: taskRef.id,
          title: title
        }
      });

    } catch (error) {
      console.error('Error adding email task:', error.toString());
      res.status(500).json({
        data: {
          success: false,
          error: error.message
        }
      });
    }
  });
});

/**
 * Get or create Inbox task
 */
async function getOrCreateInbox(userId, db) {
  const inboxQuery = await db.collection('tasks')
    .where('userId', '==', userId)
    .where('title', '==', '<Inbox>')
    .where('parentId', '==', null)
    .limit(1)
    .get();

  if (!inboxQuery.empty) {
    return inboxQuery.docs[0].id;
  }

  // Create Inbox
  const inboxRef = db.collection('tasks').doc();
  await inboxRef.set({
    title: '<Inbox>',
    userId,
    status: 'next_action',
    importance: 3,
    urgency: 3,
    source: 'system',
    createdDate: FieldValue.serverTimestamp(),
    modifiedDate: FieldValue.serverTimestamp(),
    computedPriority: 0,
    childCount: 0
  });

  return inboxRef.id;
}

/**
 * Clean email subject for task title
 */
function cleanSubject(subject) {
  return subject
    .replace(/^(Re:|Fwd:|FW:|RE:)\s*/gi, '')
    .trim()
    .substring(0, 200);
}

/**
 * Build task description from email data
 */
function buildDescription(emailData) {
  let desc = '📧 **Email Task**\n\n';
  
  if (emailData.senderName && emailData.sender) {
    desc += `**From:** ${emailData.senderName} <${emailData.sender}>\n`;
  } else if (emailData.sender) {
    desc += `**From:** ${emailData.sender}\n`;
  }
  
  desc += `**Subject:** ${emailData.subject}\n`;
  
  if (emailData.gmailLink) {
    desc += `**Gmail Link:** [Open in Gmail](${emailData.gmailLink})\n`;
  }
  
  desc += '\n---\n\n';
  
  if (emailData.body) {
    let body = emailData.body
      .replace(/^>+\s/gm, '') // Remove quote markers
      .replace(/\n{3,}/g, '\n\n') // Collapse newlines
      .trim();
    
    if (body.length > 1500) {
      body = body.substring(0, 1497) + '...';
    }
    
    desc += body;
  }
  
  return desc;
}

/**
 * Detect context from content
 */
function detectContext(text) {
  const lowerText = text.toLowerCase();
  
  const contextRules = [
    { keywords: ['meeting', 'call', 'zoom', 'teams', 'schedule'], context: '@calls' },
    { keywords: ['review', 'feedback', 'approve', 'check'], context: '@review' },
    { keywords: ['urgent', 'asap', 'immediate', 'priority'], context: '@urgent' },
    { keywords: ['buy', 'purchase', 'order', 'shopping'], context: '@errands' },
    { keywords: ['read', 'article', 'blog', 'research', 'study'], context: '@read' },
    { keywords: ['follow up', 'followup', 'reply', 'respond'], context: '@email' }
  ];

  for (const rule of contextRules) {
    if (rule.keywords.some(keyword => lowerText.includes(keyword))) {
      return rule.context;
    }
  }

  return '@email';
}

/**
 * Get Extension Auth (for verifying connection)
 * Also works with Google Apps Script OAuth tokens
 */
exports.getExtensionAuth = onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        res.status(401).json({ success: false, error: 'No token provided' });
        return;
      }

      const token = authHeader.split('Bearer ')[1];
      let userId;
      let userEmail;
      let authMethod;

      // Try Firebase Auth first
      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        userId = decodedToken.uid;
        userEmail = decodedToken.email;
        authMethod = 'firebase';
      } catch (firebaseError) {
        // If Firebase auth fails, verify as Google OAuth access token
        try {
          console.log('Attempting Google OAuth token verification...');
          const tokenInfoResponse = await fetch(
            `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`
          );
          
          console.log('Token info response status:', tokenInfoResponse.status);
          
          if (!tokenInfoResponse.ok) {
            const errorBody = await tokenInfoResponse.text();
            console.error('Token info response not OK:', errorBody);
            throw new Error(`Invalid access token: ${tokenInfoResponse.status} ${errorBody}`);
          }
          
          const tokenInfo = await tokenInfoResponse.json();
          console.log('Token info received:', JSON.stringify(tokenInfo, null, 2));
          
          userEmail = tokenInfo.email;
          if (!userEmail) {
            throw new Error('No email found in token info');
          }
          console.log('User email from token:', userEmail);
          
          const userRecord = await admin.auth().getUserByEmail(userEmail);
          userId = userRecord.uid;
          authMethod = 'google_oauth';
          console.log('Successfully authenticated via Google OAuth for user:', userId);

        } catch (googleError) {
          console.error('Google OAuth verification failed:', googleError.toString());
          console.error('Original Firebase auth error:', firebaseError.toString());
          res.status(401).json({ 
            success: false, 
            error: 'Invalid token. Check Cloud Function logs for details.' 
          });
          return;
        }
      }
      
      res.status(200).json({ 
        success: true, 
        userId: userId,
        email: userEmail,
        method: authMethod
      });
      
    } catch (error) {
      console.error('Auth error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });
});
