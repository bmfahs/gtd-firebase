import React, { useState, useEffect, useRef } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Mic, MicOff, Volume2, AlertCircle } from 'lucide-react';

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
  const functionsRef = useRef(getFunctions());

  useEffect(() => {
    // Initialize Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false; // Process one command at a time
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onresult = (event) => {
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript;
      
      if (event.results[current].isFinal) {
        setTranscript('');
        handleVoiceCommand(transcript);
      } else {
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
      // Auto-restart if still in listening mode and not processing
      if (isListening && !isProcessing) {
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
  }, [isListening, isProcessing]);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setError(null);
      try {
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
      recognitionRef.current.stop();
      setIsListening(false);
      setTranscript('');
      speak('Voice assistant stopped.');
    }
  };

  const speak = (text, onEndCallback = null) => {
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
  };

  const handleVoiceCommand = async (command) => {
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
      const isDenied = /^(no|nope|nah|cancel|don't|stop)/i.test(command);

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
      // Call Cloud Function to process command
      const processCommand = httpsCallable(functionsRef.current, 'processVoiceCommand');
      const result = await processCommand({ command, context });

      if (!result.data.success) {
        throw new Error('Failed to process command');
      }

      const { response, action, data, needsConfirmation } = result.data;

      // Add AI response to history
      setConversationHistory([...newHistory, { 
        role: 'assistant', 
        content: response,
        timestamp: new Date().toISOString()
      }]);

      // Speak the response
      speak(response, () => {
        setIsProcessing(false);
      });

      // Handle the action
      if (needsConfirmation) {
        setPendingConfirmation({ action, data });
      } else if (action && action !== 'none') {
        await executeAction({ action, data });
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
  };

  const executeAction = async ({ action, data }) => {
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

      <style jsx>{`
        .voice-interface {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
          padding: 24px;
          width: 420px;
          max-height: 600px;
          overflow-y: auto;
          z-index: 1000;
        }

        .voice-header {
          margin-bottom: 16px;
        }

        .voice-header h3 {
          margin: 0 0 8px 0;
          font-size: 18px;
          font-weight: 600;
          color: #1f2937;
        }

        .error-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: #fee2e2;
          color: #dc2626;
          border-radius: 6px;
          font-size: 13px;
        }

        .voice-controls {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }

        .voice-button {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          border: none;
          background: #3b82f6;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }

        .voice-button:hover:not(:disabled) {
          background: #2563eb;
          transform: scale(1.05);
        }

        .voice-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .voice-button.active {
          background: #ef4444;
          animation: pulse-ring 1.5s infinite;
        }

        .voice-button.processing {
          background: #f59e0b;
        }

        @keyframes pulse-ring {
          0%, 100% { 
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3),
                        0 0 0 0 rgba(239, 68, 68, 0.7);
          }
          50% { 
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3),
                        0 0 0 15px rgba(239, 68, 68, 0);
          }
        }

        .speaking-indicator,
        .processing-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #3b82f6;
          font-size: 14px;
        }

        .pulse {
          animation: pulse 1s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .spinner {
          width: 20px;
          height: 20px;
          border: 3px solid #e5e7eb;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .transcript-display {
          margin-bottom: 16px;
          padding: 16px;
          background: #f3f4f6;
          border-radius: 8px;
          min-height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .transcript-display p {
          margin: 0;
          color: #4b5563;
          font-style: italic;
        }

        .confirmation-prompt {
          margin-bottom: 16px;
          padding: 12px;
          background: #fef3c7;
          border: 2px solid #f59e0b;
          border-radius: 8px;
          text-align: center;
        }

        .confirmation-prompt p {
          margin: 4px 0;
          font-size: 14px;
        }

        .conversation-history {
          margin-bottom: 16px;
        }

        .conversation-history h4 {
          margin: 0 0 12px 0;
          font-size: 14px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
        }

        .message {
          margin-bottom: 12px;
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 14px;
          position: relative;
        }

        .message.user {
          background: #dbeafe;
          margin-left: 20px;
        }

        .message.assistant {
          background: #f3f4f6;
          margin-right: 20px;
        }

        .message.error {
          background: #fee2e2;
          border: 1px solid #fecaca;
        }

        .message .role {
          font-weight: 600;
          margin-right: 8px;
          color: #374151;
        }

        .message .content {
          color: #1f2937;
        }

        .message .timestamp {
          display: block;
          margin-top: 4px;
          font-size: 11px;
          color: #9ca3af;
        }

        .empty-state {
          text-align: center;
          color: #9ca3af;
          font-size: 13px;
          padding: 20px;
        }

        .voice-tips {
          padding-top: 16px;
          border-top: 1px solid #e5e7eb;
        }

        .voice-tips h4 {
          margin: 0 0 8px 0;
          font-size: 13px;
          font-weight: 600;
          color: #6b7280;
        }

        .voice-tips ul {
          margin: 0;
          padding-left: 20px;
        }

        .voice-tips li {
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 4px;
        }

        /* Mobile responsive */
        @media (max-width: 768px) {
          .voice-interface {
            bottom: 10px;
            right: 10px;
            left: 10px;
            width: auto;
            max-height: 500px;
          }
        }
      `}</style>
    </div>
  );
};

export default VoiceInterface;
