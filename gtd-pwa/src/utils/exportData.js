// gtd-pwa/src/utils/exportData.js
// Export utilities for GTD data
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Build hierarchical task tree from flat list
 */
const buildTaskTree = (tasks) => {
  const taskMap = new Map();
  const tree = [];

  tasks.forEach(task => {
    taskMap.set(task.id, { ...task, children: [] });
  });

  tasks.forEach(task => {
    const currentTask = taskMap.get(task.id);
    if (task.parentId) {
      const parentTask = taskMap.get(task.parentId);
      if (parentTask) {
        parentTask.children.push(currentTask);
      } else {
        tree.push(currentTask);
      }
    } else {
      tree.push(currentTask);
    }
  });

  return tree;
};

/**
 * Export tasks as JSON
 */
export const exportToJSON = async (userId) => {
  try {
    const tasksRef = collection(db, 'tasks');
    const q = query(tasksRef, where('userId', '==', userId));
    const snapshot = await getDocs(q);
    
    const tasks = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Convert Firestore timestamps to ISO strings
        createdDate: data.createdDate?.toDate().toISOString(),
        modifiedDate: data.modifiedDate?.toDate().toISOString(),
        completedDate: data.completedDate?.toDate().toISOString(),
        dueDate: data.dueDate?.toDate().toISOString(),
        startDate: data.startDate?.toDate().toISOString()
      };
    });

    const exportData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      userId: userId,
      taskCount: tasks.length,
      tasks: tasks
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gtd-export-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    
    return { success: true, count: tasks.length };
  } catch (error) {
    console.error('Error exporting to JSON:', error);
    throw error;
  }
};

/**
 * Export tasks as CSV
 */
export const exportToCSV = async (userId) => {
  try {
    const tasksRef = collection(db, 'tasks');
    const q = query(tasksRef, where('userId', '==', userId));
    const snapshot = await getDocs(q);
    
    const tasks = snapshot.docs.map(doc => doc.data());
    
    // CSV headers
    const headers = [
      'ID',
      'Title',
      'Description',
      'Status',
      'Context',
      'Importance',
      'Urgency',
      'Time Estimate',
      'Energy Level',
      'Due Date',
      'Start Date',
      'Completed Date',
      'Parent ID',
      'Is Project',
      'Today Focus',
      'Level',
      'Child Count',
      'Source',
      'Created Date',
      'Modified Date'
    ];
    
    // Convert tasks to CSV rows
    const rows = tasks.map(task => [
      task.id || '',
      task.title || '',
      (task.description || '').replace(/"/g, '""'), // Escape quotes
      task.status || '',
      task.context || '',
      task.importance || '',
      task.urgency || '',
      task.timeEstimate || '',
      task.energyLevel || '',
      task.dueDate ? task.dueDate.toDate().toISOString() : '',
      task.startDate ? task.startDate.toDate().toISOString() : '',
      task.completedDate ? task.completedDate.toDate().toISOString() : '',
      task.parentId || '',
      task.isProject ? 'Yes' : 'No',
      task.todayFocus ? 'Yes' : 'No',
      task.level || 0,
      task.childCount || 0,
      task.source || '',
      task.createdDate ? task.createdDate.toDate().toISOString() : '',
      task.modifiedDate ? task.modifiedDate.toDate().toISOString() : ''
    ]);

    // Build CSV content
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gtd-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    URL.revokeObjectURL(url);
    
    return { success: true, count: tasks.length };
  } catch (error) {
    console.error('Error exporting to CSV:', error);
    throw error;
  }
};

/**
 * Export tasks as MLO XML (for re-import to MyLifeOrganized)
 */
export const exportToMLO = async (userId) => {
  try {
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
    link.download = `gtd-export-mlo-${new Date().toISOString().split('T')[0]}.xml`;
    link.click();
    
    URL.revokeObjectURL(url);
    
    return { success: true, count: tasks.length };
  } catch (error) {
    console.error('Error exporting to MLO:', error);
    throw error;
  }
};

/**
 * Generate MyLifeOrganized XML format
 */
function generateMLOXML(taskTree) {
  const escapeXML = (str) => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const importanceToMLO = (importance) => {
    // Convert 1-5 scale to MLO 0-200 scale
    return Math.round((importance - 1) * 50);
  };

  const urgencyToMLO = (urgency) => {
    // Convert 1-5 scale to MLO 0-200 scale
    return Math.round((urgency - 1) * 50);
  };

  const energyToEffort = (energyLevel) => {
    const mapping = {
      'low': 10,
      'medium': 50,
      'high': 90
    };
    return mapping[energyLevel] || 50;
  };

  const contextToPlace = (context) => {
    if (!context) return null;
    const mapping = {
      '@errands': '!Errands',
      '@home': '@Home',
      '@office': '@Office',
      '@calls': '@Phone',
      '@computer': '@Computer',
      '@anywhere': '@Anywhere'
    };
    return mapping[context] || context;
  };

  const minutesToEstimate = (minutes) => {
    if (!minutes) return null;
    // MLO stores as fraction of day (1 day = 1.0)
    return (minutes / (24 * 60)).toFixed(6);
  };

  const generateTaskNode = (task, level = 0) => {
    const indent = '  '.repeat(level);
    const place = contextToPlace(task.context);
    const estimate = minutesToEstimate(task.timeEstimate);
    
    let xml = `${indent}<TaskNode>\n`;
    xml += `${indent}  <Caption>${escapeXML(task.title)}</Caption>\n`;
    
    if (task.description) {
      xml += `${indent}  <Note>${escapeXML(task.description)}</Note>\n`;
    }
    
    xml += `${indent}  <Importance>${importanceToMLO(task.importance || 3)}</Importance>\n`;
    xml += `${indent}  <Urgency>${urgencyToMLO(task.urgency || 3)}</Urgency>\n`;
    xml += `${indent}  <Effort>${energyToEffort(task.energyLevel)}</Effort>\n`;
    
    if (place) {
      xml += `${indent}  <Places>\n`;
      xml += `${indent}    <Place>${escapeXML(place)}</Place>\n`;
      xml += `${indent}  </Places>\n`;
    }
    
    if (estimate) {
      xml += `${indent}  <EstimateMax>${estimate}</EstimateMax>\n`;
    }
    
    if (task.dueDate) {
      const dueDate = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
      xml += `${indent}  <DueDateTime>${dueDate.toISOString()}</DueDateTime>\n`;
    }
    
    if (task.startDate) {
      const startDate = task.startDate.toDate ? task.startDate.toDate() : new Date(task.startDate);
      xml += `${indent}  <StartDateTime>${startDate.toISOString()}</StartDateTime>\n`;
    }
    
    if (task.status === 'done' && task.completedDate) {
      const completedDate = task.completedDate.toDate ? 
        task.completedDate.toDate() : new Date(task.completedDate);
      xml += `${indent}  <CompletionDateTime>${completedDate.toISOString()}</CompletionDateTime>\n`;
    }
    
    if (task.isProject) {
      xml += `${indent}  <IsProject>-1</IsProject>\n`;
    }
    
    // Recursively add children
    if (task.children && task.children.length > 0) {
      for (const child of task.children) {
        xml += generateTaskNode(child, level + 1);
      }
    }
    
    xml += `${indent}</TaskNode>\n`;
    return xml;
  };

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<MyLifeOrganized-xml>\n';
  xml += '  <TaskTree>\n';
  
  for (const task of taskTree) {
    xml += generateTaskNode(task, 2);
  }
  
  xml += '  </TaskTree>\n';
  xml += '</MyLifeOrganized-xml>';
  
  return xml;
}

/**
 * Export all data (tasks + settings)
 */
export const exportAllData = async (userId) => {
  try {
    // Get tasks
    const tasksRef = collection(db, 'tasks');
    const tasksQuery = query(tasksRef, where('userId', '==', userId));
    const tasksSnapshot = await getDocs(tasksQuery);
    
    const tasks = tasksSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdDate: data.createdDate?.toDate().toISOString(),
        modifiedDate: data.modifiedDate?.toDate().toISOString(),
        completedDate: data.completedDate?.toDate().toISOString(),
        dueDate: data.dueDate?.toDate().toISOString(),
        startDate: data.startDate?.toDate().toISOString()
      };
    });

    // Get user settings if they exist
    let settings = {};
    try {
      const settingsRef = collection(db, 'settings');
      const settingsQuery = query(settingsRef, where('userId', '==', userId));
      const settingsSnapshot = await getDocs(settingsQuery);
      if (!settingsSnapshot.empty) {
        settings = settingsSnapshot.docs[0].data();
      }
    } catch (err) {
      console.log('No settings found, continuing...');
    }

    const exportData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      userId: userId,
      tasks: tasks,
      settings: settings,
      statistics: {
        totalTasks: tasks.length,
        activeTasks: tasks.filter(t => t.status !== 'done').length,
        completedTasks: tasks.filter(t => t.status === 'done').length,
        projects: tasks.filter(t => t.isProject).length
      }
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gtd-full-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    
    return { 
      success: true, 
      taskCount: tasks.length,
      hasSettings: Object.keys(settings).length > 0
    };
  } catch (error) {
    console.error('Error exporting all data:', error);
    throw error;
  }
};

/**
 * Get export statistics without actually exporting
 */
export const getExportStats = async (userId) => {
  try {
    const tasksRef = collection(db, 'tasks');
    const q = query(tasksRef, where('userId', '==', userId));
    const snapshot = await getDocs(q);
    
    const tasks = snapshot.docs.map(doc => doc.data());
    
    const stats = {
      total: tasks.length,
      active: tasks.filter(t => t.status !== 'done').length,
      completed: tasks.filter(t => t.status === 'done').length,
      projects: tasks.filter(t => t.isProject).length,
      contexts: Array.from(new Set(tasks.map(t => t.context).filter(Boolean))),
      avgImportance: (tasks.reduce((sum, t) => sum + (t.importance || 3), 0) / tasks.length).toFixed(1),
      avgUrgency: (tasks.reduce((sum, t) => sum + (t.urgency || 3), 0) / tasks.length).toFixed(1),
      withDueDate: tasks.filter(t => t.dueDate).length,
      withTimeEstimate: tasks.filter(t => t.timeEstimate).length
    };
    
    return stats;
  } catch (error) {
    console.error('Error getting export stats:', error);
    throw error;
  }
};

export default {
  exportToJSON,
  exportToCSV,
  exportToMLO,
  exportAllData,
  getExportStats
};
