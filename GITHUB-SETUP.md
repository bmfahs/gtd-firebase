# GitHub Setup Guide for CI/CD

## Overview
This guide walks you through setting up your GitHub repository with automated testing and deployment via GitHub Actions.

## Step 1: Create GitHub Repository

### Option A: GitHub CLI (Recommended)
```bash
# Install GitHub CLI if not already installed
# macOS: brew install gh
# Windows: winget install --id GitHub.cli
# Linux: See https://github.com/cli/cli/blob/trunk/docs/install_linux.md

# Login to GitHub
gh auth login

# Create repository
gh repo create brian.fahs-gtd --private --source=. --remote=origin --push
```

### Option B: GitHub Web Interface
1. Go to https://github.com/new
2. Repository name: `brian.fahs-gtd` (or your preferred name)
3. Set as **Private**
4. Don't initialize with README (you already have one)
5. Click "Create repository"
6. Follow the commands to push existing code:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/brian.fahs-gtd.git
   git branch -M main
   git add .
   git commit -m "Initial commit: GTD System with Firebase"
   git push -u origin main
   ```

## Step 2: Set Up GitHub Secrets

### Required Secrets
Navigate to your repository settings: `Settings → Secrets and variables → Actions`

Click "New repository secret" for each of these:

#### 1. FIREBASE_TOKEN
```bash
# Generate Firebase CI token
firebase login:ci

# Copy the token that's printed
# Add it as FIREBASE_TOKEN secret in GitHub
```

#### 2. FIREBASE_SERVICE_ACCOUNT
```bash
# Download service account from Firebase Console:
# 1. Go to https://console.firebase.google.com/project/personal-gtd-ea76d/settings/serviceaccounts
# 2. Click "Generate new private key"
# 3. Save the JSON file
# 4. Copy the ENTIRE contents of the JSON file
# 5. Paste as FIREBASE_SERVICE_ACCOUNT secret in GitHub
```

#### 3. Firebase Config Secrets
Add each of these from your Firebase project:
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN` 
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`

To find these values:
1. Go to Firebase Console → Project Settings
2. Scroll to "Your apps" section
3. Click on your web app
4. Copy each value

Example values (yours will be different):
```
FIREBASE_API_KEY: AIzaSyAnVPp7U4LhvFrKxAyKVfjXEN-_Q0NXaEo
FIREBASE_AUTH_DOMAIN: personal-gtd-ea76d.firebaseapp.com
FIREBASE_PROJECT_ID: personal-gtd-ea76d
FIREBASE_STORAGE_BUCKET: personal-gtd-ea76d.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID: 912329138271
FIREBASE_APP_ID: 1:912329138271:web:62fa2363334bce1d9bfbea
```

## Step 3: Configure GitHub Environments

### Create Staging Environment
1. Go to `Settings → Environments`
2. Click "New environment"
3. Name: `staging`
4. Add protection rules (optional):
   - Required reviewers: yourself
   - Wait timer: 0 minutes

### Create Production Environment
1. Click "New environment"
2. Name: `production`
3. Add protection rules (recommended):
   - Required reviewers: yourself
   - Deployment branches: Only `main` branch

## Step 4: Enable GitHub Actions

1. Go to `Actions` tab in your repository
2. If prompted, click "I understand my workflows, go ahead and enable them"
3. The workflow file is already in `.github/workflows/deploy.yml`

## Step 5: Test the Workflow

### Automatic Trigger
Push a commit to test:
```bash
git add .
git commit -m "Test CI/CD pipeline"
git push
```

Watch the workflow run:
1. Go to `Actions` tab
2. Click on the latest workflow run
3. Monitor each job (test, build, deploy)

### Manual Trigger
You can also trigger deployments manually:
1. Go to `Actions` tab
2. Click "Deploy GTD System to Firebase"
3. Click "Run workflow"
4. Select branch (usually `main`)
5. Click "Run workflow"

## Step 6: Set Up Branch Protection (Optional but Recommended)

Protect your main branch:
1. Go to `Settings → Branches`
2. Click "Add rule"
3. Branch name pattern: `main`
4. Enable these rules:
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass before merging
   - Select: `Run Tests`, `Build PWA`
   - ✅ Require branches to be up to date before merging
5. Click "Create"

## Step 7: Workflow Details

### What Happens on Each Push

#### Pull Request → `main`:
1. **Test Job**: Runs all tests
2. **Build Job**: Builds the PWA
3. **Deploy Staging**: Creates Firebase preview
4. **Comment**: Adds preview URL to PR

#### Push to `main`:
1. **Test Job**: Runs all tests
2. **Build Job**: Builds the PWA
3. **Deploy Production**: 
   - Deploys to Firebase Hosting
   - Deploys Cloud Functions
   - Updates Firestore rules
   - Updates Storage rules
4. **Backup**: Triggers post-deployment backup

### Deployment URLs
- **Production**: https://personal-gtd-ea76d.web.app
- **Preview**: Temporary URL generated for each PR

## Step 8: Local Development Workflow

### Working on Features
```bash
# Create feature branch
git checkout -b feature/voice-improvements

# Make changes
# ...

# Commit
git add .
git commit -m "Improve voice command recognition"

# Push
git push -u origin feature/voice-improvements

# Create PR on GitHub
gh pr create --title "Improve voice commands" --body "Description..."
```

### Review & Deploy
1. Wait for CI checks to pass
2. Review the preview deployment
3. If satisfied, merge the PR
4. Production deployment happens automatically

## Step 9: Rollback Strategy

If a deployment causes issues:

### Option 1: Quick Rollback (Hosting Only)
```bash
# List recent hosting deployments
firebase hosting:channel:list --project personal-gtd-ea76d

# Rollback to previous version
firebase hosting:rollback --project personal-gtd-ea76d
```

### Option 2: Revert Commit
```bash
# Find the commit to revert
git log --oneline

# Revert the problematic commit
git revert <commit-hash>

# Push (triggers new deployment)
git push
```

### Option 3: Redeploy Previous Version
```bash
# Checkout previous commit
git checkout <previous-commit-hash>

# Deploy manually
firebase deploy --project personal-gtd-ea76d

# Return to main
git checkout main
```

## Step 10: Monitoring Deployments

### GitHub Actions Logs
- Go to `Actions` tab
- Click on workflow run
- View logs for each job

### Firebase Console
- Hosting: https://console.firebase.google.com/project/personal-gtd-ea76d/hosting
- Functions: https://console.firebase.google.com/project/personal-gtd-ea76d/functions

### Real-time Function Logs
```bash
firebase functions:log --project personal-gtd-ea76d --follow
```

## Troubleshooting

### Workflow Failing on Tests
**Issue**: Tests fail in CI but pass locally
**Solution**:
```bash
# Run tests in CI mode locally
cd gtd-pwa
CI=true npm test
```

### Workflow Failing on Build
**Issue**: Build fails due to missing env variables
**Solution**: Verify all secrets are set in GitHub

### Firebase Deployment Fails
**Issue**: "Permission denied" or "Invalid credentials"
**Solution**:
1. Regenerate FIREBASE_TOKEN: `firebase login:ci`
2. Update secret in GitHub
3. Re-run workflow

### Service Account Issues
**Issue**: "Service account not found"
**Solution**:
1. Download fresh service account key
2. Copy ENTIRE JSON content
3. Update FIREBASE_SERVICE_ACCOUNT secret
4. Ensure no extra spaces or line breaks

## Advanced Configuration

### Custom Deployment Conditions
Edit `.github/workflows/deploy.yml`:

```yaml
# Only deploy on specific paths
on:
  push:
    branches: [ main ]
    paths:
      - 'gtd-pwa/**'
      - 'functions/**'
      - '.github/workflows/**'
```

### Slack Notifications
Add Slack webhook secret and update workflow:

```yaml
- name: Notify Slack
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
  if: always()
```

### Scheduled Deployments
Add scheduled workflow:

```yaml
on:
  schedule:
    - cron: '0 2 * * 1'  # Every Monday at 2 AM
```

## Security Best Practices

1. **Never commit secrets** - Always use GitHub Secrets
2. **Rotate tokens regularly** - Update FIREBASE_TOKEN quarterly
3. **Review access logs** - Check Firebase Console for unusual activity
4. **Enable 2FA** - For both GitHub and Firebase accounts
5. **Limit service account permissions** - Use least privilege principle

## Cost Considerations

GitHub Actions free tier:
- ✅ Unlimited minutes for public repos
- ✅ 2,000 minutes/month for private repos
- ✅ Current workflow uses ~5-10 minutes per run

To optimize:
- Cache dependencies (already configured)
- Skip jobs on certain paths
- Use self-hosted runners for heavy workloads

## Next Steps

1. ✅ Push code to GitHub
2. ✅ Configure secrets
3. ✅ Enable workflows
4. ✅ Test with a PR
5. ✅ Set up branch protection
6. 📝 Document team processes
7. 📊 Set up monitoring/alerts
8. 🔄 Establish release schedule

## Useful Commands

```bash
# Check workflow status
gh workflow view "Deploy GTD System to Firebase"

# List recent runs
gh run list

# View run details
gh run view <run-id>

# Re-run failed workflow
gh run rerun <run-id>

# Cancel running workflow
gh run cancel <run-id>

# Download workflow logs
gh run download <run-id>
```

## Resources

- **GitHub Actions Docs**: https://docs.github.com/en/actions
- **Firebase CI/CD**: https://firebase.google.com/docs/hosting/github-integration
- **gh CLI**: https://cli.github.com/manual/

---

**Your CI/CD pipeline is now set up! Every push to main automatically deploys your GTD system.** 🚀
