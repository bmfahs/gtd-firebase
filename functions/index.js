const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const textToSpeech = require('@google-cloud/text-to-speech');
const { Storage } = require('@google-cloud/storage');
const cors = require('cors')({origin: true});
const { defineString } = require('firebase-functions/params');

// Initialize Firebase Admin
admin.initializeApp();

const GOOGLE_AI_API_KEY = defineString('GTD_GOOGLE_AI_API_KEY');

const ttsClient = new textToSpeech.TextToSpeechClient();
const storage = new Storage();

// ============================================================================ 
// AI AGENT FUNCTIONS
// ============================================================================ 

/**
 * Analyze a task and provide AI-powered suggestions
 * Input: { taskTitle, taskDescription, userContext }
 * Output: { subtasks, timeEstimates, contexts, energyLevels, dependencies, quickWins }
 */
exports.analyzeTask = onCall(async (data, context) => {
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { taskTitle, taskDescription, userContext } = data;

  // Build context-aware prompt
  const prompt = `You are a GTD (Getting Things Done) productivity expert. Analyze this task and provide actionable recommendations.

Task: ${taskTitle}
Description: ${taskDescription || 'No additional description provided'}

User Context:
- Available contexts: ${userContext.contexts?.join(', ') || '@home, @office, @calls, @computer, @errands'}
- Typical work hours: ${userContext.workHours || '9 AM - 5 PM'}
- Current focus areas: ${userContext.focusAreas?.join(', ') || 'Not specified'}

Please provide:
1. **Subtask Breakdown**: Break this into 3-7 actionable subtasks
2. **Time Estimates**: Realistic time in minutes for each subtask
3. **Context Assignment**: Best context for each subtask
4. **Energy Level**: Required energy (low/medium/high) for each
5. **Dependencies**: What needs to happen first
6. **Quick Wins**: Any subtasks under 15 minutes
7. **Overall Strategy**: Brief recommendation on approach

Respond in JSON format with this structure:
{
  "subtasks": [
    {
      "title": "Clear, actionable task title",
      "description": "Brief explanation",
      "timeEstimate": 30,
      "context": "@office",
      "energyLevel": "medium",
      "importance": 4,
      "urgency": 3
    }
  ],
  "dependencies": ["Task 1 must complete before Task 3"],
  "quickWins": ["Any tasks under 15 minutes"],
  "strategy": "Overall approach recommendation",
  "estimatedTotalTime": 120
}`;

  try {
    const genAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY.value());
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      }
    });

    const response = result.response;
    const text = response.text();
    
    // Parse JSON from response
    let analysis;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[1]);
      } else {
        analysis = JSON.parse(text);
      }
    } catch (parseError) {
      console.error('Error parsing JSON from Gemini response:', parseError);
      // Return a structured error response
      analysis = {
        error: 'Failed to parse AI response',
        rawResponse: text
      };
    }
    
    // Log for monitoring
    console.log(`Task analyzed for user ${context.auth.uid}: ${taskTitle}`);
    
    return {
      success: true,
      analysis,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error analyzing task:', error);
    throw new functions.https.HttpsError('internal', 'Failed to analyze task');
  }
});

/**
 * Conduct deep research on a topic
 * Input: { topic, taskContext, depth }
 * Output: { research, actionableTasks, resources }
 */
exports.deepResearch = onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { topic, taskContext, depth = 'standard' } = data;

  const maxTokens = depth === 'deep' ? 4000 : depth === 'quick' ? 1500 : 2500;

  const prompt = `Conduct ${depth} research on: "${topic}"

Context: This research is for a GTD task/project. The user needs actionable insights.

${taskContext ? `Additional Context: ${taskContext}` : ''}

Please provide:
1. **Overview**: What is this about and why it matters
2. **Key Approaches**: 3-5 proven methods or strategies
3. **Best Practices**: Do's and don'ts
4. **Common Pitfalls**: What to avoid
5. **Step-by-Step Plan**: Actionable sequence of tasks
6. **Time Estimates**: How long each phase typically takes
7. **Resources Needed**: Tools, budget, skills required
8. **Success Criteria**: How to know you're done
9. **Quick Wins**: Fast results to build momentum

Format as JSON:
{
  "overview": "Comprehensive summary",
  "approaches": [{"name": "Approach name", "description": "...", "pros": [], "cons": []}],
  "bestPractices": ["Practice 1", "Practice 2"],
  "pitfalls": ["Pitfall 1", "Pitfall 2"],
  "actionPlan": [
    {
      "phase": "Phase name",
      "tasks": ["Task 1", "Task 2"],
      "timeEstimate": "2 weeks",
      "priority": "high"
    }
  ],
  "resources": {
    "tools": ["Tool 1"],
    "budget": "Estimate",
    "skills": ["Skill 1"]
  },
  "successCriteria": ["Criterion 1"],
  "quickWins": ["Win 1"]
}`;

  try {
    const genAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY.value());
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: maxTokens,
      }
    });

    const response = result.response;
    const text = response.text();
    
    // Parse JSON from response
    let research;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        research = JSON.parse(jsonMatch[1]);
      } else {
        research = JSON.parse(text);
      }
    } catch (parseError) {
      console.error('Error parsing JSON from Gemini response:', parseError);
      // Return a structured error response
      research = {
        error: 'Failed to parse AI response',
        rawResponse: text
      };
    }
    
    console.log(`Deep research completed for user ${context.auth.uid}: ${topic}`);
    
    return {
      success: true,
      research,
      timestamp: new Date().toISOString(),
      depth
    };

  } catch (error) {
    console.error('Error conducting research:', error);
    throw new functions.https.HttpsError('internal', 'Failed to conduct research');
  }
});

// ============================================================================ 
// VOICE INTERFACE FUNCTIONS
// ============================================================================ 

/**
 * Process voice commands with full task context
 * Input: { command, context: { tasks, recentActions, preferences } }
 * Output: { response, action, data, needsConfirmation }
 */
exports.processVoiceCommand = onRequest(async (req, res) => {
  // Adding a comment to force a change. (Attempt 2)
  cors(req, res, async () => {
    try {
      const genAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY.value());
      console.log('Request body:', req.body);
      if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
      }

      // Manually handle authentication
      const idToken = req.headers.authorization?.split('Bearer ')[1];
      console.log('ID Token:', idToken);
      let decodedToken;
      if (idToken) {
        try {
          decodedToken = await admin.auth().verifyIdToken(idToken);
          console.log('Decoded Token:', decodedToken);
        } catch (error) {
          console.error('Error verifying ID token:', error);
          return res.status(401).send('Unauthorized');
        }
      } else {
        return res.status(401).send('Unauthorized');
      }

      const { command, context: userContext } = req.body.data;
      console.log('Command:', command);
      console.log('User Context:', userContext);

      // Build comprehensive context
      const tasksContext = userContext.tasks?.map(t => 
        `- "${t.title}" (${t.context || 'no context'}, ${t.status}, priority: ${t.importance || 3}/${t.urgency || 3})`
      ).join('\n') || 'No active tasks';

      const recentContext = userContext.recentActions?.map(a => 
        `${a.role}: ${a.content}`
      ).join('\n') || 'No recent conversation';

      const systemPrompt = `You are a voice assistant for a GTD (Getting Things Done) productivity system.
The user is interacting hands-free, likely while driving or in a meeting.

CURRENT TASKS:
${tasksContext}

RECENT CONVERSATION:
${recentContext}

CURRENT TIME: ${new Date().toLocaleString('en-US', { timeZone: userContext.timezone || 'America/Los_Angeles' })}

IMPORTANT RULES:
1. Be conversational and natural - this is voice interaction
2. Keep responses concise (under 50 words unless asked for detail)
3. For ANY modification (add, update, complete, delete), ask for explicit confirmation
4. If unsure what the user wants, ask clarifying questions
5. Provide context when listing tasks (e.g., "at home", "at office")
6. For queries, provide the most relevant information first
7. For contexts, always use one from 'Available contexts' if a suitable one exists. If not, propose adding a new context or including the context text in the task title.
8. If a parent task is not explicitly mentioned or obvious, default to suggesting '<Inbox>' as the parent.

VOICE COMMANDS TYPES:
- ADD: "Add task to...", "Create a reminder to...", "I need to..."
  (For 'add_task' action, 'data' should include 'title', 'context' (from 'Available contexts' or proposed new), and optionally 'parentId' (defaulting to '<Inbox>' if not specified))
- QUERY: "What's on my list?", "What do I need to do at home?", "Show me urgent tasks"
- COMPLETE: "Mark ... as done", "I finished ...", "Complete ..."
- UPDATE: "Change ... to ...", "Move ... to tomorrow", "Make ... high priority"
- RESEARCH: "Tell me about...", "How should I approach...", "Research ..."

Respond in JSON format:
{
  "response": "Natural, conversational text for speech synthesis",
  "action": "add_task|update_task|complete_task|query_tasks|research|none",
  "data": {
    // Action-specific data
  },
  "needsConfirmation": true|false,
  "clarificationNeeded": false|true
}

CONFIRMATION EXAMPLES:
- "I'll add 'Buy groceries' to your errands list. Should I proceed?"
- "I'll mark 'Review quarterly report' as complete. Is that correct?"
- "I'll change the due date of 'Project proposal' to next Monday. Confirm?"`;

      // Use Gemini 1.5 Flash for faster voice command processing
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const result = await model.generateContent({
        contents: [{ 
          role: 'user', 
          parts: [{ text: `${systemPrompt}\n\nUSER COMMAND: "${command}"` }] 
        }],
        generationConfig: {
          temperature: 0.8,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      });

      const response = result.response;
      const text = response.text();
      console.log('Gemini Response:', text);
      
      // Parse JSON from response
      let result_data;
      try {
        // Try to extract JSON from markdown code blocks if present
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          result_data = JSON.parse(jsonMatch[1]);
        } else {
          result_data = JSON.parse(text);
        }
      } catch (parseError) {
        // If JSON parsing fails, extract text and create fallback response
        console.log('Failed to parse JSON, using fallback response');
        result_data = {
          response: text,
          action: 'none',
          data: {},
          needsConfirmation: false
        };
      }
      
      console.log(`Voice command processed for user ${decodedToken.uid}: ${command}`);
      
      res.json({
        data: {
          success: true,
          ...result_data,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error processing voice command:', error);
      res.status(500).json({
        data: {
          success: false,
          error: 'Failed to process voice command'
        }
      });
    }
  });
});

/**
 * Generate audio summary from text
 * Input: { text, userId, voice }
 * Output: { audioUrl, duration }
 */
exports.generateAudioSummary = onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { text, userId, voice = 'en-US-Neural2-J' } = data;

  // Validate text length
  if (!text || text.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Text cannot be empty');
  }

  if (text.length > 5000) {
    throw new functions.https.HttpsError('invalid-argument', 'Text too long (max 5000 characters)');
  }

  try {
    const request = {
      input: { text },
      voice: {
        languageCode: 'en-US',
        name: voice,
        ssmlGender: 'MALE'
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 1.0,
        pitch: 0.0,
        volumeGainDb: 0.0
      }
    };

    const [response] = await ttsClient.synthesizeSpeech(request);
    
    // Save to Cloud Storage
    const bucket = storage.bucket('personal-gtd-ea76d.appspot.com');
    const fileName = `audio/${userId}/summary_${Date.now()}.mp3`;
    const file = bucket.file(fileName);
    
    await file.save(response.audioContent, {
      metadata: {
        contentType: 'audio/mpeg',
        metadata: {
          userId: userId,
          generatedAt: new Date().toISOString()
        }
      }
    });

    // Generate signed URL (valid for 7 days)
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000
    });

    console.log(`Audio summary generated for user ${userId}`);

    return {
      success: true,
      audioUrl: url,
      fileName,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error generating audio summary:', error);
    throw new functions.https.HttpsError('internal', 'Failed to generate audio summary');
  }
});

// ============================================================================ 
// BACKUP & MAINTENANCE FUNCTIONS
// ============================================================================ 

/**
 * Scheduled daily backup of all user data
 * Runs at 2 AM PST daily
 */
exports.scheduledBackup = onSchedule('0 2 * * *', async (context) => {
    console.log('Starting scheduled backup...');
    
    try {
      const db = admin.firestore();
      const bucket = storage.bucket('personal-gtd-ea76d.appspot.com');
      
      // Collections to backup
      const collections = ['tasks', 'users', 'contexts', 'settings'];
      
      for (const collectionName of collections) {
        const snapshot = await db.collection(collectionName).get();
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // Convert Firestore timestamps to ISO strings
          _backup_timestamp: new Date().toISOString()
        }));
        
        const timestamp = Date.now();
        const fileName = `backups/${collectionName}_${timestamp}.json`;
        const file = bucket.file(fileName);
        
        await file.save(JSON.stringify(data, null, 2), {
          metadata: {
            contentType: 'application/json',
            metadata: {
              collection: collectionName,
              documentCount: data.length,
              backupDate: new Date().toISOString()
            }
          }
        });
        
        console.log(`Backed up ${data.length} documents from ${collectionName}`);
      }
      
      // Clean up old backups (keep last 30 days)
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const [files] = await bucket.getFiles({ prefix: 'backups/' });
      
      for (const file of files) {
        const match = file.name.match(/_(\d+)\.json$/);
        if (match) {
          const fileTimestamp = parseInt(match[1]);
          if (fileTimestamp < thirtyDaysAgo) {
            await file.delete();
            console.log(`Deleted old backup: ${file.name}`);
          }
        }
      }
      
      console.log('Backup completed successfully');
      
    } catch (error) {
      console.error('Backup failed:', error);
      throw error;
    }
  });

/**
 * Manual backup trigger
 * Can be called by admin users to create immediate backup
 */
exports.triggerBackup = onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Optional: Add admin check here
  // if (!context.auth.token.admin) {
  //   throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  // }

  try {
    // Trigger the backup logic
    await exports.scheduledBackup.run();
    
    return {
      success: true,
      message: 'Backup completed successfully',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Manual backup failed:', error);
    throw new functions.https.HttpsError('internal', 'Backup failed');
  }
});

// ============================================================================ 
// UTILITY FUNCTIONS
// ============================================================================ 

/**
 * Health check endpoint
 */
exports.healthCheck = onRequest((req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});
