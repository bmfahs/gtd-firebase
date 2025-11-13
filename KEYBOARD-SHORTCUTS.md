# GTD System - Keyboard Shortcuts Reference

## Overview

Your GTD app includes comprehensive keyboard shortcuts inspired by Gmail and MyLifeOrganized (MLO) to enable efficient, keyboard-only navigation and task management.

## Quick Reference

Press `?` anytime to show the keyboard shortcuts help dialog.

---

## Navigation Shortcuts

### View Navigation (Gmail-style "g then" sequences)

| Shortcut | Action | Description |
|----------|--------|-------------|
| `g` then `i` | Go to Inbox | Switch to Inbox view |
| `g` then `t` | Go to To Do | Switch to To Do (flat, priority-sorted) view |
| `g` then `a` | Go to All Tasks | Switch to All Tasks (hierarchical) view |
| `g` then `r` | Go to Recent | Switch to Recent tasks view |

**How it works**: Press `g`, then within 1.5 seconds, press the second key. Visual indicator shows you're in "sequence mode".

### Task Navigation (Vim-style)

| Shortcut | Action | Description |
|----------|--------|-------------|
| `j` | Move Down | Select next task in list |
| `k` | Move Up | Select previous task in list |
| `h` | Collapse | Collapse selected task's subtasks |
| `l` | Expand | Expand selected task's subtasks |
| `Enter` | Open | Open task detail editor for selected task |

**Visual feedback**: Selected task is highlighted with blue border and left accent.

---

## Task Management Shortcuts

### Creating & Editing Tasks

| Shortcut | Action | Description |
|----------|--------|-------------|
| `c` | Create Task | Focus Quick Add input to create new task |
| `Shift` + `A` | Add Subtask | Add a child task to selected task |
| `e` | Edit Task | Open detailed editor for selected task |
| `s` | Save | Save current task (when in editor) |
| `Escape` | Cancel | Cancel current operation or close dialog |

### Task Actions

| Shortcut | Action | Description |
|----------|--------|-------------|
| `x` | Toggle Complete | Mark task as done/incomplete |
| `d` | Delete Task | Delete selected task (with confirmation) |
| `m` | Move Task | Change parent task (set new location in hierarchy) |

### Setting Task Properties

| Shortcut | Action | Description |
|----------|--------|-------------|
| `1` - `5` | Set Importance | Set importance level (1=low, 5=high) |
| `Shift` + `1-5` | Set Urgency | Set urgency level (1=low, 5=high) |
| `@` | Set Context | Open context/label selector |
| `#` | Set Due Date | Open due date picker |

**Example workflow**:
1. Press `j` or `k` to select a task
2. Press `4` to set importance to 4
3. Press `Shift` + `5` to set urgency to 5
4. Press `@` to add context like "@office"

---

## Search & Filter Shortcuts

### Search

| Shortcut | Action | Description |
|----------|--------|-------------|
| `/` | Focus Search | Jump to search box to filter tasks |
| `Escape` | Clear Search | Clear search and unfocus search box |

### Filter (Gmail-style sequences)

| Shortcut | Action | Description |
|----------|--------|-------------|
| `f` then `a` | Filter All | Show all tasks |
| `f` then `o` | Filter Active | Show only active (incomplete) tasks |
| `f` then `c` | Filter Completed | Show only completed tasks |

---

## Voice & AI Shortcuts

### Voice Control

| Shortcut | Action | Description |
|----------|--------|-------------|
| `v` | Toggle Voice | Show/hide voice assistant interface |
| `Ctrl/Cmd` + `Space` | Push to Talk | Hold to record voice command |

**Voice command examples**:
- "Add task to review budget report"
- "Show me urgent tasks"
- "Mark review document as complete"

### AI Features (requires task selection)

| Shortcut | Action | Description |
|----------|--------|-------------|
| `a` then `i` | AI Analysis | Get AI task breakdown and suggestions |
| `a` then `r` | AI Research | Conduct deep research on task topic |

**Example workflow**:
1. Press `j/k` to select "Launch marketing campaign"
2. Press `a` then `r` for AI research
3. Review AI-generated strategy and subtasks

---

## General Shortcuts

| Shortcut | Action | Description |
|----------|--------|-------------|
| `?` | Show Help | Display keyboard shortcuts reference |
| `r` | Refresh | Reload task list from server |

---

## Tips & Best Practices

### Efficient Task Creation

**Quick workflow**:
```
1. Press 'c' to start creating task
2. Type task title
3. Tab to context field, type "@home"
4. Tab to time field, type "30"
5. Press Enter to save
```

### Keyboard-Only Task Management

**Process inbox workflow**:
```
1. Press 'g' then 'i' to go to Inbox
2. Press 'j' to select first task
3. Press '4' for importance
4. Press 'Shift+5' for urgency
5. Press '@' to set context
6. Press 'x' to complete
7. Press 'j' to move to next
```

### Power User Pattern

**Complete daily review without mouse**:
```
1. g → t          (Go to To Do)
2. f → o          (Filter active only)
3. j/k            (Navigate through tasks)
4. x              (Complete finished tasks)
5. e              (Edit for details if needed)
6. g → r          (Check recent activity)
```

---

## Keyboard Shortcuts in Different Contexts

### When Task is Selected
- All task management shortcuts are available
- Selected task shows blue highlight
- Press `Escape` to deselect

### When in Search Box
- Type to search
- Press `Escape` to clear and unfocus
- Press `Enter` to keep search and move focus to tasks

### When in Task Editor
- `Tab` to move between fields
- `s` to save changes
- `Escape` to cancel without saving
- Arrow keys to navigate dropdowns

### When Adding Subtask
- Type title and press `Enter` to save
- `Escape` to cancel
- Automatically returns focus to parent task

---

## MLO-Inspired Features

These shortcuts are specifically inspired by MyLifeOrganized:

| MLO Feature | GTD Shortcut | Notes |
|-------------|--------------|-------|
| Quick Entry | `c` | Quick Add with inline context/time |
| Importance Stars | `1-5` | Direct numeric input |
| Urgency Levels | `Shift + 1-5` | Shift modifier for urgency |
| Context Tags | `@` | Type context like "@calls" |
| Hierarchy Navigation | `h` / `l` | Collapse/expand branches |
| Move Task | `m` | Change parent (set location) |

---

## Gmail-Inspired Features

These shortcuts are inspired by Gmail's keyboard navigation:

| Gmail Feature | GTD Shortcut | Notes |
|---------------|--------------|-------|
| Go to... | `g` then `i/t/a/r` | Two-key sequences for views |
| Filter by... | `f` then `a/o/c` | Quick filter switching |
| Search | `/` | Jump to search |
| Archive (Complete) | `x` | Mark as done |
| Navigation | `j` / `k` | Move through list |

---

## Accessibility Features

### Keyboard-Only Operation
- Entire app is fully operable without mouse
- Clear visual indicators for selected items
- Focus management handles dialog opening/closing

### Visual Feedback
- Selected task: Blue border + left accent bar
- Sequence mode: Floating indicator shows waiting key
- Hover states show available actions

### Screen Reader Support
- All interactive elements have ARIA labels
- Keyboard shortcuts announced in help dialog
- Status updates provided for task actions

---

## Customization

### Adding Custom Shortcuts

Edit `gtd-pwa/src/components/KeyboardShortcuts.js`:

```javascript
// In handleKeyDown function, add:
case 'n': // Your custom key
  if (!e.ctrlKey && !e.metaKey) {
    onTaskAction('yourCustomAction');
    e.preventDefault();
  }
  break;
```

### Disabling Shortcuts

Shortcuts are automatically disabled when typing in:
- Input fields
- Textareas  
- Contenteditable elements

Press `Escape` to exit input and re-enable shortcuts.

---

## Troubleshooting

### Shortcuts Not Working

**Check**:
1. Are you focused in an input field? Press `Escape` first
2. Is a dialog open? Close with `Escape` or click X
3. Did you wait for sequence timeout? Try the sequence again

### Sequence Keys Timing Out

- You have 1.5 seconds to complete a sequence
- Look for the floating "Waiting for key" indicator
- Practice the rhythm: `g` (pause) `i` (not too fast, not too slow)

### Conflicts with Browser Shortcuts

Some shortcuts may conflict with browser defaults:
- `Ctrl+S` / `Cmd+S` - Browser save (we use just `s`)
- `/` - Quick find in some browsers (we use it for search)

**Solution**: Use the app in fullscreen mode or as PWA to avoid conflicts.

---

## Printable Cheat Sheet

```
NAVIGATION          TASK MANAGEMENT       PROPERTIES
g→i   Inbox        c     Create task     1-5    Set importance  
g→t   To Do        e     Edit task       ⇧1-5   Set urgency
g→a   All Tasks    x     Complete        @      Set context
g→r   Recent       d     Delete          #      Set due date
j     Next task    ⇧A    Add subtask     m      Move task
k     Prev task    
h     Collapse     SEARCH & FILTER       VOICE & AI
l     Expand       /     Search          v      Toggle voice
⏎     Open task    f→a   All             a→i    AI analyze
                   f→o   Active          a→r    AI research
                   f→c   Completed
```

---

## Getting Started

### First-Time Setup
1. Press `?` to open shortcuts help
2. Try `g` then `i` to navigate to Inbox  
3. Press `c` to create your first task
4. Use `j` and `k` to navigate
5. Practice the sequences until they feel natural

### Daily Workflow Example
```
Morning Review:
g→i          Open inbox
j/k          Review tasks
4, ⇧5, @     Set priority and context
x            Complete easy wins

Planning:
g→t          Open to-do list
j/k          Navigate priorities
e            Edit important tasks
a→i          Get AI task breakdown

End of Day:
g→r          Review recent activity
g→t          Check tomorrow's priorities
```

---

## Advanced Patterns

### Batch Processing Tasks

**Mark multiple completed**:
```
1. g → t
2. f → a
3. j → x → j → x → j → x
   (navigate + complete + next)
```

### Research & Planning

**Deep dive on project**:
```
1. / "project launch"
2. j (select task)
3. a → r (AI research)
4. e (open editor)
5. ⇧A (add subtasks from research)
```

### Context Switching

**Switch contexts quickly**:
```
1. @ (open context selector)
2. Type context
3. ⏎ (save)
4. j (next task)
5. Repeat
```

---

## Keyboard Shortcuts Philosophy

Our shortcuts follow these principles:

1. **Mnemonic**: `c` for create, `e` for edit, `d` for delete
2. **Consistent**: Same patterns across views
3. **Efficient**: Most actions are 1-2 keys
4. **Discoverable**: Help dialog always available (`?`)
5. **Familiar**: Based on Gmail and MLO patterns
6. **Conflict-free**: Don't override essential browser shortcuts

---

## Support

### Learning Resources
- Press `?` for in-app help
- Practice in Inbox view (low stakes)
- Start with navigation (`j`/`k`) before advanced features
- Keyboard hints show on hover in UI

### Getting Help
If shortcuts aren't working as expected:
1. Check browser console for errors
2. Verify you're not in an input field
3. Try refreshing the page
4. Report issues with specific key combinations

---

**Last Updated**: 2025-11-12  
**Version**: 1.0.0

**Ready to get started? Press `?` to open the shortcuts help!** 🚀
