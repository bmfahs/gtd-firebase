# Personal GTD System - Architecture & Implementation Guide

## Executive Summary

This document outlines the architecture for transforming your MyLifeOrganized setup into a comprehensive Google Workspace-based GTD system with AI-powered features, voice interaction, and offline capabilities.

## Current State Analysis

### ✅ What You Already Have
- **Firebase Project**: `personal-gtd-ea76d` configured with Firestore
- **React PWA**: Basic structure with offline persistence
- **Authentication**: Google Sign-In implemented
- **Data Model**: Hierarchical task structure with GTD properties
- **Import Script**: MLO XML to Firestore migration tool
- **Interactive UI**: Task management with add/edit/delete/complete
- **Security Rules**: User-scoped data access

### 🎯 What We Need to Add
1. Voice interaction (conversational AI)
2. AI agent for task proposals and research
3. Audio summaries
4. Export functionality
5. Backup/restore system
6. Version control and deployment pipeline
7. Testing environment

---

## System Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Applications                      │
├────────────────────┬────────────────────┬───────────────────┤
│   Web/Desktop PWA  │   Mobile PWA       │  Voice Interface  │
│   (React)          │   (React)          │  (Speech APIs)    │
└────────────────────┴────────────────────┴───────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Firebase Services                         │
├────────────────────┬────────────────────┬───────────────────┤
│   Firestore DB     │   Cloud Functions  │   Authentication  │
│   (offline sync)   │   (AI/API layer)   │   (Google Auth)   │
└────────────────────┴────────────────────┴───────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    AI & External Services                    │
├────────────────────┬────────────────────┬───────────────────┤
│   Claude API       │   Google Gemini    │   Text-to-Speech  │
│   (task analysis)  │   (conversation)   │   (audio output)  │
└────────────────────┴────────────────────┴───────────────────┘
```

---

## Feature Implementation Roadmap

### Phase 1: Infrastructure & Foundation (Week 1-2)
**Priority: CRITICAL**

#### 1.1 Version Control Setup
```bash
# Initialize Git repository
git init
git remote add origin <your-repo-url>

# Create .gitignore
echo "node_modules/
.env
.env.local
serviceAccountKey.json
.firebase/
build/
*.local
.DS_Store" > .gitignore

# Initial commit
git add .
git commit -m "Initial commit: GTD PWA with Firebase"
git push -u origin main
```

#### 1.2 Environment Configuration
```javascript
// .env.local (DO NOT COMMIT)
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_domain
REACT_APP_FIREBASE_PROJECT_ID=personal-gtd-ea76d
REACT_APP_FIREBASE_STORAGE_BUCKET=your_bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id

# AI Service Keys
REACT_APP_ANTHROPIC_API_KEY=your_claude_key
REACT_APP_GOOGLE_AI_KEY=your_gemini_key

# Cloud Function Keys (set in Firebase)
ANTHROPIC_API_KEY=your_claude_key
GOOGLE_AI_KEY=your_gemini_key
```

#### 1.3 Backup System
**Automated Daily Backups via Cloud Function**

```javascript
// functions/backup.js
const { Storage } = require('@google-cloud/storage');
const admin = require('firebase-admin');

exports.scheduledBackup = functions.pubsub
  .schedule('0 2 * * *') // 2 AM daily
  .onRun(async (context) => {
    const bucket = admin.storage().bucket();
    const collections = ['tasks', 'users', 'contexts'];
    
    for (const collection of collections) {
      const snapshot = await admin.firestore().collection(collection).get();
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      const fileName = `backups/${collection}_${Date.now()}.json`;
      const file = bucket.file(fileName);
      await file.save(JSON.stringify(data, null, 2));
    }
    
    console.log('Backup completed');
  });
```

#### 1.4 Deployment Pipeline
```yaml
# .github/workflows/deploy.yml
name: Deploy to Firebase

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install dependencies
        run: cd gtd-pwa && npm install
      - name: Run tests
        run: cd gtd-pwa && npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v2
      - name: Build
        run: cd gtd-pwa && npm install && npm run build
      - name: Deploy to Firebase
        uses: w9jds/firebase-action@master
        with:
          args: deploy --only hosting,firestore,functions
        env:
          FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}
```

---

### Phase 2: AI Agent Integration (Week 2-3)
**Priority: HIGH**

#### 2.1 Cloud Functions for AI Processing

```javascript
// functions/src/aiAgent.js
const functions = require('firebase-functions');
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: functions.config().anthropic.key
});

exports.analyzeTask = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { taskTitle, taskDescription, userContext } = data;

  const prompt = `You are a GTD productivity expert. Analyze this task and provide:
1. Suggested subtasks breakdown
2. Estimated time for each subtask
3. Recommended context (@home, @office, @calls, etc.)
4. Energy level requirements
5. Dependencies or prerequisites
6. Quick wins (tasks under 15 minutes)

Task: ${taskTitle}
Description: ${taskDescription}
User's current contexts: ${userContext.contexts.join(', ')}
User's typical work hours: ${userContext.workHours}

Respond in JSON format.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: prompt
    }]
  });

  return JSON.parse(message.content[0].text);
});

exports.deepResearch = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { topic, taskContext } = data;

  const prompt = `Conduct deep research on: ${topic}

Context: This is for a GTD task/project. The user needs:
- Best practices and approaches
- Common pitfalls to avoid
- Step-by-step methodology
- Time estimates
- Resources and tools needed
- Success criteria

Provide a comprehensive analysis that can be converted to actionable tasks.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: prompt
    }]
  });

  return {
    research: message.content[0].text,
    timestamp: new Date().toISOString()
  };
});
```

#### 2.2 Text-to-Speech for Audio Summaries

```javascript
// functions/src/textToSpeech.js
const functions = require('firebase-functions');
const textToSpeech = require('@google-cloud/text-to-speech');
const { Storage } = require('@google-cloud/storage');

const ttsClient = new textToSpeech.TextToSpeechClient();
const storage = new Storage();

exports.generateAudioSummary = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { text, userId } = data;

  const request = {
    input: { text },
    voice: {
      languageCode: 'en-US',
      name: 'en-US-Neural2-J', // Professional male voice
      ssmlGender: 'MALE'
    },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: 1.0,
      pitch: 0.0
    }
  };

  const [response] = await ttsClient.synthesizeSpeech(request);
  
  const fileName = `audio/${userId}/summary_${Date.now()}.mp3`;
  const bucket = storage.bucket('personal-gtd-ea76d.appspot.com');
  const file = bucket.file(fileName);
  
  await file.save(response.audioContent, {
    metadata: {
      contentType: 'audio/mpeg'
    }
  });

  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  return { audioUrl: url };
});
```

---

### Phase 3: Voice Interaction System (Week 3-5)
**Priority: HIGH**

#### 3.1 Web Speech API Integration

```javascript
// gtd-pwa/src/components/VoiceInterface.js
import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';

const VoiceInterface = ({ user, tasks, onTaskUpdate }) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]);
  
  const recognitionRef = useRef(null);
  const synthesisRef = useRef(window.speechSynthesis);

  useEffect(() => {
    // Initialize Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const current = event.resultIndex;
        const transcript = event.results[current][0].transcript;
        
        if (event.results[current].isFinal) {
          handleVoiceCommand(transcript);
        } else {
          setTranscript(transcript);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);

    synthesisRef.current.speak(utterance);
  };

  const handleVoiceCommand = async (command) => {
    console.log('Voice command:', command);
    setTranscript('');
    
    // Add to conversation history
    const newHistory = [...conversationHistory, { role: 'user', content: command }];
    setConversationHistory(newHistory);

    // Build context for AI
    const context = {
      tasks: tasks.slice(0, 20), // Send top 20 tasks for context
      recentActions: conversationHistory.slice(-5),
      currentTime: new Date().toISOString()
    };

    try {
      // Call Cloud Function to process command with full context
      const processCommand = functions.httpsCallable('processVoiceCommand');
      const result = await processCommand({ command, context });

      // Handle the response
      const { action, response, data } = result.data;

      // Add AI response to history
      setConversationHistory([...newHistory, { role: 'assistant', content: response }]);

      // Speak the response
      speak(response);

      // Execute the action if any
      if (action === 'add_task') {
        await onTaskUpdate({ type: 'add', data });
      } else if (action === 'update_task') {
        await onTaskUpdate({ type: 'update', data });
      } else if (action === 'complete_task') {
        await onTaskUpdate({ type: 'complete', data });
      } else if (action === 'query_tasks') {
        // Response is already spoken
      }

    } catch (error) {
      console.error('Error processing voice command:', error);
      speak("I'm sorry, I had trouble processing that command. Could you try again?");
    }
  };

  return (
    <div className="voice-interface">
      <div className="voice-controls">
        <button
          onClick={isListening ? stopListening : startListening}
          className={`voice-button ${isListening ? 'active' : ''}`}
          disabled={isSpeaking}
        >
          {isListening ? <MicOff size={32} /> : <Mic size={32} />}
        </button>
        
        {isSpeaking && (
          <div className="speaking-indicator">
            <Volume2 size={24} className="pulse" />
            <span>Speaking...</span>
          </div>
        )}
      </div>

      {isListening && (
        <div className="transcript-display">
          <p>{transcript || 'Listening...'}</p>
        </div>
      )}

      <div className="conversation-history">
        {conversationHistory.slice(-5).map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <span className="role">{msg.role === 'user' ? 'You' : 'Assistant'}:</span>
            <span className="content">{msg.content}</span>
          </div>
        ))}
      </div>

      <style jsx>{`
        .voice-interface {
          position: fixed;
          bottom: 80px;
          right: 20px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          padding: 20px;
          max-width: 400px;
          z-index: 1000;
        }

        .voice-button {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          border: none;
          background: #3b82f6;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s;
          margin: 0 auto;
        }

        .voice-button:hover {
          background: #2563eb;
          transform: scale(1.05);
        }

        .voice-button.active {
          background: #ef4444;
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        .transcript-display {
          margin-top: 16px;
          padding: 12px;
          background: #f3f4f6;
          border-radius: 8px;
          min-height: 60px;
        }

        .conversation-history {
          margin-top: 16px;
          max-height: 300px;
          overflow-y: auto;
        }

        .message {
          margin-bottom: 12px;
          padding: 8px 12px;
          border-radius: 8px;
        }

        .message.user {
          background: #dbeafe;
          text-align: right;
        }

        .message.assistant {
          background: #f3f4f6;
        }

        .role {
          font-weight: 600;
          margin-right: 8px;
        }

        .speaking-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 12px;
          justify-content: center;
          color: #3b82f6;
        }

        .pulse {
          animation: pulse 1s infinite;
        }
      `}</style>
    </div>
  );
};

export default VoiceInterface;
```

#### 3.2 Voice Command Processing (Cloud Function)

```javascript
// functions/src/voiceCommands.js
const functions = require('firebase-functions');
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: functions.config().anthropic.key
});

exports.processVoiceCommand = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { command, context: userContext } = data;

  // Build a comprehensive prompt with task context
  const tasksContext = userContext.tasks.map(t => 
    `- ${t.title} (${t.context || 'no context'}, priority: ${t.importance}/${t.urgency})`
  ).join('\n');

  const systemPrompt = `You are a voice assistant for a GTD (Getting Things Done) system. 
The user is speaking to you, likely while driving or hands-free.

Current tasks:
${tasksContext}

Recent conversation:
${userContext.recentActions.map(a => `${a.role}: ${a.content}`).join('\n')}

Analyze the user's command and respond with:
1. A natural, conversational response (for text-to-speech)
2. An action to take (add_task, update_task, complete_task, query_tasks, or none)
3. Structured data for the action

For any modifications (add, update, complete), ask for EXPLICIT confirmation before executing.

Example confirmations:
- "I'll add a task called 'Buy groceries' with context @errands. Should I proceed?"
- "I'll mark 'Review quarterly report' as complete. Is that correct?"

Respond in JSON format:
{
  "response": "conversational response text",
  "action": "action_type",
  "data": { action-specific data },
  "needsConfirmation": true/false
}`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `${systemPrompt}\n\nUser command: ${command}`
    }]
  });

  const result = JSON.parse(message.content[0].text);
  
  return result;
});
```

---

### Phase 4: Export & Data Management (Week 4)
**Priority: MEDIUM**

#### 4.1 Export Functionality

```javascript
// gtd-pwa/src/utils/exportData.js
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';

export const exportToJSON = async (userId) => {
  const tasksRef = collection(db, 'tasks');
  const q = query(tasksRef, where('userId', '==', userId));
  const snapshot = await getDocs(q);
  
  const tasks = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  const dataStr = JSON.stringify(tasks, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `gtd-export-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  
  URL.revokeObjectURL(url);
};

export const exportToCSV = async (userId) => {
  const tasksRef = collection(db, 'tasks');
  const q = query(tasksRef, where('userId', '==', userId));
  const snapshot = await getDocs(q);
  
  const tasks = snapshot.docs.map(doc => doc.data());
  
  const headers = ['Title', 'Status', 'Context', 'Importance', 'Urgency', 'Time Estimate', 'Due Date', 'Parent Task'];
  const rows = tasks.map(task => [
    task.title,
    task.status,
    task.context || '',
    task.importance,
    task.urgency,
    task.timeEstimate || '',
    task.dueDate ? task.dueDate.toDate().toISOString() : '',
    task.parentId || ''
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `gtd-export-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  
  URL.revokeObjectURL(url);
};

export const exportToMLO = async (userId) => {
  // Convert back to MLO XML format for compatibility
  const tasksRef = collection(db, 'tasks');
  const q = query(tasksRef, where('userId', '==', userId));
  const snapshot = await getDocs(q);
  
  const tasks = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  // Build hierarchical structure
  const taskTree = buildTaskTree(tasks);
  
  // Generate MLO XML
  const xml = generateMLOXML(taskTree);
  
  const blob = new Blob([xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `gtd-export-${new Date().toISOString().split('T')[0]}.xml`;
  link.click();
  
  URL.revokeObjectURL(url);
};

function buildTaskTree(tasks) {
  // Same logic as in import-mlo.js but reversed
  // ... implementation
}

function generateMLOXML(taskTree) {
  // Generate MLO-compatible XML
  // ... implementation
}
```

---

## Implementation Priority Matrix

```
┌──────────────────────────────────────────────────────────┐
│ HIGH PRIORITY + HIGH IMPACT                              │
├──────────────────────────────────────────────────────────┤
│ 1. Voice Interface (driving use case)                    │
│ 2. AI Task Analysis (immediate productivity boost)       │
│ 3. Backup System (data protection)                       │
│ 4. Version Control (code safety)                         │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ HIGH PRIORITY + MEDIUM IMPACT                            │
├──────────────────────────────────────────────────────────┤
│ 5. Export Functionality (data portability)               │
│ 6. Audio Summaries (consumption while driving)           │
│ 7. Deep Research (project planning)                      │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ MEDIUM PRIORITY                                          │
├──────────────────────────────────────────────────────────┤
│ 8. Testing Pipeline (quality assurance)                  │
│ 9. Staging Environment (safe deployments)                │
│ 10. Analytics Dashboard (usage insights)                 │
└──────────────────────────────────────────────────────────┘
```

---

## Immediate Next Steps

### Week 1: Foundation
1. **Set up Git repository** (30 minutes)
2. **Configure environment variables** (1 hour)
3. **Implement backup system** (3 hours)
4. **Set up GitHub Actions** (2 hours)

### Week 2: Core AI Features
1. **Deploy Cloud Functions for AI** (4 hours)
2. **Implement task analysis** (4 hours)
3. **Add deep research capability** (3 hours)
4. **Test AI responses** (2 hours)

### Week 3: Voice Interface
1. **Build VoiceInterface component** (6 hours)
2. **Implement speech recognition** (4 hours)
3. **Add text-to-speech** (3 hours)
4. **Test in car scenario** (2 hours)

### Week 4: Polish & Deploy
1. **Add export functionality** (4 hours)
2. **Comprehensive testing** (4 hours)
3. **Deploy to production** (2 hours)
4. **User testing & feedback** (ongoing)

---

## Technical Recommendations

### 1. Service Worker Enhancement
Enable true offline capabilities:
```javascript
// gtd-pwa/src/serviceWorkerRegistration.js
// Change from:
serviceWorkerRegistration.unregister();
// To:
serviceWorkerRegistration.register();
```

### 2. IndexedDB for Offline Voice Commands
Store voice commands locally when offline and sync when online:
```javascript
// gtd-pwa/src/utils/offlineQueue.js
import { openDB } from 'idb';

const dbPromise = openDB('gtd-offline', 1, {
  upgrade(db) {
    db.createObjectStore('commands', { keyPath: 'id', autoIncrement: true });
  }
});

export async function queueCommand(command) {
  const db = await dbPromise;
  await db.add('commands', {
    ...command,
    timestamp: Date.now(),
    synced: false
  });
}

export async function syncCommands() {
  const db = await dbPromise;
  const commands = await db.getAll('commands');
  
  for (const cmd of commands.filter(c => !c.synced)) {
    try {
      await processCommand(cmd);
      await db.put('commands', { ...cmd, synced: true });
    } catch (error) {
      console.error('Sync failed for command:', cmd, error);
    }
  }
}
```

### 3. Progressive Enhancement
Build features that work without AI but are enhanced with it:
- Basic task management works offline
- AI features require internet but fail gracefully
- Voice commands queue offline and sync later

---

## Security Considerations

1. **API Key Protection**: Use Cloud Functions as proxy, never expose keys in client
2. **User Data Isolation**: Firestore rules ensure users only access their data
3. **Voice Data**: Don't store voice recordings, only transcripts
4. **Backup Encryption**: Encrypt backups at rest
5. **Rate Limiting**: Prevent abuse of AI endpoints

---

## Cost Estimates (Monthly)

```
Firebase (Spark Plan - Free Tier):
- Firestore: Free up to 1GB storage, 50K reads/day
- Functions: Free 2M invocations/month
- Hosting: Free 10GB bandwidth/month
- Authentication: Free unlimited

AI Services:
- Claude API: ~$20-50/month (depending on usage)
- Google TTS: ~$4-16/month (1M characters = $16)
- Gemini API: Free tier available, then usage-based

GitHub: Free for personal use

Total Estimated: $25-75/month for moderate use
```

---

## Success Metrics

### Technical
- ✅ Offline functionality works reliably
- ✅ Voice commands process within 2 seconds
- ✅ 99.9% uptime for web app
- ✅ Zero data loss incidents

### User Experience
- ✅ Can add/update tasks while driving safely
- ✅ AI suggestions are relevant >80% of the time
- ✅ Audio summaries are clear and useful
- ✅ Export/backup works reliably

### Business
- ✅ Replace MLO completely within 2 months
- ✅ Increase task completion rate
- ✅ Reduce time spent on task management
- ✅ Better alignment with GTD methodology

---

## Additional Resources

### Documentation to Create
1. User Manual (voice commands, features)
2. API Documentation (Cloud Functions)
3. Deployment Guide
4. Troubleshooting Guide

### Testing Scenarios
1. Offline task management
2. Voice commands while driving
3. AI analysis accuracy
4. Backup/restore procedures
5. Cross-device synchronization

---

## Questions for Next Steps

1. **API Keys**: Do you have Anthropic (Claude) and Google AI API keys?
2. **GitHub**: Do you have a repository set up, or should we create one?
3. **Testing**: Do you want to start with voice interface or AI analysis first?
4. **Deployment**: Any preference between manual deployments vs. automated CI/CD?

Let me know which area you'd like to tackle first, and I'll provide the detailed implementation!
