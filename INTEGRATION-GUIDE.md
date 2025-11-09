# Integration Guide: Adding Voice Interface to Your GTD App

## Overview
This guide shows you how to integrate the VoiceInterface component into your existing GTD application.

## Step 1: Copy New Files

Copy these new files to your project:

```bash
# Cloud Functions
cp -r outputs/functions/* functions/

# Voice Interface Component
cp outputs/gtd-pwa/src/components/VoiceInterface.js gtd-pwa/src/components/

# Configuration
cp outputs/.env.local.template .env.local.template
```

## Step 2: Install New Dependencies

### For Cloud Functions
```bash
cd functions
npm install @anthropic-ai/sdk@^0.30.0
npm install @google-cloud/text-to-speech@^5.6.0
npm install @google-cloud/storage@^7.14.0
cd ..
```

### For React App (if not already installed)
```bash
cd gtd-pwa
npm install lucide-react@^0.553.0
cd ..
```

## Step 3: Update App.js

Add the VoiceInterface to your main App component:

```javascript
// gtd-pwa/src/App.js
import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { collection, getDocs, query, where, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import InteractiveGTDApp from './InteractiveGTDApp';
import VoiceInterface from './components/VoiceInterface'; // ADD THIS
import './App.css';

// ... existing buildTaskTree and filterCompletedTrees functions ...

function App() {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showVoice, setShowVoice] = useState(false); // ADD THIS

  // ... existing useEffect and fetchTasks ...

  // ADD THIS: Handle voice interface task updates
  const handleVoiceTaskUpdate = async ({ type, data }) => {
    try {
      const tasksCollectionRef = collection(db, 'tasks');

      switch (type) {
        case 'add':
          await addDoc(tasksCollectionRef, {
            ...data,
            userId: user.uid,
            status: 'next_action',
            createdDate: serverTimestamp(),
            modifiedDate: serverTimestamp(),
            computedPriority: 0,
            childCount: 0,
            source: 'voice'
          });
          break;

        case 'update':
          if (data.id) {
            const taskRef = doc(db, 'tasks', data.id);
            await updateDoc(taskRef, {
              ...data,
              modifiedDate: serverTimestamp()
            });
          }
          break;

        case 'complete':
          if (data.id) {
            const taskRef = doc(db, 'tasks', data.id);
            await updateDoc(taskRef, {
              status: 'done',
              completedDate: serverTimestamp(),
              modifiedDate: serverTimestamp()
            });
          }
          break;

        case 'delete':
          if (data.id) {
            await deleteDoc(doc(db, 'tasks', data.id));
          }
          break;

        default:
          console.log('Unknown task update type:', type);
      }

      // Refresh tasks
      await fetchTasks(user);
    } catch (error) {
      console.error('Error updating task from voice:', error);
      throw error;
    }
  };

  // ... existing handlers ...

  if (loading) {
    return (
      <div className="App">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading your tasks...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="App">
        <header className="App-header">
          <div className="login-container">
            <h1>Welcome to GTD</h1>
            <p>Organize your tasks and get things done</p>
            <button onClick={handleGoogleSignIn} className="signin-button">
              Sign In with Google
            </button>
          </div>
        </header>
      </div>
    );
  }

  if (error) {
    return <div className="App error-message">Error: {error}</div>;
  }

  return (
    <div className="App">
      <nav className="top-nav">
        <div className="nav-content">
          <h2>GTD System</h2>
          <div className="nav-actions">
            {/* ADD THIS: Voice toggle button */}
            <button 
              onClick={() => setShowVoice(!showVoice)} 
              className="voice-toggle-button"
              title="Toggle voice assistant"
            >
              🎤 Voice
            </button>
            <span className="user-email">{user.email}</span>
            <button onClick={handleSignOut} className="signout-button">
              Sign Out
            </button>
          </div>
        </div>
      </nav>
      
      <InteractiveGTDApp 
        user={user} 
        tasks={tasks} 
        onUpdate={() => fetchTasks(user)} 
      />

      {/* ADD THIS: Conditional voice interface */}
      {showVoice && (
        <VoiceInterface 
          user={user}
          tasks={tasks}
          onTaskUpdate={handleVoiceTaskUpdate}
        />
      )}
    </div>
  );
}

export default App;
```

## Step 4: Add CSS for Voice Toggle Button

Add this to your `gtd-pwa/src/App.css`:

```css
.voice-toggle-button {
  padding: 8px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
}

.voice-toggle-button:hover {
  background: #2563eb;
}
```

## Step 5: Deploy Cloud Functions

```bash
# Set up API keys
firebase functions:config:set anthropic.key="YOUR_CLAUDE_API_KEY"
firebase functions:config:set google.key="YOUR_GEMINI_API_KEY"

# Deploy functions
firebase deploy --only functions
```

## Step 6: Configure Firestore Indexes

The voice commands may require composite indexes. If you see errors about missing indexes, Firebase will provide a link to create them automatically, or add them manually:

```json
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "tasks",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "importance", "order": "DESCENDING" }
      ]
    }
  ]
}
```

## Step 7: Test Voice Interface

1. **Start your development server:**
   ```bash
   cd gtd-pwa
   npm start
   ```

2. **Sign in to the app**

3. **Click the "🎤 Voice" button** in the top navigation

4. **Click the microphone button** and allow microphone access

5. **Test commands:**
   - "Add task to buy groceries"
   - "What tasks do I have?"
   - "Show me my urgent tasks"

## Step 8: Enable Service Worker (PWA)

For offline voice command queueing, enable the service worker:

```javascript
// gtd-pwa/src/index.js
// Change this line:
serviceWorkerRegistration.unregister();

// To this:
serviceWorkerRegistration.register();
```

## Troubleshooting

### Voice Not Working
1. Check browser console for errors
2. Verify microphone permissions
3. Test in Chrome or Edge (best support)
4. Ensure HTTPS (localhost is ok)

### Cloud Functions Not Responding
1. Check functions are deployed: `firebase functions:list`
2. Verify API keys: `firebase functions:config:get`
3. Check function logs: `firebase functions:log`

### Tasks Not Syncing
1. Check Firestore rules allow writes
2. Verify user is authenticated
3. Check browser console for errors

## Advanced: Customizing Voice Commands

To customize voice command processing, edit:
```javascript
// functions/index.js

exports.processVoiceCommand = functions.https.onCall(async (data, context) => {
  // Modify the system prompt to recognize your custom commands
  const systemPrompt = `...your custom instructions...`;
  
  // Add custom command handlers
  if (command.includes('my custom trigger')) {
    // Handle custom command
  }
});
```

## Advanced: Custom Voice

To change the voice used for text-to-speech:

```javascript
// gtd-pwa/src/components/VoiceInterface.js

// Find this in the speak() function:
utterance.lang = 'en-US';

// Change to other languages/voices:
utterance.lang = 'en-GB'; // British English
utterance.lang = 'en-AU'; // Australian English
```

For cloud-generated audio:
```javascript
// functions/index.js - generateAudioSummary function

voice: {
  languageCode: 'en-US',
  name: 'en-US-Neural2-J', // Change this to other voices
  // Options: Neural2-A through Neural2-J
  // See: https://cloud.google.com/text-to-speech/docs/voices
}
```

## Next Steps

1. **Test thoroughly** with various commands
2. **Customize prompts** in Cloud Functions to match your workflow
3. **Add keyboard shortcuts** for quick voice activation
4. **Configure voice commands** for your specific contexts
5. **Set up analytics** to track voice usage

## Full Feature Checklist

- [ ] VoiceInterface component added
- [ ] Cloud Functions deployed
- [ ] API keys configured
- [ ] Voice toggle button in nav
- [ ] Microphone permissions working
- [ ] Basic commands work ("add task")
- [ ] Query commands work ("show tasks")
- [ ] Confirmation flow works
- [ ] Offline queueing enabled
- [ ] PWA installed on mobile
- [ ] Tested in car/hands-free scenario

## Resources

- **Web Speech API**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
- **Cloud Text-to-Speech**: https://cloud.google.com/text-to-speech/docs
- **Firebase Functions**: https://firebase.google.com/docs/functions
- **Claude API**: https://docs.anthropic.com/

---

**You're ready to control your GTD system with your voice!** 🎤
