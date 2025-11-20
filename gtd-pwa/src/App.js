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
      task.children.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      task.children.forEach(sortChildren);
    }
  };
  tree.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  tree.forEach(sortChildren);

  return tree;
};



function App() {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const allowedEmail = process.env.REACT_APP_ALLOWED_EMAIL;
        if (allowedEmail && user.email !== allowedEmail) {
          console.warn(`Access denied for user: ${user.email}`);
          signOut(auth);
          setError(`Access Denied: You are not authorized to use this application. Allowed: ${allowedEmail}`);
          setUser(null);
          setTasks([]);
          setLoading(false);
          return;
        }

        setUser(user);
        fetchTasks(user);
      } else {
        setUser(null);
        setTasks([]);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    // Optionally, send analytics event with outcome of user choice
    console.log(`User response to the install prompt: ${outcome}`);
    // We've used the prompt, and can't use it again, discard it
    setDeferredPrompt(null);
  };

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
      // Don't filter completed trees here, let the UI handle it
      // const filteredTree = filterCompletedTrees(fullTaskTree);

      setTasks(fullTaskTree);
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
            {deferredPrompt && (
              <button onClick={handleInstallClick} className="install-button">
                Install App
              </button>
            )}
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
