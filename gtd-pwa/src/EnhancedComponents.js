import React, { useState } from 'react';
import { db } from './firebase';
import { doc, updateDoc, addDoc, collection, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { 
  CheckCircle, Circle, Plus, Edit2, Trash2, GripVertical, 
  ChevronRight, ChevronDown, FolderOpen, Folder, FileText,
  Calendar, Clock, Zap, Star, Tag
} from 'lucide-react';

// Task Detail Editor Modal
const TaskDetailEditor = ({ task, onClose, onSave, allContexts }) => {
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
    todayFocus: task.todayFocus || false
  });

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
          .enhanced-modal {
            max-width: 600px;
            max-height: 90vh;
            overflow-y: auto;
          }

          .task-form {
            padding: 20px;
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
            ring: 2px solid #dbeafe;
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
            padding-top: 16px;
            border-top: 1px solid #e5e7eb;
          }

          .btn-primary, .btn-secondary {
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
        `}</style>
      </div>
    </div>
  );
};

export default TaskDetailEditor;
