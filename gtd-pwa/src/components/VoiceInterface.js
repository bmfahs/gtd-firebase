import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getAuth, onAuthStateChanged, getIdToken } from 'firebase/auth';
import { Mic, MicOff, Volume2, AlertCircle } from 'lucide-react';
import './VoiceInterface.css'; // Import the new CSS file

const VoiceInterface = ({ user, tasks, onTaskUpdate }) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]);
  const [error, setError] = useState(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const recognitionRef = useRef(null);
  const synthesisRef = useRef(window.speechSynthesis);
  const idTokenRef = useRef(null);

  // Refs to hold the latest state values for use in event handlers
  const isListeningRef = useRef(isListening);
  const isProcessingRef = useRef(isProcessing);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const token = await getIdToken(user);
        idTokenRef.current = token;
      } else {
        idTokenRef.current = null;
      }
    });
    return () => unsubscribe();
  }, []);

  const speak = useCallback((text, onEndCallback = null) => {
    // Stop any current speech
    synthesisRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95; // Slightly slower for clarity
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.lang = 'en-US';

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      if (onEndCallback) onEndCallback();
    };
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      setIsSpeaking(false);
    };

    synthesisRef.current.speak(utterance);
  }, []); // No dependencies as it only uses refs and setState setters

  const executeAction = useCallback(async ({ action, data }) => {
    try {
      switch (action) {
        case 'add_task':
          await onTaskUpdate({ type: 'add', data });
          speak('Task added successfully.');
          break;
          
        case 'update_task':
          await onTaskUpdate({ type: 'update', data });
          speak('Task updated.');
          break;
          
        case 'complete_task':
          await onTaskUpdate({ type: 'complete', data });
          speak('Task marked as complete.');
          break;
          
        case 'delete_task':
          await onTaskUpdate({ type: 'delete', data });
          speak('Task deleted.');
          break;
          
        case 'query_tasks':
          // Response is already spoken by the AI
          break;
          
        case 'research':
          speak('I\'ll research that topic and get back to you.');
          // Trigger deep research (could be async)
          break;
          
default:
          console.log('Unknown action:', action);
      }
    } catch (error) {
      console.error('Error executing action:', error);
      speak('Sorry, I encountered an error executing that action.');
    }
  }, [onTaskUpdate, speak]); // Dependencies: onTaskUpdate, speak

  const handleVoiceCommand = useCallback(async (command) => {
    console.log('Voice command received:', command);
    setIsProcessing(true);
    
    // Add to conversation history
    const newHistory = [...conversationHistory, { 
      role: 'user', 
      content: command,
      timestamp: new Date().toISOString()
    }];
    setConversationHistory(newHistory);

    // Check if this is a confirmation response
    if (pendingConfirmation) {
      const isConfirmed = /^(yes|yeah|yep|sure|ok|okay|correct|right|confirm|do it|proceed)/i.test(command);
      const isDenied = /^(no|nope|nah|cancel|stop)/i.test(command);

      if (isConfirmed) {
        await executeAction(pendingConfirmation);
        setPendingConfirmation(null);
        setIsProcessing(false);
        return;
      } else if (isDenied) {
        speak('Okay, I\'ve cancelled that action.');
        setPendingConfirmation(null);
        setIsProcessing(false);
        return;
      }
    }

    // Build context for AI
    const context = {
      tasks: tasks.slice(0, 20).map(t => ({
        id: t.id,
        title: t.title,
        context: t.context,
        status: t.status,
        importance: t.importance,
        urgency: t.urgency,
        parentId: t.parentId
      })),
      recentActions: conversationHistory.slice(-5),
      currentTime: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      preferences: {
        contexts: Array.from(new Set(tasks.map(t => t.context).filter(Boolean)))
      }
    };

    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;

      if (!currentUser) {
        throw new Error('User not authenticated.');
      }

      const freshIdToken = await currentUser.getIdToken(true); // Force refresh token

      const response = await fetch('https://us-central1-personal-gtd-ea76d.cloudfunctions.net/processVoiceCommand', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${freshIdToken}` // Use the fresh token
        },
        body: JSON.stringify({ data: { command, context } })
      });

      if (!response.ok) {
        throw new Error('Failed to process command');
      }

      const result = await response.json();
      const { data } = result;

      if (!data.success) {
        throw new Error('Failed to process command');
      }

      const { response: responseText, action, data: actionData, needsConfirmation } = data;

      // Add AI response to history
      setConversationHistory([...newHistory, { 
        role: 'assistant', 
        content: responseText,
        timestamp: new Date().toISOString()
      }]);

      // Speak the response
      speak(responseText, () => {
        setIsProcessing(false);
      });

      // Handle the action
      if (needsConfirmation) {
        setPendingConfirmation({ action, data: actionData });
      } else if (action && action !== 'none') {
        await executeAction({ action, data: actionData });
      }

    } catch (error) {
      console.error('Error processing voice command:', error);
      const errorMessage = "I'm sorry, I had trouble processing that command. Could you try again?";
      
      setConversationHistory([...newHistory, { 
        role: 'assistant', 
        content: errorMessage,
        timestamp: new Date().toISOString(),
        error: true
      }]);
      
      speak(errorMessage, () => {
        setIsProcessing(false);
      });
    }
  }, [conversationHistory, pendingConfirmation, executeAction, speak, setIsProcessing, setConversationHistory, setPendingConfirmation, tasks]); // Dependencies

  useEffect(() => {
    // Initialize Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    console.log('Speech recognition object created:', recognitionRef.current);
    recognitionRef.current.continuous = false; // Process one command at a time
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onresult = (event) => {
      console.log('onresult event:', event);
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript;
      
      if (event.results[current].isFinal) {
        console.log('Final transcript:', transcript);
        setTranscript('');
        handleVoiceCommand(transcript);
      } else {
        console.log('Interim transcript:', transcript);
        setTranscript(transcript);
      }
    };

    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      
      if (event.error === 'no-speech') {
        setError('No speech detected. Please try again.');
      } else if (event.error === 'audio-capture') {
        setError('Microphone not accessible. Please check permissions.');
      } else {
        setError(`Speech recognition error: ${event.error}`);
      }
    };

    recognitionRef.current.onend = () => {
      console.log('onend event. isListening:', isListeningRef.current, 'isProcessing:', isProcessingRef.current);
      // Auto-restart if still in listening mode and not processing
      if (isListeningRef.current && !isProcessingRef.current) {
        try {
          recognitionRef.current.start();
        } catch (err) {
          console.log('Recognition restart failed:', err);
        }
      }
    };

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [handleVoiceCommand]); // Only handleVoiceCommand as a dependency

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setError(null);
      try {
        console.log('Starting speech recognition');
        recognitionRef.current.start();
        setIsListening(true);
        speak('I\'m listening. How can I help you?');
      } catch (err) {
        setError('Could not start microphone. Please check permissions.');
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      console.log('Stopping speech recognition');
      recognitionRef.current.stop();
      setIsListening(false);
      setTranscript('');
      speak('Voice assistant stopped.');
    }
  };

  return (
    <div className="voice-interface">
      <div className="voice-header">
        <h3>Voice Assistant</h3>
        {error && (
          <div className="error-banner">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="voice-controls">
        <button
          onClick={isListening ? stopListening : startListening}
          className={`voice-button ${isListening ? 'active' : ''} ${isProcessing ? 'processing' : ''}`}
          disabled={isSpeaking || isProcessing}
          title={isListening ? 'Stop listening' : 'Start listening'}
        >
          {isListening ? <MicOff size={32} /> : <Mic size={32} />}
        </button>
        
        {isSpeaking && (
          <div className="speaking-indicator">
            <Volume2 size={24} className="pulse" />
            <span>Speaking...</span>
          </div>
        )}

        {isProcessing && !isSpeaking && (
          <div className="processing-indicator">
            <div className="spinner" />
            <span>Processing...</span>
          </div>
        )}
      </div>

      {isListening && (
        <div className="transcript-display">
          <p>{transcript || 'Listening...'}</p>
        </div>
      )}

      {pendingConfirmation && (
        <div className="confirmation-prompt">
          <p>⚠️ Waiting for confirmation...</p>
          <p>Say "yes" to proceed or "no" to cancel</p>
        </div>
      )}

      <div className="conversation-history">
        <h4>Recent Conversation</h4>
        {conversationHistory.slice(-6).map((msg, idx) => (
          <div key={idx} className={`message ${msg.role} ${msg.error ? 'error' : ''}`}>
            <span className="role">{msg.role === 'user' ? 'You' : 'Assistant'}:</span>
            <span className="content">{msg.content}</span>
            <span className="timestamp">
              {new Date(msg.timestamp).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
          </div>
        ))}
        {conversationHistory.length === 0 && (
          <p className="empty-state">No conversation yet. Click the microphone to start.</p>
        )}
      </div>

      <div className="voice-tips">
        <h4>💡 Voice Commands</h4>
        <ul>
          <li>"Add task to buy groceries at the store"</li>
          <li>"What do I need to do at home?"</li>
          <li>"Mark review document as complete"</li>
          <li>"Show me my urgent tasks"</li>
          <li>"Research best practices for project management"</li>
        </ul>
      </div>
    </div>
  );
};

export default VoiceInterface;