import React, { useState, useMemo } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import { 
  Calendar, Clock, Zap, Star, Tag, FolderOpen, Folder
}
from 'lucide-react';

// Helper to get all descendants of a task (used for exclusion)
const getAllDescendantIds = (node) => {
  let ids = new Set();
  if (node.children) {
    node.children.forEach(child => {
      ids.add(child.id);
      getAllDescendantIds(child).forEach(id => ids.add(id));
    });
  }
  return ids;
};

// Helper to flatten tasks and add level, excluding current task and its descendants
const getFlattentenedTasksForParentSelection = (tasksToFlatten, currentTaskId, excludedDescendantIds, level = 0) => {
  let flat = [];
  tasksToFlatten.forEach(t => {
    if (t.id === currentTaskId || excludedDescendantIds.has(t.id)) {
      // Exclude the current task and its descendants
      return;
    }
    flat.push({ ...t, level });
    if (t.children && t.children.length > 0) {
      flat = flat.concat(getFlattentenedTasksForParentSelection(t.children, currentTaskId, excludedDescendantIds, level + 1));
    }
  });
  return flat;
};

// Task Detail Editor Modal
const TaskDetailEditor = ({ task, onClose, onSave, allContexts, allTasks }) => {
  const [formData, setFormData] = useState({
    title: task.title || '',
    description: task.description || '',
    importance: task.importance || 3,
    urgency: task.urgency || 3,
    context: task.context || '',
    timeEstimate: task.timeEstimate || '',
    energyLevel: task.energyLevel || 'medium',
    dueDate: task.dueDate ? formatDateForInput(task.dueDate) : '',
    startDate: task.startDate ? formatDateForInput(task.startDate) : '',
    isProject: task.isProject || false,
    todayFocus: task.todayFocus || false,
    parentId: task.parentId || null
  });
  const [parentSearch, setParentSearch] = useState('');
  const [showParentSearch, setShowParentSearch] = useState(false); // New state

  // Memoize the set of descendant IDs for the current task
  const currentTaskDescendantIds = useMemo(() => getAllDescendantIds(task), [task]);

  const potentialParents = useMemo(() => {
    return getFlattentenedTasksForParentSelection(allTasks || [], task.id, currentTaskDescendantIds);
  }, [allTasks, task.id, currentTaskDescendantIds]);

  const potentialParentsMap = useMemo(() => {
    const map = new Map();
    potentialParents.forEach(p => map.set(p.id, p));
    return map;
  }, [potentialParents]);

  const filteredParents = useMemo(() => {
    if (!parentSearch) {
      return potentialParents;
    }

    const lowerCaseSearch = parentSearch.toLowerCase();
    const matchingTasks = potentialParents.filter(p => p.title.toLowerCase().includes(lowerCaseSearch));

    const tasksToShow = new Set();
    matchingTasks.forEach(match => {
      let current = match;
      while (current) {
        tasksToShow.add(current.id);
        current = potentialParentsMap.get(current.parentId); // Use map for faster lookup
      }
    });

    // Filter potentialParents to include only tasks that are matches or ancestors of matches
    return potentialParents.filter(p => tasksToShow.has(p.id));
  }, [parentSearch, potentialParents, potentialParentsMap]);

  const currentParent = task.parentId ? potentialParentsMap.get(task.parentId) : null;

  function formatDateForInput(date) {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toISOString().split('T')[0];
  }

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      alert('Title is required');
      return;
    }

    const updates = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      importance: parseInt(formData.importance),
      urgency: parseInt(formData.urgency),
      context: formData.context.trim() || null,
      timeEstimate: formData.timeEstimate ? parseInt(formData.timeEstimate) : null,
      energyLevel: formData.energyLevel,
      dueDate: formData.dueDate ? new Date(formData.dueDate) : null,
      startDate: formData.startDate ? new Date(formData.startDate) : null,
      isProject: formData.isProject,
      todayFocus: formData.todayFocus,
      parentId: formData.parentId,
      modifiedDate: serverTimestamp()
    };

    await onSave(updates);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content enhanced-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Task Details</h2>
          <button onClick={onClose} className="close-button">×</button>
        </div>

        <div className="task-form">
          {/* Title */}
          <div className="form-group">
            <label>Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              autoFocus
              className="form-input"
            />
          </div>

          {/* Description */}
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              rows={3}
              placeholder="Add notes or details..."
              className="form-textarea"
            />
          </div>

          {/* Importance and Urgency */}
          <div className="form-row">
            <div className="form-group">
              <label>
                <Star size={14} className="inline-icon" />
                Importance (1-5)
              </label>
              <select
                value={formData.importance}
                onChange={e => setFormData({...formData, importance: e.target.value})}
                className="form-select"
              >
                <option value="1">1 - Low</option>
                <option value="2">2</option>
                <option value="3">3 - Medium</option>
                <option value="4">4</option>
                <option value="5">5 - High</option>
              </select>
            </div>

            <div className="form-group">
              <label>
                <Zap size={14} className="inline-icon" />
                Urgency (1-5)
              </label>
              <select
                value={formData.urgency}
                onChange={e => setFormData({...formData, urgency: e.target.value})}
                className="form-select"
              >
                <option value="1">1 - Low</option>
                <option value="2">2</option>
                <option value="3">3 - Medium</option>
                <option value="4">4</option>
                <option value="5">5 - High</option>
              </select>
            </div>
          </div>

          {/* Context */}
          <div className="form-group">
            <label>
              <Tag size={14} className="inline-icon" />
              Context
            </label>
            <input
              type="text"
              value={formData.context}
              onChange={e => setFormData({...formData, context: e.target.value})}
              list="context-suggestions"
              placeholder="e.g., @home, @office, @calls"
              className="form-input"
            />
            <datalist id="context-suggestions">
              {allContexts.map(ctx => (
                <option key={ctx} value={ctx} />
              ))}
            </datalist>
          </div>

          {/* Time and Energy */}
          <div className="form-row">
            <div className="form-group">
              <label>
                <Clock size={14} className="inline-icon" />
                Time (minutes)
              </label>
              <input
                type="number"
                value={formData.timeEstimate}
                onChange={e => setFormData({...formData, timeEstimate: e.target.value})}
                min="1"
                placeholder="15"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>
                <Zap size={14} className="inline-icon" />
                Energy Level
              </label>
              <select
                value={formData.energyLevel}
                onChange={e => setFormData({...formData, energyLevel: e.target.value})}
                className="form-select"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="form-row">
            <div className="form-group">
              <label>
                <Calendar size={14} className="inline-icon" />
                Start Date
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={e => setFormData({...formData, startDate: e.target.value})}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>
                <Calendar size={14} className="inline-icon" />
                Due Date
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={e => setFormData({...formData, dueDate: e.target.value})}
                className="form-input"
              />
            </div>
          </div>

          {/* Parent Task Selection */}
          <div className="form-group">
            <label>
              <Folder size={14} className="inline-icon" />
              Parent Task
            </label>
            <div className="parent-selection-area">
              <div className="parent-display">
                {currentParent ? currentParent.title : <em>None (Top-level task)</em>}
              </div>
              <div className="parent-actions">
                {!showParentSearch && (
                  <button type="button" onClick={() => setShowParentSearch(true)} className="btn-tertiary">
                    Change Parent
                  </button>
                )}
                {formData.parentId && (
                  <button type="button" onClick={() => setFormData({...formData, parentId: null})} className="btn-tertiary">
                    Remove Parent
                  </button>
                )}
              </div>
            </div>

            {showParentSearch && (
              <div className="parent-search-dropdown">
                <input
                  type="text"
                  value={parentSearch}
                  onChange={e => setParentSearch(e.target.value)}
                  placeholder="Search for a new parent task..."
                  className="form-input"
                  autoFocus
                />
                <ul className="parent-suggestions">
                  {filteredParents.slice(0, 5).map(p => (
                                      <li key={p.id} onClick={() => {
                                        setFormData({...formData, parentId: p.id});
                                        setParentSearch('');
                                        setShowParentSearch(false);
                                      }} style={{ paddingLeft: `${p.level * 16 + 12}px` }}> {/* Indentation */}
                                        {p.title}
                                      </li>                  ))}
                  {filteredParents.length === 0 && <li>No tasks found</li>}
                </ul>
                <div className="parent-search-actions">
                  <button type="button" onClick={() => {
                    setParentSearch('');
                    setShowParentSearch(false);
                  }} className="btn-secondary">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Checkboxes */}
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.isProject}
                onChange={e => setFormData({...formData, isProject: e.target.checked})}
              />
              <FolderOpen size={16} className="inline-icon" />
              This is a project (contains subtasks)
            </label>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.todayFocus}
                onChange={e => setFormData({...formData, todayFocus: e.target.checked})}
              />
              <Star size={16} className="inline-icon" />
              Add to Today's Focus
            </label>
          </div>

          {/* Action Buttons */}
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="button" onClick={handleSubmit} className="btn-primary">
              Save Changes
            </button>
          </div>
        </div>

        <style jsx>{`
          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
          }

          .enhanced-modal {
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            max-width: 800px;
            width: 90%;
            max-height: 90vh;
            overflow-y: auto;
            position: relative;
            display: flex;
            flex-direction: column;
          }

          .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 24px;
            border-bottom: 1px solid #e5e7eb;
            position: sticky;
            top: 0;
            background: white;
            z-index: 10;
          }

          .modal-header h2 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
          }

          .close-button {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #9ca3af;
          }

          .close-button:hover {
            color: #4b5563;
          }

          .task-form {
            padding: 24px;
            flex-grow: 1;
            overflow-y: auto;
          }

          .form-group {
            margin-bottom: 16px;
          }

          .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
          }

          .form-group label {
            display: block;
            font-size: 14px;
            font-weight: 500;
            color: #374151;
            margin-bottom: 6px;
          }

          .inline-icon {
            display: inline;
            vertical-align: middle;
            margin-right: 4px;
          }

          .form-input, .form-textarea, .form-select {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 14px;
            font-family: inherit;
          }

          .form-input:focus, .form-textarea:focus, .form-select:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2); /* ring-blue-200 */
          }

          .form-textarea {
            resize: vertical;
          }

          .checkbox-label {
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            font-weight: normal;
          }

          .checkbox-label input[type="checkbox"] {
            width: 18px;
            height: 18px;
            cursor: pointer;
          }

          .modal-actions {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
            margin-top: 24px;
            padding: 16px 24px; /* Added padding for consistency */
            border-top: 1px solid #e5e7eb;
            position: sticky;
            bottom: 0;
            background: white;
            z-index: 10;
          }

          .btn-primary, .btn-secondary, .btn-tertiary {
            padding: 10px 20px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          }

          .btn-primary {
            background: #3b82f6;
            color: white;
            border: none;
          }

          .btn-primary:hover {
            background: #2563eb;
          }

          .btn-secondary {
            background: white;
            color: #4b5563;
            border: 1px solid #d1d5db;
          }

          .btn-secondary:hover {
            background: #f3f4f6;
          }

          .btn-tertiary {
            background: none;
            border: 1px solid transparent;
            color: #3b82f6;
          }

          .btn-tertiary:hover {
            background: #e0f2fe; /* blue-50 */
            border-color: #bfdbfe; /* blue-200 */
          }

          .parent-selection-area {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            background: #f3f4f6;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            margin-bottom: 8px;
            font-size: 14px;
          }

          .parent-display {
            flex-grow: 1;
          }

          .parent-actions {
            display: flex;
            gap: 8px;
          }

          .parent-search-dropdown {
            position: relative; /* For positioning suggestions */
            margin-top: 8px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            background: white;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          }

          .parent-search-dropdown .form-input {
            border: none;
            border-bottom: 1px solid #e5e7eb;
            border-radius: 6px 6px 0 0;
          }

          .parent-suggestions {
            list-style: none;
            padding: 0;
            margin: 0;
            max-height: 300px;
            overflow-y: auto;
          }
          .parent-suggestions li {
            padding: 8px 12px;
            cursor: pointer;
            border-bottom: 1px solid #e5e7eb;
          }
          .parent-suggestions li:last-child {
            border-bottom: none;
          }
          .parent-suggestions li:hover {
            background: #f3f4f6;
          }
          .parent-path {
            display: block;
            font-size: 11px;
            color: #6b7280;
            margin-top: 2px;
          }

          .parent-search-actions {
            display: flex;
            justify-content: flex-end;
            padding: 8px 12px;
            border-top: 1px solid #e5e7eb;
          }
        `}</style>
      </div>
    </div>
  );
};

export default TaskDetailEditor;
