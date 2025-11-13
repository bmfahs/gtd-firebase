// gtd-pwa/src/components/KeyboardShortcuts.js
import React, { useEffect, useState } from 'react';
import { Keyboard, X } from 'lucide-react';
import './KeyboardShortcuts.css';

/**
 * Keyboard Shortcuts Component
 * Provides a help modal and manages global keyboard shortcuts
 */
const KeyboardShortcuts = ({ isOpen, onClose }) => {
  const shortcuts = [
    {
      category: 'Navigation',
      items: [
        { keys: ['g', 'i'], description: 'Go to Inbox' },
        { keys: ['g', 't'], description: 'Go to To Do' },
        { keys: ['g', 'a'], description: 'Go to All Tasks' },
        { keys: ['g', 'r'], description: 'Go to Recent' },
        { keys: ['j'], description: 'Move down (next task)' },
        { keys: ['k'], description: 'Move up (previous task)' },
        { keys: ['h'], description: 'Collapse current task' },
        { keys: ['l'], description: 'Expand current task' },
        { keys: ['Enter'], description: 'Open selected task details' },
      ]
    },
    {
      category: 'Task Management',
      items: [
        { keys: ['c'], description: 'Create new task (Quick Add)' },
        { keys: ['Shift', 'A'], description: 'Add subtask to selected task' },
        { keys: ['e'], description: 'Edit selected task' },
        { keys: ['x'], description: 'Toggle task completion' },
        { keys: ['d'], description: 'Delete selected task (with confirmation)' },
        { keys: ['m'], description: 'Move task (set parent)' },
        { keys: ['@'], description: 'Set context/label' },
        { keys: ['#'], description: 'Set due date' },
        { keys: ['1-5'], description: 'Set importance (1=low, 5=high)' },
        { keys: ['Shift', '1-5'], description: 'Set urgency (1=low, 5=high)' },
      ]
    },
    {
      category: 'Search & Filter',
      items: [
        { keys: ['/'], description: 'Focus search box' },
        { keys: ['Escape'], description: 'Clear search / Close dialogs' },
        { keys: ['f', 'a'], description: 'Filter: All tasks' },
        { keys: ['f', 'o'], description: 'Filter: Active only' },
        { keys: ['f', 'c'], description: 'Filter: Completed only' },
      ]
    },
    {
      category: 'Voice & AI',
      items: [
        { keys: ['v'], description: 'Toggle voice interface' },
        { keys: ['Ctrl/Cmd', 'Space'], description: 'Push to talk (while held)' },
        { keys: ['a', 'i'], description: 'AI task analysis' },
        { keys: ['a', 'r'], description: 'AI deep research' },
      ]
    },
    {
      category: 'General',
      items: [
        { keys: ['?'], description: 'Show this help dialog' },
        { keys: ['r'], description: 'Refresh task list' },
        { keys: ['s'], description: 'Save current task (in editor)' },
        { keys: ['Escape'], description: 'Cancel/Close current dialog' },
      ]
    }
  ];

  if (!isOpen) return null;

  return (
    <div className="shortcuts-overlay" onClick={onClose}>
      <div className="shortcuts-modal" onClick={e => e.stopPropagation()}>
        <div className="shortcuts-header">
          <div className="shortcuts-title">
            <Keyboard size={24} />
            <h2>Keyboard Shortcuts</h2>
          </div>
          <button onClick={onClose} className="shortcuts-close">
            <X size={20} />
          </button>
        </div>

        <div className="shortcuts-content">
          {shortcuts.map((section, idx) => (
            <div key={idx} className="shortcuts-section">
              <h3>{section.category}</h3>
              <div className="shortcuts-list">
                {section.items.map((item, itemIdx) => (
                  <div key={itemIdx} className="shortcut-item">
                    <div className="shortcut-keys">
                      {item.keys.map((key, keyIdx) => (
                        <React.Fragment key={keyIdx}>
                          <kbd className="shortcut-key">{key}</kbd>
                          {keyIdx < item.keys.length - 1 && (
                            <span className="shortcut-separator">
                              {item.keys.length === 2 && item.keys[0].length === 1 && item.keys[1].length === 1 
                                ? ' then ' 
                                : ' + '}
                            </span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                    <div className="shortcut-description">{item.description}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="shortcuts-footer">
            <p className="shortcuts-tip">
              💡 <strong>Tip:</strong> Press <kbd>?</kbd> anytime to show this dialog
            </p>
            <p className="shortcuts-note">
              Sequential keys (like <kbd>g</kbd> then <kbd>i</kbd>) should be pressed one after another, not simultaneously.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * useKeyboardShortcuts Hook
 * Manages keyboard shortcuts for the entire application
 */
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
  const [sequenceKey, setSequenceKey] = useState(null);
  const [sequenceTimeout, setSequenceTimeout] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in input/textarea
      if (
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.isContentEditable
      ) {
        // Allow Escape to blur
        if (e.key === 'Escape') {
          e.target.blur();
          return;
        }
        return;
      }

      // Prevent default for most shortcuts
      const shouldPreventDefault = () => {
        return !e.ctrlKey && !e.metaKey && e.key.length === 1 && e.key !== ' ';
      };

      // Handle sequence keys (g, f, a)
      if (sequenceKey) {
        clearTimeout(sequenceTimeout);
        handleSequence(sequenceKey, e.key);
        setSequenceKey(null);
        if (shouldPreventDefault()) e.preventDefault();
        return;
      }

      // Single key shortcuts
      switch (e.key.toLowerCase()) {
        // Navigation: g (starts sequence)
        case 'g':
          if (!e.ctrlKey && !e.metaKey) {
            setSequenceKey('g');
            const timeout = setTimeout(() => setSequenceKey(null), 1500);
            setSequenceTimeout(timeout);
            e.preventDefault();
          }
          break;

        // Filter: f (starts sequence)
        case 'f':
          if (!e.ctrlKey && !e.metaKey) {
            setSequenceKey('f');
            const timeout = setTimeout(() => setSequenceKey(null), 1500);
            setSequenceTimeout(timeout);
            e.preventDefault();
          }
          break;

        // AI: a (starts sequence)
        case 'a':
          if (!e.ctrlKey && !e.metaKey) {
            setSequenceKey('a');
            const timeout = setTimeout(() => setSequenceKey(null), 1500);
            setSequenceTimeout(timeout);
            e.preventDefault();
          }
          break;

        // Move down
        case 'j':
          if (flatTasks.length > 0) {
            const nextIndex = Math.min(selectedTaskIndex + 1, flatTasks.length - 1);
            setSelectedTaskIndex(nextIndex);
            scrollToTask(nextIndex);
          }
          e.preventDefault();
          break;

        // Move up
        case 'k':
          if (flatTasks.length > 0) {
            const prevIndex = Math.max(selectedTaskIndex - 1, 0);
            setSelectedTaskIndex(prevIndex);
            scrollToTask(prevIndex);
          }
          e.preventDefault();
          break;

        // Collapse
        case 'h':
          if (selectedTaskIndex >= 0 && flatTasks[selectedTaskIndex]) {
            onTaskAction('collapse', flatTasks[selectedTaskIndex]);
          }
          e.preventDefault();
          break;

        // Expand
        case 'l':
          if (selectedTaskIndex >= 0 && flatTasks[selectedTaskIndex]) {
            onTaskAction('expand', flatTasks[selectedTaskIndex]);
          }
          e.preventDefault();
          break;

        // Open task details
        case 'Enter':
          if (selectedTaskIndex >= 0 && flatTasks[selectedTaskIndex]) {
            onTaskAction('edit', flatTasks[selectedTaskIndex]);
          }
          e.preventDefault();
          break;

        // Create new task
        case 'c':
          onTaskAction('create');
          e.preventDefault();
          break;

        // Add subtask
        case 'A': // Shift+A
          if (e.shiftKey && selectedTaskIndex >= 0 && flatTasks[selectedTaskIndex]) {
            onTaskAction('addSubtask', flatTasks[selectedTaskIndex]);
          }
          e.preventDefault();
          break;

        // Edit task
        case 'e':
          if (selectedTaskIndex >= 0 && flatTasks[selectedTaskIndex]) {
            onTaskAction('edit', flatTasks[selectedTaskIndex]);
          }
          e.preventDefault();
          break;

        // Toggle completion
        case 'x':
          if (selectedTaskIndex >= 0 && flatTasks[selectedTaskIndex]) {
            onTaskAction('toggleComplete', flatTasks[selectedTaskIndex]);
          }
          e.preventDefault();
          break;

        // Delete task
        case 'd':
          if (selectedTaskIndex >= 0 && flatTasks[selectedTaskIndex]) {
            onTaskAction('delete', flatTasks[selectedTaskIndex]);
          }
          e.preventDefault();
          break;

        // Move task (set parent)
        case 'm':
          if (selectedTaskIndex >= 0 && flatTasks[selectedTaskIndex]) {
            onTaskAction('move', flatTasks[selectedTaskIndex]);
          }
          e.preventDefault();
          break;

        // Set context
        case '@':
          if (selectedTaskIndex >= 0 && flatTasks[selectedTaskIndex]) {
            onTaskAction('setContext', flatTasks[selectedTaskIndex]);
          }
          e.preventDefault();
          break;

        // Set due date
        case '#':
          if (selectedTaskIndex >= 0 && flatTasks[selectedTaskIndex]) {
            onTaskAction('setDueDate', flatTasks[selectedTaskIndex]);
          }
          e.preventDefault();
          break;

        // Set importance (1-5)
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
          if (selectedTaskIndex >= 0 && flatTasks[selectedTaskIndex]) {
            if (e.shiftKey) {
              // Shift+Number = Set urgency
              onTaskAction('setUrgency', flatTasks[selectedTaskIndex], parseInt(e.key));
            } else {
              // Number = Set importance
              onTaskAction('setImportance', flatTasks[selectedTaskIndex], parseInt(e.key));
            }
          }
          e.preventDefault();
          break;

        // Focus search
        case '/':
          if (searchInputRef?.current) {
            searchInputRef.current.focus();
          }
          e.preventDefault();
          break;

        // Toggle voice
        case 'v':
          onToggleVoice();
          e.preventDefault();
          break;

        // Refresh
        case 'r':
          if (!e.ctrlKey && !e.metaKey) {
            onRefresh();
            e.preventDefault();
          }
          break;

        // Show help
        case '?':
          setShowShortcutsHelp(true);
          e.preventDefault();
          break;

        // Escape (handled globally)
        case 'Escape':
          onTaskAction('cancel');
          break;

        default:
          break;
      }

      // Ctrl/Cmd+Space for push-to-talk
      if ((e.ctrlKey || e.metaKey) && e.key === ' ') {
        onTaskAction('pushToTalk', true);
        e.preventDefault();
      }
    };

    const handleKeyUp = (e) => {
      // Release push-to-talk
      if ((e.ctrlKey || e.metaKey) && e.key === ' ') {
        onTaskAction('pushToTalk', false);
      }
    };

    const handleSequence = (first, second) => {
      if (first === 'g') {
        // Go to views
        switch (second) {
          case 'i':
            setCurrentView('inbox');
            break;
          case 't':
            setCurrentView('todo');
            break;
          case 'a':
            setCurrentView('alltasks');
            break;
          case 'r':
            setCurrentView('recent');
            break;
        }
      } else if (first === 'f') {
        // Filters
        switch (second) {
          case 'a':
            setFilter('all');
            break;
          case 'o':
            setFilter('active');
            break;
          case 'c':
            setFilter('completed');
            break;
        }
      } else if (first === 'a') {
        // AI actions
        if (selectedTaskIndex >= 0 && flatTasks[selectedTaskIndex]) {
          switch (second) {
            case 'i':
              onTaskAction('aiAnalysis', flatTasks[selectedTaskIndex]);
              break;
            case 'r':
              onTaskAction('aiResearch', flatTasks[selectedTaskIndex]);
              break;
          }
        }
      }
    };

    const scrollToTask = (index) => {
      const taskElement = document.querySelector(`[data-task-index="${index}"]`);
      if (taskElement) {
        taskElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      if (sequenceTimeout) clearTimeout(sequenceTimeout);
    };
  }, [
    sequenceKey,
    selectedTaskIndex,
    flatTasks,
    currentView,
    setCurrentView,
    setSelectedTaskIndex,
    onTaskAction,
    onToggleVoice,
    onRefresh,
    searchInputRef,
    setFilter,
    setShowShortcutsHelp,
    sequenceTimeout
  ]);
};

export default KeyboardShortcuts;
