import React, { useState, useRef, useEffect, useCallback } from 'react';
import { addDays, addMonths } from 'date-fns';
import { db } from './firebase';
import { doc, updateDoc, addDoc, collection, serverTimestamp, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { CheckCircle, Circle, Plus, Edit2, Trash2, GripVertical, ChevronRight, ChevronDown, Inbox, ListTodo, FolderTree, Clock, Mic, Menu, ClipboardCheck, LayoutGrid } from 'lucide-react';
import TaskDetailEditor from './EnhancedComponents';
import VoiceInterface from './components/VoiceInterface';
import KeyboardShortcuts, { useKeyboardShortcuts } from './components/KeyboardShortcuts';
import './InteractiveGTDApp.css';

// Get or create Inbox
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
      childCount: 0,
      lastReviewDate: serverTimestamp(),
      nextReviewDate: addDays(new Date(), 14),
      reviewEnabled: true,
      reviewInterval: 14
    };
    const docRef = await addDoc(tasksCollectionRef, inboxTask);
    return docRef.id;
  }
};

// Interactive Task Item Component
const InteractiveTaskItem = ({
  task,
  userId,
  onUpdate,
  onEdit,
  level = 0,
  allContexts,
  allTasks,
  showHierarchy,
  selectedTaskId,
  taskIndex,
  onReview,
  isReviewView
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(task.title);
  const [showAddChild, setShowAddChild] = useState(false);
  const [newChildTitle, setNewChildTitle] = useState('');

  const isCompleted = task.status === 'done';
  const hasChildren = task.children && task.children.length > 0;
  const isSelected = task.id === selectedTaskId;

  const elementRef = useRef(null);

  useEffect(() => {
    if (isSelected && elementRef.current) {
      elementRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }, [isSelected]);

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

      // Handle recurrence
      if (newStatus === 'done' && task.isRecurring && task.recurrencePattern) {
        let nextDueDate = new Date();
        const baseDate = task.dueDate ? (task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate)) : new Date();

        switch (task.recurrencePattern) {
          case 'daily':
            nextDueDate = addDays(baseDate, 1);
            break;
          case 'weekly':
            nextDueDate = addDays(baseDate, 7);
            break;
          case 'biweekly':
            nextDueDate = addDays(baseDate, 14);
            break;
          case 'monthly':
            nextDueDate = addMonths(baseDate, 1);
            break;
          default:
            nextDueDate = addDays(baseDate, 7);
        }

        const newTask = {
          title: task.title,
          userId: userId,
          parentId: task.parentId || null,
          level: task.level || 0,
          status: 'next_action',
          importance: task.importance || 3,
          urgency: task.urgency || 3,
          context: task.context || null,
          timeEstimate: task.timeEstimate || null,
          energyLevel: task.energyLevel || 'medium',
          isProject: task.isProject || false,
          isRecurring: true,
          recurrencePattern: task.recurrencePattern,
          source: 'recurrence',
          dueDate: nextDueDate,
          createdDate: serverTimestamp(),
          modifiedDate: serverTimestamp(),
          lastReviewDate: serverTimestamp(),
          nextReviewDate: addDays(new Date(), task.reviewInterval || 14),
          reviewEnabled: task.reviewEnabled !== false,
          reviewInterval: task.reviewInterval || 14,
          computedPriority: 0,
          childCount: 0
        };

        await addDoc(collection(db, 'tasks'), newTask);
      }

      onUpdate?.(true);
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
        childCount: 0,
        lastReviewDate: serverTimestamp(),
        nextReviewDate: addDays(new Date(), 14),
        reviewEnabled: true,
        reviewInterval: 14
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
        ref={elementRef}
        className="task-item-container"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ marginLeft: showHierarchy ? `${level * 24}px` : '0px' }}
        data-task-index={taskIndex}
      >
        <div className={`task-item ${isCompleted ? 'completed' : ''} ${isSelected ? 'selected' : ''}`}>
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
              onClick={onEdit}
              onDoubleClick={() => setIsEditing(true)}
            >
              {task.title}
            </span>
          )}

          {/* Task Metadata */}
          <div className="task-metadata" style={{ opacity: isHovered || isSelected ? 1 : 0.5 }}>
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
          {(isHovered || isSelected) && !isEditing && (
            <div className="task-actions">
              <button
                onClick={onEdit}
                className="action-btn"
                title="Edit task details (o)"
              >
                <Edit2 size={14} />
              </button>
              {showHierarchy && (
                <button
                  onClick={() => setShowAddChild(!showAddChild)}
                  className="action-btn"
                  title="Add subtask (Shift+A)"
                >
                  <Plus size={14} />
                </button>
              )}
              <button
                onClick={handleDelete}
                className="action-btn delete-btn"
                title="Delete task (d)"
              >
                <Trash2 size={14} />
              </button>
              {isReviewView && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onReview(task);
                  }}
                  className="action-btn"
                  title="Mark Reviewed"
                >
                  <ClipboardCheck size={14} />
                </button>
              )}
            </div>
          )}

          {/* Keyboard hint for selected task */}
          {isSelected && (
            <div className="keyboard-hint">
              Press ? for help
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
            {task.children.map((child, idx) => (
              <InteractiveTaskItem
                key={child.id}
                task={child}
                userId={userId}
                onUpdate={onUpdate}
                onEdit={() => onEdit(child)}
                level={level + 1}
                allContexts={allContexts}
                allTasks={allTasks}
                showHierarchy={showHierarchy}
                selectedTaskId={selectedTaskId}
                taskIndex={-1}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
};

// Quick Add Task Component
const QuickAddTask = ({ userId, onAdd, parentId = null, level = 0, allContexts, autoFocus = false }) => {
  const [title, setTitle] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [context, setContext] = useState('');
  const [timeEstimate, setTimeEstimate] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      setIsExpanded(true);
    }
  }, [autoFocus]);

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
        childCount: 0,
        lastReviewDate: serverTimestamp(),
        nextReviewDate: addDays(new Date(), 14),
        reviewEnabled: true,
        reviewInterval: 14
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
          ref={inputRef}
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
          placeholder="Add new task... (press c)"
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
  const [currentView, setCurrentView] = useState('inbox');
  const [filter, setFilter] = useState('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContext, setSelectedContext] = useState(null);
  const [showVoiceInterface, setShowVoiceInterface] = useState(false);
  const [selectedTaskIndex, setSelectedTaskIndex] = useState(-1);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [quickAddAutoFocus, setQuickAddAutoFocus] = useState(false);
  const [sequenceKey, setSequenceKey] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [startParentSearchOpen, setStartParentSearchOpen] = useState(false);

  const inboxTask = tasks.find(t => t.title === '<Inbox>' && !t.parentId);
  const inboxId = inboxTask ? inboxTask.id : null;

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 1024) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle Android Shortcuts
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'quick_add') {
      setCurrentView('quick_add_standalone');
      setQuickAddAutoFocus(true);
      // Clean up URL to avoid re-triggering on refresh
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

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
        return inboxTask ? (inboxTask.children || []).filter(child => child.status !== 'done') : [];

      case 'todo':
        const allFlat = flattenTasks(tasks);
        return allFlat
          .filter(t => !t.isProject && t.status !== 'done')
          .sort((a, b) => {
            const priorityA = a.computedPriority || ((a.importance || 3) * 3 + (a.urgency || 3) * 2.5);
            const priorityB = b.computedPriority || ((b.importance || 3) * 3 + (b.urgency || 3) * 2.5);
            return priorityB - priorityA;
          });

      case 'recent':
        const allFlatWithDates = flattenTasks(tasks);
        return allFlatWithDates
          .filter(t => t.modifiedDate)
          .sort((a, b) => {
            const dateA = a.modifiedDate.toDate ? a.modifiedDate.toDate() : new Date(a.modifiedDate);
            const dateB = b.modifiedDate.toDate ? b.modifiedDate.toDate() : new Date(b.modifiedDate);
            return dateB - dateA;
          })
          .slice(0, 50);

      case 'review':
        const allForReview = flattenTasks(tasks);
        const now = new Date();
        return allForReview
          .filter(t => t.reviewEnabled !== false && t.status !== 'done' && (!t.nextReviewDate || (t.nextReviewDate.toDate ? t.nextReviewDate.toDate() : new Date(t.nextReviewDate)) <= now))
          .sort((a, b) => {
            const dateA = a.nextReviewDate ? (a.nextReviewDate.toDate ? a.nextReviewDate.toDate() : new Date(a.nextReviewDate)) : new Date(0);
            const dateB = b.nextReviewDate ? (b.nextReviewDate.toDate ? b.nextReviewDate.toDate() : new Date(b.nextReviewDate)) : new Date(0);
            return dateA - dateB;
          });

      case 'organize':
        // Recursive filter for organize view
        const filterOrganize = (taskList) => {
          return taskList.map(task => {
            // Check if task matches organize criteria
            const isUnorganized = task.status !== 'done' && (
              // Incomplete Project with no subtasks
              (task.isProject && (!task.children || task.children.length === 0)) ||
              // Unorganized Task (default values or missing context)
              (!task.isProject && (
                // Default values check
                ((task.importance === 3 || task.importance === undefined) &&
                  (task.urgency === 3 || task.urgency === undefined) &&
                  !task.timeEstimate &&
                  (task.energyLevel === 'medium' || task.energyLevel === undefined)) ||
                // Missing context check
                !task.context
              ))
            );

            // Process children
            const filteredChildren = task.children ? filterOrganize(task.children) : [];

            // Return task if it matches criteria OR has matching children
            if (isUnorganized || filteredChildren.length > 0) {
              return { ...task, children: filteredChildren };
            }
            return null;
          }).filter(t => t !== null);
        };
        return filterOrganize(tasks);

      case 'alltasks':
      default:
        return tasks;
    }
  };

  // Filter tasks
  const filterTasks = (taskList) => {
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

    return taskList
      .map(task => {
        const filteredChildren = task.children ? filterTasks(task.children) : [];

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
          return { ...task, children: filteredChildren };
        }

        return null;
      })
      .filter(task => task !== null);
  };

  const viewTasks = getViewTasks();
  const filteredTasks = filterTasks(viewTasks);
  const flatFilteredTasks = currentView === 'todo' || currentView === 'recent'
    ? filteredTasks
    : flattenTasks(filteredTasks);

  const showHierarchy = currentView === 'alltasks' || currentView === 'inbox' || currentView === 'organize';

  // Handle marking task as reviewed
  const handleMarkReviewed = async (task) => {
    try {
      const taskRef = doc(db, 'tasks', task.id);
      await updateDoc(taskRef, {
        lastReviewDate: serverTimestamp(),
        nextReviewDate: addDays(new Date(), task.reviewInterval || 14),
        modifiedDate: serverTimestamp()
      });
      onUpdate?.();
    } catch (error) {
      console.error('Error marking reviewed:', error);
      alert('Failed to mark as reviewed');
    }
  };

  // Handle task updates from voice
  const handleTaskUpdate = async (update) => {
    console.log('Received task update:', update);

    try {
      switch (update.type) {
        case 'add':
          let parentId = update.data.parentId;

          if (!parentId) {
            parentId = await getOrCreateInboxId(user.uid);
          } else if (parentId === '<Inbox>') {
            parentId = await getOrCreateInboxId(user.uid);
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
            lastReviewDate: serverTimestamp(),
            nextReviewDate: addDays(new Date(), 14),
            reviewEnabled: true,
            reviewInterval: 14,
          };
          await addDoc(collection(db, 'tasks'), newTaskData);
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
      onUpdate(true);
    } catch (error) {
      console.error('Error processing task update:', error);
    }
  };

  // Handle keyboard shortcuts actions
  const handleTaskAction = useCallback(async (action, task, value) => {
    console.log('Task action:', action, task, value);

    switch (action) {
      case 'create':
        setQuickAddAutoFocus(true);
        setTimeout(() => setQuickAddAutoFocus(false), 100);
        break;

      case 'addSubtask':
        if (task) {
          // Trigger add child for selected task
          console.log('Add subtask to:', task.title);
        }
        break;

      case 'edit':
        if (task) {
          setEditingTask(task);
        }
        break;

      case 'move':
        if (task) {
          setEditingTask(task);
          setStartParentSearchOpen(true);
        }
        break;

      case 'toggleComplete':
        if (task) {
          const taskRef = doc(db, 'tasks', task.id);
          const newStatus = task.status === 'done' ? 'next_action' : 'done';
          await updateDoc(taskRef, {
            status: newStatus,
            completedDate: newStatus === 'done' ? new Date() : null,
            modifiedDate: serverTimestamp()
          });
          onUpdate(true);
        }
        break;

      case 'delete':
        if (task) {
          if (window.confirm(`Delete "${task.title}"?`)) {
            await deleteDoc(doc(db, 'tasks', task.id));
            onUpdate(true);
          }
        }
        break;

      case 'setImportance':
        if (task && value) {
          const taskRef = doc(db, 'tasks', task.id);
          await updateDoc(taskRef, {
            importance: value,
            modifiedDate: serverTimestamp()
          });
          onUpdate(true);
        }
        break;

      case 'setUrgency':
        if (task && value) {
          const taskRef = doc(db, 'tasks', task.id);
          await updateDoc(taskRef, {
            urgency: value,
            modifiedDate: serverTimestamp()
          });
          onUpdate(true);
        }
        break;

      case 'setContext':
        console.log('Set context for:', task?.title);
        break;

      case 'setDueDate':
        console.log('Set due date for:', task?.title);
        break;

      case 'collapse':
      case 'expand':
        console.log(action, 'task:', task?.title);
        break;

      case 'aiAnalysis':
        console.log('AI analysis for:', task?.title);
        break;

      case 'aiResearch':
        console.log('AI research for:', task?.title);
        break;

      case 'cancel':
        setSelectedTaskIndex(-1);
        break;

      default:
        console.log('Unknown action:', action);
    }
  }, [onUpdate]);

  // Initialize keyboard shortcuts
  useKeyboardShortcuts({
    currentView,
    setCurrentView,
    selectedTaskIndex,
    setSelectedTaskIndex,
    flatTasks: flatFilteredTasks,
    onTaskAction: handleTaskAction,
    onToggleVoice: () => setShowVoiceInterface(!showVoiceInterface),
    onRefresh: onUpdate,
    searchInputRef,
    setFilter,
    setShowShortcutsHelp
  });

  // Show sequence indicator
  useEffect(() => {
    if (sequenceKey) {
      const timer = setTimeout(() => setSequenceKey(null), 1500);
      return () => clearTimeout(timer);
    }
  }, [sequenceKey]);

  const handleSaveFromEditor = async (updates) => {
    if (!editingTask) return;
    try {
      const taskRef = doc(db, 'tasks', editingTask.id);
      await updateDoc(taskRef, updates);
      setEditingTask(null);
      setStartParentSearchOpen(false);
      onUpdate?.(true);
    } catch (error) {
      console.error('Error updating task from editor:', error);
      alert('Failed to save changes');
    }
  };

  const uniqueClassName = `gtd-app-${Date.now()}`;

  if (currentView === 'quick_add_standalone') {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f3f4f6' }}>
        <div style={{ width: '100%', maxWidth: '600px', padding: '20px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <h2 style={{ marginBottom: '20px', textAlign: 'center', color: '#1f2937' }}>Quick Add Task</h2>
          <QuickAddTask
            userId={user.uid}
            parentId={inboxId}
            onAdd={() => {
              onUpdate(true);
              // Optional: Show success message or close if possible (web apps can't close themselves usually)
              alert('Task added to Inbox!');
            }}
            allContexts={allContexts}
            autoFocus={true}
          />
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <button
              onClick={() => setCurrentView('inbox')}
              style={{ background: 'none', border: 'none', color: '#4b5563', textDecoration: 'underline', cursor: 'pointer' }}
            >
              Go to Inbox
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`gtd-app ${uniqueClassName}`}>
      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcuts
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
      />

      {/* Task Detail Editor */}
      {editingTask && (
        <TaskDetailEditor
          task={editingTask}
          onClose={() => {
            setEditingTask(null);
            setStartParentSearchOpen(false);
          }}
          onSave={handleSaveFromEditor}
          allContexts={allContexts}
          allTasks={tasks}
          startWithParentSearchOpen={startParentSearchOpen}
        />
      )}

      {/* Sequence Indicator */}
      {sequenceKey && (
        <div className="sequence-indicator">
          Waiting for key after <kbd>{sequenceKey}</kbd>
        </div>
      )}

      {/* Left Sidebar Navigation */}
      <div className={`gtd-sidebar ${isSidebarOpen ? 'open' : ''}`}>
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
              className={`nav-item ${currentView === 'organize' ? 'active' : ''}`}
              onClick={() => setCurrentView('organize')}
            >
              <LayoutGrid size={18} />
              <span>Organize</span>
            </button>
            <button
              className={`nav-item ${currentView === 'recent' ? 'active' : ''}`}
              onClick={() => setCurrentView('recent')}
            >
              <Clock size={18} />
              <span>Recent</span>
            </button>
            <button
              className={`nav-item ${currentView === 'review' ? 'active' : ''}`}
              onClick={() => setCurrentView('review')}
            >
              <ClipboardCheck size={18} />
              <span>Review</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="gtd-main">
        {/* Header */}
        <div className="gtd-header">
          <button className="sidebar-toggle" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            <Menu size={24} />
          </button>
          <h1>
            {currentView === 'inbox' && 'Inbox'}
            {currentView === 'todo' && 'To Do'}
            {currentView === 'todo' && 'To Do'}
            {currentView === 'alltasks' && 'All Tasks'}
            {currentView === 'organize' && 'Organize'}
            {currentView === 'recent' && 'Recent'}
            {currentView === 'review' && 'Review'}
          </h1>
          <div className="header-actions">
            <button
              onClick={() => setShowShortcutsHelp(true)}
              className="keyboard-help-button"
              title="Keyboard shortcuts (?)"
            >
              ?
            </button>
            <button
              onClick={() => setShowVoiceInterface(!showVoiceInterface)}
              className={`voice-toggle-button ${showVoiceInterface ? 'active' : ''}`}
              title={showVoiceInterface ? 'Hide Voice Assistant (v)' : 'Show Voice Assistant (v)'}
            >
              <Mic size={20} />
            </button>
            <div className="header-stats">
              <span>{filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'}</span>
            </div>
            {currentView === 'alltasks' && (
              <label className="show-completed-toggle" style={{ marginLeft: '16px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={filter === 'all'}
                  onChange={(e) => setFilter(e.target.checked ? 'all' : 'active')}
                  style={{ cursor: 'pointer' }}
                />
                Show Completed
              </label>
            )}
          </div>
        </div>

        {/* Filters & Search */}
        <div className="gtd-filters">
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search tasks... (press /)"
            className="search-input"
          />

          {currentView !== 'alltasks' && (
            <div className="filter-buttons">
              <button
                onClick={() => setFilter('all')}
                className={filter === 'all' ? 'active' : ''}
                title="f then a"
              >
                All
              </button>
              <button
                onClick={() => setFilter('active')}
                className={filter === 'active' ? 'active' : ''}
                title="f then o"
              >
                Active
              </button>
              <button
                onClick={() => setFilter('completed')}
                className={filter === 'completed' ? 'active' : ''}
                title="f then c"
              >
                Completed
              </button>
            </div>
          )}

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

        {/* Quick Add */}
        {(currentView === 'inbox' || currentView === 'alltasks') && (
          <QuickAddTask
            userId={user.uid}
            parentId={currentView === 'inbox' ? inboxId : null}
            onAdd={onUpdate}
            allContexts={allContexts}
            autoFocus={quickAddAutoFocus}
          />
        )}

        {/* Task List */}
        <div className="task-list">
          {filteredTasks.length === 0 ? (
            <p className="empty-state">
              {currentView === 'inbox' && 'Inbox is empty. Press c to add a task!'}
              {currentView === 'todo' && 'No tasks to do. Great job!'}
              {currentView === 'alltasks' && 'No tasks found. Press c to add one!'}
            </p>
          ) : (
            filteredTasks.map((task, index) => (
              <InteractiveTaskItem
                key={task.id}
                task={task}
                userId={user.uid}
                onUpdate={onUpdate}
                onEdit={() => {
                  setEditingTask(task);
                  setStartParentSearchOpen(false);
                }}
                allContexts={allContexts}
                allTasks={tasks}
                showHierarchy={showHierarchy}
                selectedTaskId={selectedTaskIndex !== -1 && flatFilteredTasks[selectedTaskIndex] ? flatFilteredTasks[selectedTaskIndex].id : null}
                taskIndex={index}
                onReview={handleMarkReviewed}
                isReviewView={currentView === 'review'}
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
        /* Styles moved to InteractiveGTDApp.css */
      `}</style>
    </div>
  );
};

export default InteractiveGTDApp;