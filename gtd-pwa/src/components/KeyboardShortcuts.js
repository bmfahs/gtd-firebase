import React, { useEffect, useCallback } from 'react';

const shortcuts = [
  { keys: ['j'], description: 'Move selection down' },
  { keys: ['k'], description: 'Move selection up' },
  { keys: ['c'], description: 'Create a new task' },
  { keys: ['/'], description: 'Focus search input' },
  { keys: ['?'], description: 'Show this help dialog' },
  { keys: ['esc'], description: 'Close dialog / cancel' },
  { keys: ['v'], description: 'Toggle voice assistant' },
  { keys: ['r'], description: 'Refresh tasks' },
  { keys: ['g', 'i'], description: 'Go to Inbox' },
  { keys: ['g', 't'], description: 'Go to To Do list' },
  { keys: ['g', 'a'], description: 'Go to All Tasks' },
  { keys: ['g', 'r'], description: 'Go to Recent' },
  { keys: ['f', 'a'], description: 'Filter: All' },
  { keys: ['f', 'o'], description: 'Filter: Active (Open)' },
  { keys: ['f', 'c'], description: 'Filter: Completed' },
  { section: 'With a task selected:' },
  { keys: ['enter'], description: 'Toggle task completion' },
  { keys: ['o'], description: 'Open task details' },
  { keys: ['d'], description: 'Delete task' },
  { keys: ['Shift', 'A'], description: 'Add a subtask' },
  { keys: ['1-5'], description: 'Set importance (e.g., i 3)' },
  { keys: ['u', '1-5'], description: 'Set urgency (e.g., u 4)' },
];

import './KeyboardShortcuts.css';

const KeyboardShortcuts = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="keyboard-shortcuts-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Keyboard Shortcuts</h2>
          <button onClick={onClose} className="close-button">×</button>
        </div>
        <div className="shortcuts-list">
          {shortcuts.map((shortcut, index) => (
            shortcut.section ? (
              <h3 key={`section-${index}`} className="shortcut-section-header">{shortcut.section}</h3>
            ) : (
              <div key={index} className="shortcut-item">
                <div className="shortcut-keys">
                  {shortcut.keys.map(key => <kbd key={key}>{key}</kbd>)}
                </div>
                <div className="shortcut-description">{shortcut.description}</div>
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  );
};

export const useKeyboardShortcuts = ({
  currentView,
  setCurrentView,
  selectedTaskIndex,
  setSelectedTaskIndex,
  flatTasks,
  onTaskAction,
  onToggleVoice,
  onRefresh,
  searchInputRef,
  setFilter,
  setShowShortcutsHelp
}) => {
  const handleKeyDown = useCallback((event) => {
    // Ignore shortcuts if an input field is focused, unless it's Escape
    const activeElement = document.activeElement;
    const isInputFocused = ['INPUT', 'TEXTAREA'].includes(activeElement.tagName);

    if (isInputFocused && event.key !== 'Escape') {
      return;
    }

    const selectedTask = selectedTaskIndex !== -1 ? flatTasks[selectedTaskIndex] : null;

    switch (event.key) {
      case '?':
        event.preventDefault();
        setShowShortcutsHelp(true);
        break;
      case 'Escape':
        setShowShortcutsHelp(false);
        // You can add more 'cancel' actions here if needed
        break;
      case 'j':
        event.preventDefault();
        setSelectedTaskIndex(prev => Math.min(prev + 1, flatTasks.length - 1));
        break;
      case 'k':
        event.preventDefault();
        setSelectedTaskIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'c':
        event.preventDefault();
        onTaskAction('create');
        break;
      case '/':
        event.preventDefault();
        searchInputRef.current?.focus();
        break;
      case 'v':
        event.preventDefault();
        onToggleVoice();
        break;
      case 'r':
        event.preventDefault();
        onRefresh();
        break;
      case 'Enter':
        if (selectedTask) {
          event.preventDefault();
          onTaskAction('toggleComplete', selectedTask);
        }
        break;
      case 'o':
        if (selectedTask) {
          event.preventDefault();
          onTaskAction('edit', selectedTask);
        }
        break;
      case 'm':
        if (event.ctrlKey && selectedTask) {
          event.preventDefault();
          onTaskAction('move', selectedTask);
        }
        break;
      case 'd':
        if (selectedTask) {
          event.preventDefault();
          onTaskAction('delete', selectedTask);
        }
        break;
      case 'A':
        if (event.shiftKey && selectedTask) {
          event.preventDefault();
          onTaskAction('addSubtask', selectedTask);
        }
        break;
      // Simple two-key sequences
      case 'g':
      case 'f':
      case 'i':
      case 'u':
        // These would require a more complex state machine to handle sequences
        // For now, we'll keep it simple.
        break;
      default:
        break;
    }

    // Handle number keys for importance
    if (['1', '2', '3', '4', '5'].includes(event.key)) {
      if (selectedTask) {
        onTaskAction('setImportance', selectedTask, parseInt(event.key));
      }
    }

  }, [
    selectedTaskIndex,
    flatTasks,
    onTaskAction,
    setSelectedTaskIndex,
    onToggleVoice,
    onRefresh,
    searchInputRef,
    setShowShortcutsHelp
  ]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
};

export default KeyboardShortcuts;
