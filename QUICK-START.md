# Quick Start Guide - GTD System

## 🚀 Getting Started in 15 Minutes

### Prerequisites
- Node.js 18+ installed
- Firebase account
- API keys for Claude and/or Gemini (optional but recommended)

### Step 1: Initial Setup (5 minutes)

```bash
# Make setup script executable
chmod +x setup.sh

# Run setup script
./setup.sh
```

This script will:
- Check prerequisites
- Install all dependencies
- Create .gitignore
- Initialize Git repository
- Guide you through configuration

### Step 2: Configure Environment (5 minutes)

#### 2.1 Firebase Configuration
Your Firebase config is already in the codebase. If you need to update it:

```bash
# Edit gtd-pwa/src/firebase.js
# The config is already set up for your project: personal-gtd-ea76d
```

#### 2.2 AI Service Keys (Recommended)

Get your API keys:
- **Claude API**: https://console.anthropic.com/
- **Gemini API**: https://aistudio.google.com/app/apikey

Configure Cloud Functions:
```bash
firebase functions:config:set anthropic.key="YOUR_CLAUDE_API_KEY"
firebase functions:config:set google.key="YOUR_GEMINI_API_KEY"
```

### Step 3: Import Your MLO Data (3 minutes)

```bash
# Export your data from MyLifeOrganized as XML
# Then run the import script:
node import-mlo.js path/to/your-mlo-export.xml your-email@gmail.com
```

The script will:
- Parse your MLO XML file
- Convert tasks to Firestore format
- Preserve hierarchy and relationships
- Calculate initial priorities
- Show import statistics

### Step 4: Test Locally (2 minutes)

```bash
# Start the React app
cd gtd-pwa
npm start
```

Open http://localhost:3000 and:
1. Sign in with Google
2. Verify your tasks appear
3. Test adding a new task
4. Try editing and completing tasks

### Step 5: Deploy to Production

```bash
# Build the React app
cd gtd-pwa
npm run build

# Copy build to hosting directory
cp -r build ../build

# Deploy everything to Firebase
cd ..
firebase deploy
```

Your app will be live at: https://personal-gtd-ea76d.web.app

---

## 🎤 Voice Interface Setup

### Enable Voice Commands

The voice interface is built into the app. To use it:

1. **On Desktop**: 
   - Click the microphone button (bottom right)
   - Allow microphone access when prompted
   - Start speaking your commands

2. **On Mobile**:
   - Add the PWA to your home screen
   - Open from home screen for app-like experience
   - Tap microphone button to start

3. **In Your Car** (Hands-Free):
   - Connect phone to car via Bluetooth
   - Open the app
   - Use voice commands while phone is mounted safely
   - The app will speak responses through car speakers

### Voice Command Examples

**Adding Tasks:**
- "Add task to buy groceries"
- "Create a reminder to call John tomorrow"
- "I need to review the quarterly report"

**Querying Tasks:**
- "What's on my list for today?"
- "Show me tasks I can do at home"
- "What are my urgent tasks?"
- "List my top priorities"

**Completing Tasks:**
- "Mark 'Buy groceries' as done"
- "I finished the quarterly report"
- "Complete all errands tasks"

**Updating Tasks:**
- "Move 'Project proposal' to next Monday"
- "Change 'Review documents' to high priority"
- "Add context @office to 'Team meeting'"

**Research:**
- "Research best practices for sprint planning"
- "Tell me about Agile project management"
- "How should I structure a product launch?"

### Voice Confirmations

For safety, all modifications require confirmation:
- You: "Add task to buy milk"
- Assistant: "I'll add 'Buy milk' to your grocery list. Should I proceed?"
- You: "Yes"
- Assistant: "Task added successfully"

---

## 🤖 AI Agent Features

### Task Analysis

When you add a new task or project, click "Get AI Suggestions":

1. AI analyzes the task
2. Suggests subtasks breakdown
3. Provides time estimates
4. Recommends contexts
5. Identifies dependencies
6. Highlights quick wins

### Deep Research

For complex projects, use "Deep Research":

1. Enter your topic/project
2. Choose depth (quick/standard/deep)
3. AI researches and provides:
   - Best practices
   - Step-by-step plan
   - Resource requirements
   - Success criteria
   - Actionable tasks

4. Listen to audio summary while driving/commuting

---

## 📱 Progressive Web App (PWA)

### Install on Mobile

#### iOS:
1. Open app in Safari
2. Tap Share button
3. Tap "Add to Home Screen"
4. Tap "Add"

#### Android:
1. Open app in Chrome
2. Tap menu (3 dots)
3. Tap "Add to Home Screen"
4. Tap "Add"

### Offline Usage

The app works offline:
- ✅ View all tasks
- ✅ Add new tasks
- ✅ Edit tasks
- ✅ Complete tasks
- ✅ Voice commands (queued for sync)
- ❌ AI features (require internet)

Tasks sync automatically when you're back online.

---

## 🔄 Backup & Restore

### Automatic Backups

Daily backups run at 2 AM PST automatically:
- All tasks backed up to Cloud Storage
- Last 30 days retained
- Accessible in Firebase Console > Storage > backups/

### Manual Backup

```bash
# Trigger immediate backup via Cloud Function
firebase functions:call triggerBackup
```

### Export Your Data

From the app:
1. Click Settings
2. Click "Export Data"
3. Choose format:
   - **JSON**: Full data with all properties
   - **CSV**: Spreadsheet-compatible
   - **MLO XML**: Re-import to MyLifeOrganized

### Restore from Backup

```bash
# Download backup from Firebase Storage
# Then run import script with the backup file
node import-mlo.js backup-file.json your-email@gmail.com
```

---

## 🧪 Testing Environments

### Local Development
```bash
cd gtd-pwa
npm start
```
- URL: http://localhost:3000
- Uses production Firestore
- Hot reload enabled

### Firebase Emulator (Recommended)
```bash
firebase emulators:start
```
- Uses local Firestore
- Test without affecting production
- Includes Cloud Functions emulator

### Staging Environment
```bash
# Deploy to staging (if configured)
firebase use staging
firebase deploy
```

---

## 📊 Monitoring & Analytics

### View Logs

```bash
# Cloud Functions logs
firebase functions:log

# Filter by function
firebase functions:log --only analyzeTask

# Follow logs in real-time
firebase functions:log --follow
```

### Firebase Console

Access detailed analytics:
- https://console.firebase.google.com/project/personal-gtd-ea76d

Monitor:
- User authentication
- Firestore read/write operations
- Cloud Functions invocations
- Storage usage
- Error rates

---

## 🐛 Troubleshooting

### Voice Commands Not Working

**Issue**: Microphone not accessible
**Solution**: 
- Check browser permissions
- Use Chrome or Edge (best support)
- Ensure HTTPS connection

**Issue**: Commands not being processed
**Solution**:
- Check Cloud Functions are deployed
- Verify API keys are configured
- Check browser console for errors

### Offline Sync Issues

**Issue**: Tasks not syncing when back online
**Solution**:
- Check internet connection
- Refresh the app
- Check Firestore rules in Firebase Console

### Import Errors

**Issue**: MLO import fails
**Solution**:
- Verify XML file is valid
- Check user email exists in Firebase Auth
- Review console output for specific errors

---

## 🔐 Security Best Practices

1. **API Keys**: Never commit keys to Git
   - Use environment variables
   - Store in Firebase Functions config

2. **Firestore Rules**: Already configured
   - Users can only access their own data
   - Enforced server-side

3. **Authentication**: Required for all operations
   - Google OAuth only
   - No password storage

4. **Backups**: Encrypted at rest
   - Stored in Firebase Storage
   - Access controlled by IAM

---

## 📈 Performance Optimization

### PWA Performance
- Service Worker caches static assets
- Firestore offline persistence enabled
- Lazy loading for components

### Database Optimization
- Indexed queries for fast retrieval
- Hierarchical structure minimizes reads
- Batch writes for imports

### Cost Optimization
- Free tier covers most personal use
- AI calls only on-demand
- Automatic backup cleanup (30 days)

---

## 🆘 Getting Help

### Common Issues
Check TROUBLESHOOTING.md for solutions

### Documentation
- Architecture: GTD-System-Architecture.md
- This guide: QUICK-START.md

### Firebase Documentation
- Firestore: https://firebase.google.com/docs/firestore
- Functions: https://firebase.google.com/docs/functions
- Hosting: https://firebase.google.com/docs/hosting

### Community
- Firebase Slack: https://firebase.community/
- Anthropic Discord: https://discord.gg/anthropic

---

## ✅ Verification Checklist

After setup, verify:

- [ ] App runs locally (`npm start`)
- [ ] Can sign in with Google
- [ ] Tasks display correctly
- [ ] Can add/edit/complete tasks
- [ ] Voice interface works
- [ ] AI suggestions generate
- [ ] Backup runs successfully
- [ ] Deployed to Firebase
- [ ] PWA installable on mobile
- [ ] Offline mode works

---

## 🎯 Next Steps

1. **Customize for Your Workflow**
   - Add custom contexts
   - Set up recurring tasks
   - Configure focus areas

2. **Explore AI Features**
   - Try task analysis
   - Test deep research
   - Generate audio summaries

3. **Voice Training**
   - Practice common commands
   - Learn confirmation flow
   - Test in various environments

4. **Mobile Setup**
   - Install PWA
   - Test offline mode
   - Configure notifications

5. **Backup Strategy**
   - Test manual backup
   - Verify automatic backups
   - Practice restore

---

**You're all set! Start managing your tasks with AI-powered GTD.** 🚀
