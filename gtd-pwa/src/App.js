import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import InteractiveGTDApp from './InteractiveGTDApp'; // We'll create this file
import './App.css';

// Utility to build the tree structure from the flat list
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

  const sortChildren = (task) => {
    if (task.children && task.children.length > 0) {
      task.children.sort((a, b) => a.title.localeCompare(b.title));
      task.children.forEach(sortChildren);
    }
  };
  tree.sort((a, b) => a.title.localeCompare(b.title));
  tree.forEach(sortChildren);

  return tree;
};

// Filter out completed trees (keep your existing logic)
const filterCompletedTrees = (tasks) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const filterNode = (task) => {
    if (task.completedDate && task.completedDate.toDate() < now) {
      return null;
    }

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
        fetchTasks(user);
      } else {
        setTasks([]);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchTasks = async (user) => {
    setLoading(true);
    try {
      const tasksCollectionRef = collection(db, 'tasks');
      const q = query(tasksCollectionRef, where("userId", "==", user.uid));
      const querySnapshot = await getDocs(q);
      
      const fetchedTasks = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      const fullTaskTree = buildTaskTree(fetchedTasks);
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
    return (
      <div className="App">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading your tasks...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="App">
        <header className="App-header">
          <div className="login-container">
            <h1>Welcome to GTD</h1>
            <p>Organize your tasks and get things done</p>
            <button onClick={handleGoogleSignIn} className="signin-button">
              Sign In with Google
            </button>
          </div>
        </header>
      </div>
    );
  }

  if (error) {
    return <div className="App error-message">Error: {error}</div>;
  }

  return (
    <div className="App">
      <nav className="top-nav">
        <div className="nav-content">
          <h2>GTD System</h2>
          <div className="nav-actions">
            <span className="user-email">{user.email}</span>
            <button onClick={handleSignOut} className="signout-button">
              Sign Out
            </button>
          </div>
        </div>
      </nav>
      
      <InteractiveGTDApp 
        user={user} 
        tasks={tasks} 
        onUpdate={() => fetchTasks(user)} 
      />
    </div>
  );
}

export default App;
