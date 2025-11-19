// import-mlo.js - MyLifeOrganized to Firestore Import Script
const admin = require('firebase-admin');
const fs = require('fs');
const xml2js = require('xml2js');

const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin
require('dotenv').config();

let serviceAccount;
try {
  if (process.env.SERVICE_ACCOUNT_KEY_JSON) {
    serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY_JSON);
  } else {
    // Fallback for backward compatibility or local dev if file still exists
    // But per requirements we want to rely on the env var.
    // Let's try to load the file if env var is missing, but warn.
    try {
      serviceAccount = require('./serviceAccountKey.json');
      console.warn('⚠️  Warning: Using serviceAccountKey.json file. Please migrate to SERVICE_ACCOUNT_KEY_JSON environment variable.');
    } catch (e) {
      throw new Error('SERVICE_ACCOUNT_KEY_JSON environment variable is not set.');
    }
  }
} catch (error) {
  console.error('❌ Error loading service account credentials:', error.message);
  process.exit(1);
}

const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const databaseId = process.env.FIREBASE_DATABASE_ID || 'gtd-database';
const db = getFirestore(app, databaseId);

// Parse MLO XML structure
async function parseMLOXML(xmlContent) {
  const parser = new xml2js.Parser({
    explicitArray: false,
    mergeAttrs: true
  });

  const result = await parser.parseStringPromise(xmlContent);
  return result['MyLifeOrganized-xml'].TaskTree;
}

// Convert MLO effort to energy level
function effortToEnergy(effort) {
  if (!effort) return 'medium';
  const e = parseInt(effort);
  if (e <= 10) return 'low';
  if (e <= 50) return 'medium';
  return 'high';
}

// Convert MLO place to context
function placeToContext(place) {
  if (!place) return null;

  const placeStr = Array.isArray(place) ? place[0] : place;

  // Map MLO places to GTD contexts
  const mapping = {
    '!Errands': '@errands',
    '@HomeOffice': '@home',
    '@HomeComputer': '@computer',
    '@Anywhere': '@anywhere',
    '@Office': '@office',
    '@Phone': '@calls',
    '@Computer': '@computer',
    '@Home': '@home'
  };

  return mapping[placeStr] || placeStr.toLowerCase();
}

// Convert MLO estimate to minutes
function estimateToMinutes(estimateMin, estimateMax) {
  // MLO stores as fraction of day (1 day = 1.0)
  // Convert to minutes
  if (estimateMax) {
    const maxMinutes = parseFloat(estimateMax) * 24 * 60;
    return Math.round(maxMinutes);
  }
  if (estimateMin) {
    const minMinutes = parseFloat(estimateMin) * 24 * 60;
    return Math.round(minMinutes);
  }
  return null;
}

// Calculate importance/urgency score (MLO uses 0-200 scale)
function calculateImportance(importance, urgency) {
  const imp = parseInt(importance) || 100;
  const urg = parseInt(urgency) || 100;

  // Convert to 1-5 scale
  // MLO: 0-200, midpoint is 100
  // High: 150+, Medium: 75-150, Low: <75
  const impScore = imp >= 150 ? 5 : imp >= 100 ? 4 : imp >= 75 ? 3 : imp >= 50 ? 2 : 1;
  const urgScore = urg >= 150 ? 5 : urg >= 100 ? 4 : urg >= 75 ? 3 : urg >= 50 ? 2 : 1;

  return {
    importance: impScore,
    urgency: urgScore
  };
}

// Process task node recursively into a tree structure
function processTaskNode(node) {
  if (!node) return [];

  const nodes = Array.isArray(node) ? node : [node];
  const tasks = [];

  nodes.forEach(taskNode => {
    if (!taskNode.Caption) {
      if (taskNode.TaskNode) {
        tasks.push(...processTaskNode(taskNode.TaskNode));
      }
      return;
    }

    const caption = taskNode.Caption;
    const importance = calculateImportance(taskNode.Importance, taskNode.Urgency);
    const timeEstimate = estimateToMinutes(taskNode.EstimateMin, taskNode.EstimateMax);
    const energyLevel = effortToEnergy(taskNode.Effort);
    const context = taskNode.Places ? placeToContext(taskNode.Places.Place) : null;
    const isCompleted = !!taskNode.CompletionDateTime;
    const isProject = taskNode.IsProject === '-1';

    const task = {
      title: caption,
      description: taskNode.Note || '',

      // Status
      status: isCompleted ? 'done' : 'next_action',
      completedDate: isCompleted ? new Date(taskNode.CompletionDateTime) : null,

      // Priority factors
      importance: importance.importance,
      urgency: importance.urgency,
      timeEstimate: timeEstimate,
      energyLevel: energyLevel,

      // Context
      context: context,

      // Project flag
      isProject: isProject,

      // Dates
      dueDate: taskNode.DueDateTime ? new Date(taskNode.DueDateTime) : null,
      startDate: taskNode.StartDateTime ? new Date(taskNode.StartDateTime) : null,

      // MLO specific
      mloImportance: parseInt(taskNode.Importance) || 100,
      mloUrgency: parseInt(taskNode.Urgency) || 100,
      mloEffort: parseInt(taskNode.Effort) || 0,

      // Metadata
      source: 'mlo_import',

      // Focus flag
      todayFocus: importance.importance >= 5 && importance.urgency >= 5 && !isCompleted,

      // Children placeholder
      children: taskNode.TaskNode ? processTaskNode(taskNode.TaskNode) : []
    };

    tasks.push(task);
  });

  return tasks;
}

// Recursively import tasks to Firestore using batches
async function importToFirestore(tasks, userId) {
  console.log(`\n📥 Importing tasks to Firestore...\n`);

  const batches = [db.batch()];
  let currentBatchIndex = 0;
  let operationsInCurrentBatch = 0;
  let totalTasksProcessed = 0;
  const MAX_OPS_PER_BATCH = 499; // Stay safely under the 500 limit

  // Inner recursive function to process nodes and add them to batches
  async function processNodeForBatch(task, parentId = null, level = 0, path = []) {
    totalTasksProcessed++;
    const docRef = db.collection('tasks').doc();
    const newPath = [...path, task.title];

    const firestoreTask = {
      ...task,
      id: docRef.id,
      userId: userId,
      parentId: parentId,
      level: level,
      path: newPath.join(' > '),
      childCount: task.children.length,
      createdDate: admin.firestore.FieldValue.serverTimestamp(),
      modifiedDate: admin.firestore.FieldValue.serverTimestamp(),
      computedPriority: 0,
      priorityBreakdown: {}
    };

    const { children, ...taskToSave } = firestoreTask;

    // Add the set operation to the current batch
    batches[currentBatchIndex].set(docRef, taskToSave);
    operationsInCurrentBatch++;

    // If the current batch is full, create a new one
    if (operationsInCurrentBatch >= MAX_OPS_PER_BATCH) {
      batches.push(db.batch());
      currentBatchIndex++;
      operationsInCurrentBatch = 0;
    }

    // Recurse for children, passing the new docRef.id as the parentId
    if (children && children.length > 0) {
      for (const child of children) {
        await processNodeForBatch(child, docRef.id, level + 1, newPath);
      }
    }
  }

  // Start the batching process for all root-level tasks
  for (const task of tasks) {
    await processNodeForBatch(task);
  }

  // Commit all the batches concurrently
  console.log(`\n💾 Writing ${totalTasksProcessed} tasks in ${batches.length} batch(es) to Firestore...`);
  const commitPromises = batches.map(batch => batch.commit());
  await Promise.all(commitPromises);

  console.log(`\n✅ ${totalTasksProcessed} tasks imported successfully!\n`);
}

// Calculate initial priorities
async function calculatePriorities(userId) {
  console.log('🧮 Calculating priorities...\n');

  const tasksSnapshot = await db.collection('tasks')
    .where('userId', '==', userId)
    .where('status', '==', 'next_action')
    .get();

  const batch = db.batch();
  let count = 0;

  tasksSnapshot.docs.forEach(doc => {
    const task = doc.data();

    // Simple priority calculation
    const importanceScore = (task.importance || 3) * 3;
    const urgencyScore = (task.urgency || 3) * 2.5;
    const timeBonus = task.timeEstimate && task.timeEstimate <= 15 ? 3 : 0;
    const energyScore = task.energyLevel === 'low' ? 2 :
      task.energyLevel === 'medium' ? 1 : 0;

    const priority = importanceScore + urgencyScore + timeBonus + energyScore;

    batch.update(doc.ref, {
      computedPriority: priority,
      priorityBreakdown: {
        importance: importanceScore,
        urgency: urgencyScore,
        quickWin: timeBonus,
        energy: energyScore
      },
      lastPriorityUpdate: admin.firestore.FieldValue.serverTimestamp()
    });

    count++;
  });

  await batch.commit();
  console.log(`✅ Calculated priorities for ${count} tasks\n`);
}

// Generate statistics
async function generateStats(userId) {
  const tasksSnapshot = await db.collection('tasks')
    .where('userId', '==', userId)
    .get();

  const tasks = tasksSnapshot.docs.map(d => d.data());

  const stats = {
    total: tasks.length,
    active: tasks.filter(t => t.status === 'next_action').length,
    completed: tasks.filter(t => t.status === 'done').length,
    projects: tasks.filter(t => t.isProject).length,
    focused: tasks.filter(t => t.todayFocus && t.status === 'next_action').length,
    byContext: {},
    byLevel: {},
    withDueDate: tasks.filter(t => t.dueDate).length,
    avgTimeEstimate: 0
  };

  // Count by context
  tasks.forEach(t => {
    if (t.context) {
      stats.byContext[t.context] = (stats.byContext[t.context] || 0) + 1;
    }
    if (t.level !== undefined) {
      stats.byLevel[t.level] = (stats.byLevel[t.level] || 0) + 1;
    }
  });

  // Average time estimate
  const tasksWithTime = tasks.filter(t => t.timeEstimate);
  if (tasksWithTime.length > 0) {
    stats.avgTimeEstimate = Math.round(
      tasksWithTime.reduce((sum, t) => sum + t.timeEstimate, 0) / tasksWithTime.length
    );
  }

  return stats;
}

// Main import function
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('\n❌ Usage: node import-mlo.js <xml-file> <user-email>\n');
    console.log('Example: node import-mlo.js mlo-export.xml brian@example.com\n');
    process.exit(1);
  }

  const xmlFile = args[0];
  const userEmail = args[1];

  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   MLO to Firestore Import Script      ║');
  console.log('╚════════════════════════════════════════╝\n');

  try {
    // Read XML file
    console.log(`📄 Reading ${xmlFile}...`);
    const xmlContent = fs.readFileSync(xmlFile, 'utf-8');

    // Parse XML
    console.log('🔍 Parsing MLO XML structure...');
    const taskTree = await parseMLOXML(xmlContent);

    // Process tasks
    console.log('🔄 Processing tasks and hierarchies...');
    const tasks = processTaskNode(taskTree.TaskNode);

    console.log(`\n📊 Found ${tasks.length} tasks:`);
    console.log(`   - Active: ${tasks.filter(t => t.status === 'next_action').length}`);
    console.log(`   - Completed: ${tasks.filter(t => t.status === 'done').length}`);
    console.log(`   - Projects: ${tasks.filter(t => t.isProject).length}`);
    console.log(`   - Max depth: ${Math.max(...tasks.map(t => t.level))}`);
    console.log(`   - Initial focus items: ${tasks.filter(t => t.todayFocus).length}`);

    // Get user UID from Firebase Auth
    console.log(`\n👤 Getting user UID for: ${userEmail}`);
    let userId;
    try {
      const userRecord = await admin.auth().getUserByEmail(userEmail);
      userId = userRecord.uid;
      console.log(`   Found user UID: ${userId}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.error(`\n❌ Error: The user with email "${userEmail}" does not exist in Firebase Authentication.`);
        console.error('   Please create the user in the Firebase Console before running the import.');
        process.exit(1);
      }
      throw error;
    }

    // Import to Firestore
    await importToFirestore(tasks, userId);

    // Calculate priorities
    await calculatePriorities(userId);

    // Generate statistics
    console.log('📈 Generating statistics...\n');
    const stats = await generateStats(userId);

    console.log('╔════════════════════════════════════════╗');
    console.log('║          Import Complete! ✅           ║');
    console.log('╚════════════════════════════════════════╝\n');

    console.log('📊 Import Statistics:');
    console.log(`   Total tasks imported: ${stats.total}`);
    console.log(`   Active tasks: ${stats.active}`);
    console.log(`   Completed tasks: ${stats.completed}`);
    console.log(`   Projects: ${stats.projects}`);
    console.log(`   Today's focus: ${stats.focused}`);
    console.log(`   Tasks with due dates: ${stats.withDueDate}`);
    console.log(`   Average time estimate: ${stats.avgTimeEstimate} minutes`);

    console.log('\n📍 Contexts:');
    Object.entries(stats.byContext).forEach(([ctx, count]) => {
      console.log(`   ${ctx}: ${count} tasks`);
    });

    console.log('\n🌳 Hierarchy depth:');
    Object.entries(stats.byLevel).forEach(([level, count]) => {
      console.log(`   Level ${level}: ${count} tasks`);
    });

    console.log('\n✨ Next steps:');
    console.log('   1. Open your app: npm start');
    console.log('   2. Sign in with: ' + userEmail);
    console.log('   3. Review imported tasks');
    console.log('   4. Check "Today\'s Focus" for high priority items\n');

  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  process.exit(0);
}

main();
