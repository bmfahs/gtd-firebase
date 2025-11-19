import React, { useState, useMemo, useEffect } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import {
  Calendar, Clock, Zap, Star, Tag, FolderOpen, Folder
}
  from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeExternalLinks from 'rehype-external-links';

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

import './EnhancedComponents.css';

// Task Detail Editor Modal
const TaskDetailEditor = ({ task, onClose, onSave, allContexts, allTasks, startWithParentSearchOpen = false }) => {
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
  const [showParentSearch, setShowParentSearch] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [highlightedParentIndex, setHighlightedParentIndex] = useState(-1);

  useEffect(() => {
    if (startWithParentSearchOpen) {
      setShowParentSearch(true);
    }
  }, [startWithParentSearchOpen]);

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

  useEffect(() => {
    setHighlightedParentIndex(-1);
  }, [filteredParents]);

  function formatDateForInput(date) {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toISOString().split('T')[0];
  }

  const handleParentSearchKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedParentIndex(prev => Math.min(prev + 1, filteredParents.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedParentIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedParentIndex >= 0 && filteredParents[highlightedParentIndex]) {
        const selectedParent = filteredParents[highlightedParentIndex];
        setFormData({ ...formData, parentId: selectedParent.id });
        setParentSearch('');
        setShowParentSearch(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setParentSearch('');
      setShowParentSearch(false);
    }
  };

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
    <div className="task-detail-overlay" onClick={onClose}>
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
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              autoFocus
              className="form-input"
            />
          </div>

          {/* Description */}
          <div className="form-group">
            <label>Description</label>
            {isEditingDescription ? (
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                onBlur={() => setIsEditingDescription(false)}
                rows={5} // Increased rows for better editing experience
                placeholder="Add notes or details..."
                className="form-textarea"
                autoFocus
              />
            ) : (
              <div
                className="description-display"
                onClick={() => setIsEditingDescription(true)}
                title="Click to edit description"
              >
                {formData.description ? (
                  <ReactMarkdown
                    rehypePlugins={[rehypeRaw, [rehypeExternalLinks, { target: '_blank', rel: ['noopener', 'noreferrer'] }]]}
                  >
                    {formData.description}
                  </ReactMarkdown>
                ) : (
                  <em className="text-gray-500">Click to add description...</em>
                )}
              </div>
            )}
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
                onChange={e => setFormData({ ...formData, importance: e.target.value })}
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
                onChange={e => setFormData({ ...formData, urgency: e.target.value })}
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
              onChange={e => setFormData({ ...formData, context: e.target.value })}
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
                onChange={e => setFormData({ ...formData, timeEstimate: e.target.value })}
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
                onChange={e => setFormData({ ...formData, energyLevel: e.target.value })}
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
                onChange={e => setFormData({ ...formData, startDate: e.target.value })}
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
                onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
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
                  <button type="button" onClick={() => setFormData({ ...formData, parentId: null })} className="btn-tertiary">
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
                  onKeyDown={handleParentSearchKeyDown}
                  placeholder="Search for a new parent task..."
                  className="form-input"
                  autoFocus
                />
                <ul className="parent-suggestions">
                  {filteredParents.map((p, index) => (
                    <li
                      key={p.id}
                      className={index === highlightedParentIndex ? 'highlighted' : ''}
                      onClick={() => {
                        setFormData({ ...formData, parentId: p.id });
                        setParentSearch('');
                        setShowParentSearch(false);
                      }}
                      style={{ paddingLeft: `${p.level * 16 + 12}px` }}
                    >
                      {p.title}
                    </li>
                  ))}
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
                onChange={e => setFormData({ ...formData, isProject: e.target.checked })}
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
                onChange={e => setFormData({ ...formData, todayFocus: e.target.checked })}
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
      </div>
    </div>
  );
};

export default TaskDetailEditor;
