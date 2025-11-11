import React, { useState } from 'react';
import { db } from './firebase';
import { doc, updateDoc, addDoc, collection, serverTimestamp, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { CheckCircle, Circle, Plus, Edit2, Trash2, GripVertical, ChevronRight, ChevronDown, Inbox, ListTodo, FolderTree, Clock, Mic } from 'lucide-react';
import TaskDetailEditor from './EnhancedComponents';
import VoiceInterface from './components/VoiceInterface';

// Interactive Task Item Component
const InteractiveTaskItem = ({ task, userId, onUpdate, level = 0, allContexts, allTasks, showHierarchy = true }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(task.title);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showAddChild, setShowAddChild] = useState(false);
  const [newChildTitle, setNewChildTitle] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const [isDetailEditorOpen, setIsDetailEditorOpen] = useState(false);

  const hasChildren = task.children && task.children.length > 0;
  const isCompleted = task.status === 'done';

  // Toggle completion
  const handleToggleComplete = async (e) => {
    e.stopPropagation();
    try {
      const taskRef = doc(db, 'tasks', task.id);
      const newStatus = isCompleted ? 'next_action' : 'done';
      const updates = {
        status: newStatus,
        completedDate: newStatus === 'done' ? new Date() : null,
        modifiedDate: serverTimestamp()
      };
      await updateDoc(taskRef, updates);
      onUpdate?.();
    } catch (error) {
      console.error('Error toggling completion:', error);
      alert('Failed to update task');
    }
  };

  // Save edited title (for inline editing)
  const handleSaveTitle = async () => {
    if (editedTitle.trim() === '') {
      alert('Task title cannot be empty');
      return;
    }
    
    try {
      const taskRef = doc(db, 'tasks', task.id);
      await updateDoc(taskRef, {
        title: editedTitle.trim(),
        modifiedDate: serverTimestamp()
      });
      setIsEditing(false);
      onUpdate?.();
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task');
    }
  };

  // Save from detail editor
  const handleSaveFromEditor = async (updates) => {
    try {
      const taskRef = doc(db, 'tasks', task.id);
      await updateDoc(taskRef, updates);
      setIsDetailEditorOpen(false);
      onUpdate?.();
    } catch (error) {
      console.error('Error updating task from editor:', error);
      alert('Failed to save changes');
    }
  };

  // Add child task
  const handleAddChild = async () => {
    if (newChildTitle.trim() === '') {
      alert('Task title cannot be empty');
      return;
    }

    try {
      const newTask = {
        title: newChildTitle.trim(),
        userId: userId,
        parentId: task.id,
        level: (task.level || 0) + 1,
        status: 'next_action',
        importance: 3,
        urgency: 3,
        source: 'manual',
        createdDate: serverTimestamp(),
        modifiedDate: serverTimestamp(),
        computedPriority: 0,
        childCount: 0
      };

      await addDoc(collection(db, 'tasks'), newTask);
      
      // Update parent's child count
      const parentRef = doc(db, 'tasks', task.id);
      await updateDoc(parentRef, {
        childCount: (task.childCount || 0) + 1,
        modifiedDate: serverTimestamp()
      });

      setNewChildTitle('');
      setShowAddChild(false);
      onUpdate?.();
    } catch (error) {
      console.error('Error adding child task:', error);
      alert('Failed to add child task');
    }
  };

  // Delete task
  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${task.title}"?${hasChildren ? ' This will also delete all subtasks.' : ''}`)) {
      return;
    }

    try {
      // Delete all children recursively
      const deleteRecursive = async (taskToDelete) => {
        if (taskToDelete.children) {
          for (const child of taskToDelete.children) {
            await deleteRecursive(child);
          }
        }
        await deleteDoc(doc(db, 'tasks', taskToDelete.id));
      };

      await deleteRecursive(task);
      
      // Update parent's child count if this task has a parent
      if (task.parentId) {
        const parentRef = doc(db, 'tasks', task.parentId);
        await updateDoc(parentRef, {
          childCount: Math.max(0, (task.childCount || 1) - 1),
          modifiedDate: serverTimestamp()
        });
      }

      onUpdate?.();
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task');
    }
  };

  // Format date for display
  const formatDate = (date) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    const now = new Date();
    const diffTime = now - d;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <>
      <div 
        className="task-item-container"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ marginLeft: showHierarchy ? `${level * 24}px` : '0px' }}
      >
        <div className={`task-item ${isCompleted ? 'completed' : ''}`}>
          {/* Drag Handle */}
          <div className="drag-handle" style={{ opacity: isHovered ? 1 : 0.3 }}>
            <GripVertical size={16} />
          </div>

          {/* Collapse/Expand Toggle */}
          {showHierarchy && hasChildren && (
            <button
              className="collapse-toggle"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
          {showHierarchy && !hasChildren && <div style={{ width: '16px' }} />}

          {/* Completion Checkbox */}
          <button
            className="completion-checkbox"
            onClick={handleToggleComplete}
            title={isCompleted ? 'Mark incomplete' : 'Mark complete'}
          >
            {isCompleted ? (
              <CheckCircle size={20} className="text-green-600" />
            ) : (
              <Circle size={20} className="text-gray-400" />
            )}
          </button>

          {/* Task Title (Editable) */}
          {isEditing ? (
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleSaveTitle();
                if (e.key === 'Escape') {
                  setEditedTitle(task.title);
                  setIsEditing(false);
                }
              }}
              autoFocus
              className="task-title-input"
            />
          ) : (
            <span
              className={`task-title ${isCompleted ? 'line-through' : ''}`}
              onClick={() => setIsDetailEditorOpen(true)} // Open detail editor on single click
              onDoubleClick={() => setIsEditing(true)} // Keep inline editing on double click
            >
              {task.title}
            </span>
          )}

          {/* Task Metadata */}
          <div className="task-metadata" style={{ opacity: isHovered ? 1 : 0.5 }}>
            {task.context && (
              <span className="task-context">{task.context}</span>
            )}
            {task.timeEstimate && (
              <span className="task-time">{task.timeEstimate}m</span>
            )}
            {hasChildren && showHierarchy && (
              <span className="task-children">{task.children.length} subtasks</span>
            )}
            {task.modifiedDate && (
              <span className="task-date">{formatDate(task.modifiedDate)}</span>
            )}
          </div>

          {/* Action Buttons */}
          {isHovered && !isEditing && (
            <div className="task-actions">
              <button
                onClick={() => setIsDetailEditorOpen(true)}
                className="action-btn"
                title="Edit task details"
              >
                <Edit2 size={14} />
              </button>
              {showHierarchy && (
                <button
                  onClick={() => setShowAddChild(!showAddChild)}
                  className="action-btn"
                  title="Add subtask"
                >
                  <Plus size={14} />
                </button>
              )}
              <button
                onClick={handleDelete}
                className="action-btn delete-btn"
                title="Delete task"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Add Child Input */}
        {showAddChild && showHierarchy && (
          <div className="add-child-container" style={{ marginLeft: '40px', marginTop: '8px' }}>
            <input
              type="text"
              value={newChildTitle}
              onChange={(e) => setNewChildTitle(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleAddChild();
                if (e.key === 'Escape') {
                  setNewChildTitle('');
                  setShowAddChild(false);
                }
              }}
              placeholder="New subtask..."
              autoFocus
              className="add-child-input"
            />
            <button onClick={handleAddChild} className="add-child-btn">Add</button>
            <button onClick={() => setShowAddChild(false)} className="cancel-btn">Cancel</button>
          </div>
        )}

        {/* Render Children (if not collapsed and showing hierarchy) */}
        {showHierarchy && hasChildren && !isCollapsed && (
          <div className="task-children-container">
            {task.children.map(child => (
              <InteractiveTaskItem
                key={child.id}
                task={child}
                userId={userId}
                onUpdate={onUpdate}
                level={level + 1}
                allContexts={allContexts}
                allTasks={allTasks}
                showHierarchy={showHierarchy}
              />
            ))}
          </div>
        )}
      </div>
      {isDetailEditorOpen && (
        <TaskDetailEditor
          task={task}
          onClose={() => setIsDetailEditorOpen(false)}
          onSave={handleSaveFromEditor}
          allContexts={allContexts}
          allTasks={allTasks}
        />
      )}
    </>
  );
};

// Quick Add Task Component
const QuickAddTask = ({ userId, onAdd, parentId = null, level = 0, allContexts }) => {
  const [title, setTitle] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [context, setContext] = useState('');
  const [timeEstimate, setTimeEstimate] = useState('');

  const handleAdd = async () => {
    if (title.trim() === '') return;

    try {
      const newTask = {
        title: title.trim(),
        userId: userId,
        parentId: parentId,
        level: level,
        status: 'next_action',
        importance: 3,
        urgency: 3,
        context: context || null,
        timeEstimate: timeEstimate ? parseInt(timeEstimate) : null,
        source: 'manual',
        createdDate: serverTimestamp(),
        modifiedDate: serverTimestamp(),
        computedPriority: 0,
        childCount: 0
      };

      await addDoc(collection(db, 'tasks'), newTask);
      
      // Reset form
      setTitle('');
      setContext('');
      setTimeEstimate('');
      setIsExpanded(false);
      
      onAdd?.();
    } catch (error) {
      console.error('Error adding task:', error);
      alert('Failed to add task');
    }
  };

  return (
    <div className="quick-add-container" style={{ marginLeft: `${level * 24}px` }}>
      <div className="quick-add-main">
        <Plus size={20} className="text-blue-600" />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => setIsExpanded(true)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !isExpanded) handleAdd();
            if (e.key === 'Escape') {
              setTitle('');
              setIsExpanded(false);
            }
          }}
          placeholder="Add new task..."
          className="quick-add-input"
        />
      </div>

      {isExpanded && (
        <div className="quick-add-details">
          <input
            type="text"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Context (e.g., @home)"
            className="detail-input"
            list="context-list"
          />
          <datalist id="context-list">
            {allContexts.map(ctx => (
              <option key={ctx} value={ctx} />
            ))}
          </datalist>
          <input
            type="number"
            value={timeEstimate}
            onChange={(e) => setTimeEstimate(e.target.value)}
            placeholder="Time (minutes)"
            className="detail-input small"
          />
          <button onClick={handleAdd} className="add-btn">Add Task</button>
          <button 
            onClick={() => {
              setTitle('');
              setContext('');
              setTimeEstimate('');
              setIsExpanded(false);
            }} 
            className="cancel-btn"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

// Main App Component with Interactive Features
const InteractiveGTDApp = ({ user, tasks, onUpdate }) => {
  const [currentView, setCurrentView] = useState('inbox'); // inbox, todo, alltasks, recent
  const [filter, setFilter] = useState('all'); // all, active, completed
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContext, setSelectedContext] = useState(null);
  const [showVoiceInterface, setShowVoiceInterface] = useState(false); // New state

  // Extract unique contexts from tasks
  const getUniqueContexts = (taskList) => {
    const contexts = new Set();
    const extractContexts = (tasks) => {
      tasks.forEach(task => {
        if (task.context) contexts.add(task.context);
        if (task.children) extractContexts(task.children);
      });
    };
    extractContexts(taskList);
    return Array.from(contexts).sort();
  };

  const allContexts = getUniqueContexts(tasks);

  // Flatten all tasks recursively
  const flattenTasks = (taskList) => {
    const flat = [];
    const flatten = (tasks) => {
      tasks.forEach(task => {
        flat.push(task);
        if (task.children && task.children.length > 0) {
          flatten(task.children);
        }
      });
    };
    flatten(taskList);
    return flat;
  };

  // Get tasks for different views
  const getViewTasks = () => {
    switch (currentView) {
      case 'inbox':
        const inboxTask = tasks.find(t => t.title === '<Inbox>' && !t.parentId);
        return inboxTask ? inboxTask.children.filter(child => child.status !== 'done') : [];
      
      case 'todo':
        // Flatten all tasks, exclude projects, incomplete only, sort by importance
        const allFlat = flattenTasks(tasks);
        return allFlat
          .filter(t => !t.isProject && t.status !== 'done')
          .sort((a, b) => {
            // Sort by computed priority (or importance + urgency)
            const priorityA = a.computedPriority || ((a.importance || 3) * 3 + (a.urgency || 3) * 2.5);
            const priorityB = b.computedPriority || ((b.importance || 3) * 3 + (b.urgency || 3) * 2.5);
            return priorityB - priorityA;
          });
      
      case 'recent':
        // All tasks sorted by modified date
        const allFlatWithDates = flattenTasks(tasks);
        return allFlatWithDates
          .filter(t => t.modifiedDate)
          .sort((a, b) => {
            const dateA = a.modifiedDate.toDate ? a.modifiedDate.toDate() : new Date(a.modifiedDate);
            const dateB = b.modifiedDate.toDate ? b.modifiedDate.toDate() : new Date(b.modifiedDate);
            return dateB - dateA;
          })
          .slice(0, 50); // Limit to 50 most recent
      
      case 'alltasks':
      default:
        // Default hierarchical view of incomplete tasks
        return tasks;
    }
  };

  // Filter tasks
  const filterTasks = (taskList) => {
    // For flat views, apply filters directly
    if (currentView === 'todo' || currentView === 'recent') {
      return taskList.filter(task => {
        const matchesSearch = !searchTerm || 
          (task.title || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesContext = !selectedContext || 
          task.context === selectedContext;
        
        const matchesStatus = filter === 'all' ||
          (filter === 'active' && task.status !== 'done') ||
          (filter === 'completed' && task.status === 'done');
        
        return matchesSearch && matchesContext && matchesStatus;
      });
    }

    // For hierarchical views
    return taskList
      .map(task => {
        // Filter children recursively
        const filteredChildren = task.children ? filterTasks(task.children) : [];
        
        // Check if task matches filters
        const matchesSearch = !searchTerm || 
          (task.title || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesContext = !selectedContext || 
          task.context === selectedContext;
        
        const matchesStatus = filter === 'all' ||
          (filter === 'active' && task.status !== 'done') ||
          (filter === 'completed' && task.status === 'done');
        
        if (matchesSearch && matchesContext && matchesStatus) {
          return { ...task, children: filteredChildren };
        } else if (filteredChildren.length > 0) {
          // Include parent if children match
          return { ...task, children: filteredChildren };
        }
        
        return null;
      })
      .filter(task => task !== null);
  };

  const viewTasks = getViewTasks();
  const filteredTasks = filterTasks(viewTasks);

  // Determine if we should show hierarchy
  const showHierarchy = currentView === 'alltasks' || currentView === 'inbox';

  const getOrCreateInboxId = async (userId) => {
    const tasksCollectionRef = collection(db, 'tasks');
    const q = query(tasksCollectionRef, 
      where("userId", "==", userId), 
      where("title", "==", "<Inbox>"),
      where("parentId", "==", null)
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].id;
    } else {
      const inboxTask = {
        title: '<Inbox>',
        userId: userId,
        status: 'next_action',
        importance: 3,
        urgency: 3,
        source: 'system',
        createdDate: serverTimestamp(),
        modifiedDate: serverTimestamp(),
        computedPriority: 0,
        childCount: 0
      };
      const docRef = await addDoc(tasksCollectionRef, inboxTask);
      return docRef.id;
    }
  };

  const handleTaskUpdate = async (update) => {
    console.log('Received task update from VoiceInterface:', update);

    try {
      switch (update.type) {
        case 'add':
          console.log('Attempting to add task with data:', update.data);
          let parentId = update.data.parentId;

          if (!parentId) {
            parentId = await getOrCreateInboxId(user.uid);
            console.log('Resolved default Inbox parentId:', parentId);
          } else if (parentId === '<Inbox>') {
            parentId = await getOrCreateInboxId(user.uid);
            console.log('Resolved explicit Inbox parentId:', parentId);
          }
          if (parentId === '<Inbox>') {
              parentId = null;
          }

          const newTaskData = {
            ...update.data,
            parentId: parentId,
            userId: user.uid,
            createdDate: serverTimestamp(),
            modifiedDate: serverTimestamp(),
          };
          console.log('Final task data to be added:', newTaskData);
          const docRef = await addDoc(collection(db, 'tasks'), newTaskData);
          console.log('Task added successfully with ID:', docRef.id);
          break;
        case 'update':
          {
            const { taskId, ...updates } = update.data;
            const taskRef = doc(db, 'tasks', taskId);
            await updateDoc(taskRef, {
              ...updates,
              modifiedDate: serverTimestamp(),
            });
          }
          break;
        case 'complete':
          {
            const { taskId } = update.data;
            const taskRef = doc(db, 'tasks', taskId);
            await updateDoc(taskRef, {
              status: 'done',
              completedDate: new Date(),
              modifiedDate: serverTimestamp(),
            });
          }
          break;
        case 'delete':
          {
            const { taskId } = update.data;
            await deleteDoc(doc(db, 'tasks', taskId));
          }
          break;
        default:
          console.warn('Unknown task update type:', update.type);
      }
      onUpdate();
    } catch (error) {
      console.error('Error processing voice command action:', error);
    }
  };

  return (
    <div className="gtd-app">
      {/* Left Sidebar Navigation */}
      <div className="gtd-sidebar">
        <div className="sidebar-section">
          <h3 className="sidebar-header">Views</h3>
          <nav className="sidebar-nav">
            <button
              className={`nav-item ${currentView === 'inbox' ? 'active' : ''}`}
              onClick={() => setCurrentView('inbox')}
            >
              <Inbox size={18} />
              <span>Inbox</span>
            </button>
            <button
              className={`nav-item ${currentView === 'todo' ? 'active' : ''}`}
              onClick={() => setCurrentView('todo')}
            >
              <ListTodo size={18} />
              <span>To Do</span>
            </button>
            <button
              className={`nav-item ${currentView === 'alltasks' ? 'active' : ''}`}
              onClick={() => setCurrentView('alltasks')}
            >
              <FolderTree size={18} />
              <span>All Tasks</span>
            </button>
            <button
              className={`nav-item ${currentView === 'recent' ? 'active' : ''}`}
              onClick={() => setCurrentView('recent')}
            >
              <Clock size={18} />
              <span>Recent</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="gtd-main">
        {/* Header */}
        <div className="gtd-header">
          <h1>
            {currentView === 'inbox' && 'Inbox'}
            {currentView === 'todo' && 'To Do'}
            {currentView === 'alltasks' && 'All Tasks'}
            {currentView === 'recent' && 'Recent'}
          </h1>
          <div className="header-actions">
            <button
              onClick={() => setShowVoiceInterface(!showVoiceInterface)}
              className={`voice-toggle-button ${showVoiceInterface ? 'active' : ''}`}
              title={showVoiceInterface ? 'Hide Voice Assistant' : 'Show Voice Assistant'}
            >
              <Mic size={20} />
            </button>
            <div className="header-stats">
              <span>{filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'}</span>
            </div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="gtd-filters">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search tasks..."
            className="search-input"
          />

          <div className="filter-buttons">
            <button
              onClick={() => setFilter('all')}
              className={filter === 'all' ? 'active' : ''}
            >
              All
            </button>
            <button
              onClick={() => setFilter('active')}
              className={filter === 'active' ? 'active' : ''}
            >
              Active
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={filter === 'completed' ? 'active' : ''}
            >
              Completed
            </button>
          </div>

          {allContexts.length > 0 && (
            <select
              value={selectedContext || ''}
              onChange={(e) => setSelectedContext(e.target.value || null)}
              className="context-select"
            >
              <option value="">All Contexts</option>
              {allContexts.map(ctx => (
                <option key={ctx} value={ctx}>{ctx}</option>
              ))}
            </select>
          )}
        </div>

        {/* Quick Add - only show for inbox and alltasks */}
        {(currentView === 'inbox' || currentView === 'alltasks') && (
          <QuickAddTask userId={user.uid} onAdd={onUpdate} allContexts={allContexts} />
        )}

        {/* Task List */}
        <div className="task-list">
          {filteredTasks.length === 0 ? (
            <p className="empty-state">
              {currentView === 'inbox' && 'Inbox is empty. Add tasks to get started!'}
              {currentView === 'todo' && 'No tasks to do. Great job!'}
              {currentView === 'alltasks' && 'No tasks found. Add one above!'}
              {currentView === 'recent' && 'No recent activity.'}
            </p>
          ) : (
            filteredTasks.map(task => (
              <InteractiveTaskItem
                key={task.id}
                task={task}
                userId={user.uid}
                onUpdate={onUpdate}
                allContexts={allContexts}
                allTasks={tasks}
                showHierarchy={showHierarchy}
              />
            ))
          )}
        </div>
      </div>

      {/* Voice Interface */}
      {showVoiceInterface && (
        <VoiceInterface user={user} tasks={tasks} onTaskUpdate={handleTaskUpdate} />
      )}

      <style jsx>{`
        .gtd-app {
          display: flex;
          height: calc(100vh - 70px);
          background: #f3f4f6;
        }

        .gtd-sidebar {
          width: 240px;
          background: white;
          border-right: 1px solid #e5e7eb;
          padding: 20px 0;
          overflow-y: auto;
        }

        .sidebar-section {
          margin-bottom: 24px;
        }

        .sidebar-header {
          margin: 0 20px 12px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          color: #6b7280;
          letter-spacing: 0.05em;
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 20px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 14px;
          color: #4b5563;
          transition: all 0.2s;
          text-align: left;
        }

        .nav-item:hover {
          background: #f3f4f6;
        }

        .nav-item.active {
          background: #dbeafe;
          color: #1e40af;
          font-weight: 500;
        }

        .nav-item.active svg {
          color: #3b82f6;
        }

        .gtd-main {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }

        .gtd-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e5e7eb;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .voice-toggle-button {
          background: none;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          padding: 8px;
          cursor: pointer;
          color: #6b7280;
          display: flex;
          align-items: center;
          transition: all 0.2s;
        }

        .voice-toggle-button:hover {
          background: #f3f4f6;
          color: #1f2937;
        }

        .voice-toggle-button.active {
          background: #dbeafe;
          color: #3b82f6;
          border-color: #3b82f6;
        }

        .gtd-header h1 {
          margin: 0;
          font-size: 2rem;
          color: #1f2937;
        }

        .header-stats {
          color: #6b7280;
          font-size: 0.875rem;
        }

        .gtd-filters {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }

        .search-input {
          flex: 1;
          min-width: 200px;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
        }

        .filter-buttons {
          display: flex;
          gap: 8px;
        }

        .filter-buttons button {
          padding: 8px 16px;
          border: 1px solid #d1d5db;
          background: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }

        .filter-buttons button:hover {
          background: #f3f4f6;
        }

        .filter-buttons button.active {
          background: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }

        .context-select {
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          background: white;
          cursor: pointer;
        }

        .task-item-container {
          margin-bottom: 4px;
        }

        .task-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          transition: all 0.2s;
        }

        .task-item:hover {
          background: #f9fafb;
          border-color: #d1d5db;
        }

        .task-item.completed {
          opacity: 0.6;
        }

        .drag-handle {
          cursor: grab;
          color: #9ca3af;
          transition: opacity 0.2s;
        }

        .drag-handle:active {
          cursor: grabbing;
        }

        .collapse-toggle {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          color: #6b7280;
          display: flex;
          align-items: center;
        }

        .completion-checkbox {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
        }

        .task-title {
          flex: 1;
          font-size: 15px;
          color: #1f2937;
        }

        .task-title.line-through {
          text-decoration: line-through;
        }

        .task-title-input {
          flex: 1;
          padding: 4px 8px;
          border: 1px solid #3b82f6;
          border-radius: 4px;
          font-size: 15px;
          outline: none;
        }

        .task-metadata {
          display: flex;
          gap: 8px;
          font-size: 12px;
          color: #6b7280;
        }

        .task-context {
          padding: 2px 8px;
          background: #dbeafe;
          color: #1e40af;
          border-radius: 4px;
        }

        .task-time {
          padding: 2px 8px;
          background: #fef3c7;
          color: #92400e;
          border-radius: 4px;
        }

        .task-children {
          padding: 2px 8px;
          background: #e5e7eb;
          color: #4b5563;
          border-radius: 4px;
        }

        .task-date {
          padding: 2px 8px;
          background: #f3f4f6;
          color: #6b7280;
          border-radius: 4px;
        }

        .task-actions {
          display: flex;
          gap: 4px;
        }

        .action-btn {
          padding: 4px;
          background: none;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          cursor: pointer;
          color: #6b7280;
          display: flex;
          align-items: center;
          transition: all 0.2s;
        }

        .action-btn:hover {
          background: #f3f4f6;
          color: #1f2937;
        }

        .delete-btn:hover {
          background: #fee2e2;
          color: #dc2626;
          border-color: #fecaca;
        }

        .quick-add-container {
          margin-bottom: 16px;
        }

        .quick-add-main {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          background: white;
          border: 2px dashed #d1d5db;
          border-radius: 6px;
        }

        .quick-add-input {
          flex: 1;
          border: none;
          outline: none;
          font-size: 15px;
        }

        .quick-add-details {
          display: flex;
          gap: 8px;
          margin-top: 8px;
          padding: 12px;
          background: #f9fafb;
          border-radius: 6px;
        }

        .detail-input {
          padding: 6px 16px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 14px;
        }

        .detail-input.small {
          width: 100px;
        }

        .add-btn, .cancel-btn, .add-child-btn {
          padding: 6px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }

        .add-btn, .add-child-btn {
          background: #3b82f6;
          color: white;
        }

        .add-btn:hover, .add-child-btn:hover {
          background: #2563eb;
        }

        .cancel-btn {
          background: #e5e7eb;
          color: #4b5563;
        }

        .cancel-btn:hover {
          background: #d1d5db;
        }

        .add-child-container {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .add-child-input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 14px;
        }

        .empty-state {
          text-align: center;
          padding: 40px;
          color: #9ca3af;
        }

        .text-green-600 {
          color: #059669;
        }

        .text-gray-400 {
          color: #9ca3af;
        }

        .text-blue-600 {
          color: #2563eb;
        }
      `}</style>
    </div>
  );
};

export default InteractiveGTDApp;
