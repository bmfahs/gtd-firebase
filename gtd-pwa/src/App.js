import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import './App.css';

// Recursive component to render a task and its children
const TaskItem = ({ task }) => {
  return (
    <li>
      {task.title}
      {task.children && task.children.length > 0 && (
        <ul>
          {task.children.map(child => (
            <TaskItem key={child.id} task={child} />
          ))}
        </ul>
      )}
    </li>
  );
};

// Utility to build the tree structure from the flat list
const buildTaskTree = (tasks) => {
  const taskMap = new Map();
  const tree = [];

  // Initialize map with tasks and empty children arrays
  tasks.forEach(task => {
    taskMap.set(task.id, { ...task, children: [] });
  });

  // Link children to their parents
  tasks.forEach(task => {
    const currentTask = taskMap.get(task.id);
    if (task.parentId) {
      const parentTask = taskMap.get(task.parentId);
      if (parentTask) {
        parentTask.children.push(currentTask);
      } else {
        // If parent not found (e.g., parent was filtered out), add to root
        tree.push(currentTask);
      }
    } else {
      // Root tasks
      tree.push(currentTask);
    }
  });

  // Sort root tasks and their children (optional, but good for consistent display)
  const sortChildren = (task) => {
    if (task.children && task.children.length > 0) {
      task.children.sort((a, b) => a.title.localeCompare(b.title));
      task.children.forEach(sortChildren);
    }
  };
  tree.sort((a, b) => a.title.localeCompare(b.title)); // Example sort by title
  tree.forEach(sortChildren);

  return tree;
};


// Utility to filter out branches with completed parents
const filterCompletedTrees = (tasks) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const filterNode = (task) => {
    // Check if the task itself is completed in the past
    if (task.completedDate && task.completedDate.toDate() < now) {
      return null; // This task and its entire branch will be removed
    }

    // If the task is not completed, recursively filter its children
    if (task.children && task.children.length > 0) {
      task.children = task.children.map(filterNode).filter(child => child !== null);
    }

    return task;
  };

  return tasks.map(filterNode).filter(task => task !== null);
};

function App() {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        fetchTasks(user); // Pass user to fetchTasks
      } else {
        setTasks([]); // Clear tasks on sign-out
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchTasks = async (user) => {
    setLoading(true);
    try {
      // Query for tasks belonging to the current user
      const tasksCollectionRef = collection(db, 'tasks');
      const q = query(tasksCollectionRef, where("userId", "==", user.uid));
      const querySnapshot = await getDocs(q);
      
      // 1. Fetch all tasks for the user
      const fetchedTasks = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // 2. Build the full tree
      const fullTaskTree = buildTaskTree(fetchedTasks);

      // 3. Filter the tree to remove completed branches
      const filteredTree = filterCompletedTrees(fullTaskTree);

      setTasks(filteredTree);

    } catch (err) {
      console.error("Error fetching tasks:", err);
      setError("Failed to load tasks. Check console for details.");
    } finally {
      setLoading(false);
    }
  };
  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in with Google:", error);
      setError("Failed to sign in with Google. Check console for details.");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
      setError("Failed to sign out. Check console for details.");
    }
  };

  if (loading) {
    return <div className="App">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="App">
        <header className="App-header">
          <h1>Welcome to GTD</h1>
          <button onClick={handleGoogleSignIn}>Sign In with Google</button>
        </header>
      </div>
    );
  }

  if (error) {
    return <div className="App" style={{ color: 'red' }}>Error: {error}</div>;
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>My GTD Tasks</h1>
        <button onClick={handleSignOut}>Sign Out</button>
        {tasks.length === 0 ? (
          <p>No tasks found in Firestore. Try importing some!</p>
        ) : (
          <ul>
            {tasks.map(task => (
              <TaskItem key={task.id} task={task} />
            ))}
          </ul>
        )}
      </header>
    </div>
  );
}

export default App;
