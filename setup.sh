#!/bin/bash

# GTD System Setup Script
# This script helps you set up your development environment

set -e  # Exit on error

echo "╔════════════════════════════════════════╗"
echo "║   GTD System Setup Script              ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "firebase.json" ]; then
    echo -e "${RED}❌ Error: firebase.json not found. Please run this script from your project root.${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Step 1: Checking prerequisites...${NC}"

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/${NC}"
    exit 1
else
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✓${NC} Node.js installed: $NODE_VERSION"
fi

# Check for npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
else
    NPM_VERSION=$(npm -v)
    echo -e "${GREEN}✓${NC} npm installed: $NPM_VERSION"
fi

# Check for Firebase CLI
if ! command -v firebase &> /dev/null; then
    echo -e "${YELLOW}⚠${NC}  Firebase CLI not installed"
    echo "Installing Firebase CLI globally..."
    npm install -g firebase-tools
else
    FIREBASE_VERSION=$(firebase --version)
    echo -e "${GREEN}✓${NC} Firebase CLI installed: $FIREBASE_VERSION"
fi

# Check for Git
if ! command -v git &> /dev/null; then
    echo -e "${YELLOW}⚠${NC}  Git is not installed. Version control is recommended."
    echo "Please install Git from https://git-scm.com/"
else
    GIT_VERSION=$(git --version)
    echo -e "${GREEN}✓${NC} $GIT_VERSION"
fi

echo ""
echo -e "${BLUE}📦 Step 2: Installing dependencies...${NC}"

# Install root dependencies
if [ -f "package.json" ]; then
    echo "Installing root dependencies..."
    npm install
    echo -e "${GREEN}✓${NC} Root dependencies installed"
fi

# Install PWA dependencies
if [ -d "gtd-pwa" ]; then
    echo "Installing PWA dependencies..."
    cd gtd-pwa
    npm install
    cd ..
    echo -e "${GREEN}✓${NC} PWA dependencies installed"
fi

# Install Cloud Functions dependencies
if [ -d "functions" ]; then
    echo "Installing Cloud Functions dependencies..."
    cd functions
    npm install
    cd ..
    echo -e "${GREEN}✓${NC} Functions dependencies installed"
fi

echo ""
echo -e "${BLUE}🔐 Step 3: Setting up environment variables...${NC}"

# Create .env.local for PWA if it doesn't exist
if [ ! -f "gtd-pwa/.env.local" ]; then
    if [ -f ".env.local.template" ]; then
        cp .env.local.template gtd-pwa/.env.local
        echo -e "${YELLOW}⚠${NC}  Created gtd-pwa/.env.local from template"
        echo -e "${YELLOW}➜${NC}  Please edit gtd-pwa/.env.local with your actual API keys"
    else
        echo -e "${YELLOW}⚠${NC}  .env.local.template not found. Skipping."
    fi
else
    echo -e "${GREEN}✓${NC} gtd-pwa/.env.local already exists"
fi

# Create .gitignore if it doesn't exist
if [ ! -f ".gitignore" ]; then
    echo "Creating .gitignore..."
    cat > .gitignore << 'EOF'
# Dependencies
node_modules/
/.pnp
.pnp.js

# Testing
/coverage

# Production
/build
/dist

# Environment
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Firebase
.firebase/
.firebaserc.local
serviceAccountKey.json
firebase-debug.log
firebase-debug.*.log
.runtimeconfig.json

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*

# Misc
*.local
.cache
EOF
    echo -e "${GREEN}✓${NC} .gitignore created"
else
    echo -e "${GREEN}✓${NC} .gitignore already exists"
fi

echo ""
echo -e "${BLUE}🔧 Step 4: Initializing Git repository (if needed)...${NC}"

if [ ! -d ".git" ]; then
    echo "Initializing Git repository..."
    git init
    git add .gitignore
    git commit -m "Initial commit: Add .gitignore"
    echo -e "${GREEN}✓${NC} Git repository initialized"
    echo -e "${YELLOW}➜${NC}  Next: Set up your remote repository:"
    echo "   git remote add origin <your-repo-url>"
    echo "   git push -u origin main"
else
    echo -e "${GREEN}✓${NC} Git repository already initialized"
fi

echo ""
echo -e "${BLUE}🔥 Step 5: Firebase setup...${NC}"

echo "Checking Firebase login status..."
if firebase login:list 2>&1 | grep -q "No authorized accounts"; then
    echo -e "${YELLOW}⚠${NC}  Not logged in to Firebase"
    echo "Please run: firebase login"
else
    echo -e "${GREEN}✓${NC} Logged in to Firebase"
fi

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🎯 Next Steps:"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "1️⃣  Configure environment variables:"
echo "   Edit gtd-pwa/.env.local with your Firebase config"
echo ""
echo "2️⃣  Set up Cloud Functions secret:"
echo "   firebase functions:config:set google.key=\"YOUR_GEMINI_API_KEY\""
echo "   Get key from: https://aistudio.google.com/app/apikey"
echo ""
echo "3️⃣  Test locally:"
echo "   cd gtd-pwa && npm start"
echo ""
echo "4️⃣  Deploy to Firebase:"
echo "   firebase deploy"
echo ""
echo "5️⃣  Import your MLO data:"
echo "   node import-mlo.js your-export.xml your-email@example.com"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""
echo -e "${BLUE}📚 Documentation:${NC}"
echo "   • Architecture: ./GTD-System-Architecture.md"
echo "   • Gemini Setup: ./GEMINI-SETUP-GUIDE.md"
echo "   • Quick Start: ./QUICK-START.md"
echo "   • Cost Estimates: ./COST-ESTIMATES-GEMINI.md"
echo "   • Firebase Console: https://console.firebase.google.com/project/personal-gtd-ea76d"
echo "   • Gemini API: https://aistudio.google.com/app/apikey"
echo ""
