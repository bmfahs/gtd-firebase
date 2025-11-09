# Quick Setup Guide - Gemini-Only Version

## 🎯 Overview

This version uses **only Google Gemini API** for all AI features. No Claude API needed!

**Benefits:**
- ✅ Simpler setup (one AI service)
- ✅ Better Google ecosystem integration
- ✅ More generous free tier (50 requests/day free!)
- ✅ Lower cost (~$0-5/month vs $25-75 with Claude)
- ✅ Likely stays FREE for personal use

---

## 🚀 Setup Steps

### Step 1: Get Your Gemini API Key (5 minutes)

1. **Go to Google AI Studio**: https://aistudio.google.com/app/apikey
2. Click **"Create API key"**
3. Select your Firebase project (or create new)
4. **Copy the API key** - you'll need it!

**Important**: This key is free for personal use with generous limits:
- 50 requests/day for Gemini Pro (task analysis)
- 1M tokens/day for Gemini Flash (voice commands)

### Step 2: Configure Firebase Functions (5 minutes)

```bash
# Set Gemini API key in Firebase Functions config
firebase functions:config:set google.key="YOUR_GEMINI_API_KEY"

# Verify it's set
firebase functions:config:get
```

### Step 3: Install Dependencies (5 minutes)

```bash
# Install Cloud Functions dependencies
cd functions
npm install

# Install includes:
# - @google/generative-ai (Gemini SDK)
# - @google-cloud/text-to-speech
# - @google-cloud/storage
# - firebase-admin
# - firebase-functions

cd ..
```

### Step 4: Deploy Cloud Functions (10 minutes)

```bash
# Deploy all functions
firebase deploy --only functions

# Or deploy individually if you prefer
firebase deploy --only functions:analyzeTask
firebase deploy --only functions:deepResearch
firebase deploy --only functions:processVoiceCommand
firebase deploy --only functions:generateAudioSummary
firebase deploy --only functions:scheduledBackup
```

### Step 5: Test Locally (10 minutes)

```bash
# Start the React app
cd gtd-pwa
npm start

# Open http://localhost:3000
# Sign in with Google
# Verify your tasks display
```

### Step 6: Test AI Features (15 minutes)

Once deployed, test each feature:

#### Test Task Analysis
1. Open a task
2. Click "Get AI Suggestions" (when you add this button)
3. Should get subtask breakdown from Gemini Pro

#### Test Voice Commands
1. Click voice button
2. Allow microphone access
3. Say: "What tasks do I have?"
4. Should get response via Gemini Flash

#### Test Deep Research
1. Click "Research Topic"
2. Enter a topic like "project management best practices"
3. Should get comprehensive research from Gemini Pro

---

## 📊 Monitoring Usage & Costs

### Check Gemini API Usage

1. Go to https://aistudio.google.com/app/apikey
2. Click on your API key
3. View usage statistics
4. Check if you're within free tier (you almost certainly will be!)

### Check Firebase Costs

```bash
# Open Firebase console
firebase console

# Go to Usage tab
# Check:
# - Cloud Functions invocations
# - Firestore operations
# - Storage usage
```

### Set Up Budget Alerts

1. Go to Google Cloud Console
2. Navigate to Billing
3. Set budget alerts at:
   - $5 warning
   - $10 warning
   - $15 limit (though you'll never hit this for personal use)

---

## 🎤 Voice Commands Examples

All voice commands now use Gemini Flash (ultra-fast and cheap):

```
# Task Management
"Add task to buy groceries"
"Show me my tasks for today"
"Mark 'Review document' as complete"
"What are my urgent tasks?"

# Context-Based
"What can I do at home?"
"Show me my @office tasks"
"List my quick wins under 15 minutes"

# Research (uses Gemini Pro)
"Research best practices for sprint planning"
"Tell me about effective time management"
"How should I structure a product launch?"
```

---

## 🔧 Troubleshooting

### "API key not valid" error

**Solution**:
```bash
# Re-set the API key
firebase functions:config:set google.key="YOUR_KEY"

# Redeploy functions
firebase deploy --only functions
```

### Voice commands not working

**Solution**:
1. Check browser console for errors
2. Verify functions are deployed: `firebase functions:list`
3. Check function logs: `firebase functions:log`
4. Test in Chrome/Edge (best Web Speech API support)

### "Quota exceeded" error

**Solution**:
1. Check usage at https://aistudio.google.com/app/apikey
2. Free tier limits:
   - Gemini Pro: 50 requests/day
   - Gemini Flash: 1M tokens/day
3. If exceeded, wait for daily reset (midnight Pacific Time)
4. Or upgrade to pay-as-you-go (still very cheap!)

---

## 💰 Cost Reality Check

### Typical Daily Usage (Personal GTD)
- **Morning**: Check tasks via voice (2 commands)
- **Work**: Add/update tasks (10 commands)
- **Planning**: Analyze 2 tasks (2 Pro requests)
- **Research**: Deep dive on 1 topic (1 Pro request)
- **Evening**: Review progress (2 commands)

**Daily Total:**
- Gemini Flash: 14 requests (WAY under 1M token limit)
- Gemini Pro: 3 requests (WAY under 50 request limit)

**Daily Cost: $0** (within free tier!)

### When You'd Actually Pay

You'd need to do ALL of this EVERY DAY to exceed free tier:
- 50+ task analyses
- 10+ deep research sessions
- 1M+ tokens of voice commands (basically impossible)

**Verdict**: For personal GTD, you'll stay free! 🎉

---

## 🆚 Gemini Models Explained

### Gemini 1.5 Flash (Voice Commands)
- **Speed**: Ultra-fast (~1 second response)
- **Cost**: Nearly free (1M tokens/day free!)
- **Use for**: Quick operations, voice commands, simple queries
- **Quality**: Good for straightforward tasks

### Gemini 1.5 Pro (Analysis & Research)
- **Speed**: Fast (~2-3 seconds)
- **Cost**: 50 requests/day FREE, then $0.006 per request
- **Use for**: Complex analysis, deep research, task breakdown
- **Quality**: Excellent for detailed work

**Your app automatically picks the right model for each task!**

---

## 📈 Feature Comparison

| Feature | Gemini Flash | Gemini Pro |
|---------|--------------|------------|
| Voice Commands | ✅ Perfect | ❌ Overkill |
| Task Analysis | ⚠️ Basic | ✅ Excellent |
| Deep Research | ❌ Too simple | ✅ Excellent |
| Speed | ⚡ 1 sec | 🚀 2-3 sec |
| Cost (after free) | 💰 $0.0001 | 💰 $0.006 |
| Free Tier | 🎁 1M tokens/day | 🎁 50 requests/day |

---

## 🔐 Security Notes

### API Key Security
- ✅ Stored in Firebase Functions config (server-side)
- ✅ Never exposed to client
- ✅ Tied to your Firebase project
- ❌ Never commit to Git

### Rate Limiting
- ✅ Google enforces rate limits automatically
- ✅ Prevents abuse
- ✅ Free tier is plenty for personal use

---

## 🎯 Next Steps

### Today
- [x] Get Gemini API key
- [x] Configure Firebase Functions
- [x] Deploy functions
- [x] Test basic functionality

### This Week
- [ ] Integrate voice interface
- [ ] Test all AI features
- [ ] Add task analysis button
- [ ] Test on mobile device

### Next Week
- [ ] Set up CI/CD with GitHub
- [ ] Add export functionality
- [ ] Verify automated backups
- [ ] Invite family/team if desired

---

## ✅ Verification Checklist

After setup, verify these work:

- [ ] Can sign in with Google
- [ ] Tasks display correctly
- [ ] Can add/edit tasks manually
- [ ] Voice button appears and activates
- [ ] Voice commands process correctly
- [ ] AI task analysis works
- [ ] Deep research generates results
- [ ] Audio summaries play
- [ ] Automated backup runs nightly
- [ ] Works offline (PWA)

---

## 🎓 Learning Resources

### Gemini Documentation
- **API Docs**: https://ai.google.dev/docs
- **Pricing**: https://ai.google.dev/pricing
- **Models**: https://ai.google.dev/models/gemini

### Firebase Documentation
- **Functions**: https://firebase.google.com/docs/functions
- **Firestore**: https://firebase.google.com/docs/firestore
- **Hosting**: https://firebase.google.com/docs/hosting

### Community
- **Google AI Forum**: https://discuss.ai.google.dev/
- **Firebase Slack**: https://firebase.community/

---

## 🚨 Common Mistakes to Avoid

1. **❌ Committing API key to Git**
   - ✅ Use Firebase Functions config

2. **❌ Using client-side API calls**
   - ✅ Route through Cloud Functions

3. **❌ Not monitoring usage**
   - ✅ Check weekly at AI Studio

4. **❌ Worrying about costs**
   - ✅ Free tier is generous for personal use!

---

## 💡 Pro Tips

### Optimize Token Usage
```javascript
// Instead of sending full task list every time:
const recentTasks = tasks.slice(0, 10); // Top 10 only

// Summarize task context:
const context = {
  taskCount: tasks.length,
  topTasks: recentTasks.map(t => ({
    title: t.title,
    context: t.context
  }))
};
```

### Use Appropriate Models
- Quick questions → Gemini Flash
- Complex analysis → Gemini Pro
- Don't use Pro for simple tasks!

### Cache Common Queries
- Store frequently asked questions
- Return cached results instantly
- Reduces API calls

---

## 🎉 You're Ready!

Your GTD system now uses:
- ✅ Google Gemini AI (free for personal use!)
- ✅ Firebase backend (free tier)
- ✅ React PWA (works offline)
- ✅ Voice control (hands-free)
- ✅ Automated backups (peace of mind)

**Total cost: $0-5/month** (likely $0!)

Start using your AI-powered GTD system today! 🚀

---

**Questions?** Check the main documentation or ask!
