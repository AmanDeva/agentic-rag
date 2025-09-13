// frontend/src/App.js
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const ChatPage = ({ setToken }) => {
    const [conversations, setConversations] = useState([]);
    const [activeConversationId, setActiveConversationId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const fetchConversations = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get(`${API_BASE_URL}/chat/conversations`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setConversations(res.data);
        } catch (error) {
            console.error("Failed to fetch conversations", error);
        }
    };

    useEffect(() => {
        fetchConversations();
    }, []);

    useEffect(() => {
        const fetchMessages = async () => {
            if (!activeConversationId) {
                setMessages([]);
                return;
            };
            setIsLoading(true);
            const token = localStorage.getItem('token');
            try {
                const res = await axios.get(`${API_BASE_URL}/chat/messages/${activeConversationId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setMessages(res.data);
            } catch (err) {
                console.error("Failed to fetch messages", err);
                setMessages([]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchMessages();
    }, [activeConversationId]);

    useEffect(scrollToBottom, [messages, isLoading]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        const currentInput = input;
        setInput('');
        setIsLoading(true);

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_BASE_URL}/chat/new`,
                { message: currentInput, conversationId: activeConversationId },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // This logic correctly updates the message list after getting the real response
            setMessages(prev => [...prev.slice(0, -1), userMessage, res.data.assistantMessage]);

            if(res.data.newConversation) {
                // If a new conversation was created, refresh the list and set it as active
                setConversations(prev => [res.data.newConversation, ...prev]);
                setActiveConversationId(res.data.newConversation._id);
            }
        } catch (err) {
            console.error("Failed to send message", err);
            const errorMessage = { role: 'assistant', content: 'Sorry, I had trouble connecting to the agent. The EC2 server may be offline.' };
            setMessages(prev => [...prev.slice(0, -1), userMessage, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleNewChat = () => {
        setActiveConversationId(null);
        setMessages([]);
    }

    const handleLogout = () => {
        localStorage.removeItem('token');
        setToken(null);
    }

    return (
        <div className="chat-container">
            <div className="sidebar">
                <div>
                    <h2 className="sidebar-title">Cogni-Compliance</h2>
                    <button onClick={handleNewChat} className="new-chat-button">+ New Chat</button>
                    <div className="conversations-list">
                        {conversations.map(convo => (
                            <div
                                key={convo._id}
                                className={`conversation-item ${activeConversationId === convo._id ? 'active' : ''}`}
                                onClick={() => setActiveConversationId(convo._id)}
                            >
                                {convo.title}
                            </div>
                        ))}
                    </div>
                </div>
                <button onClick={handleLogout} className="logout-button">Logout</button>
            </div>
            <div className="chat-window">
                <div className="messages">
                    {/* ===== UPDATED WELCOME MESSAGE SECTION ===== */}
                    {messages.length === 0 && !isLoading && !activeConversationId && (
                        <div className="welcome-container">
                            <h1 className="welcome-title">Cogni-Compliance Agent</h1>
                            <p className="welcome-subtitle">Your AI assistant for navigating legal and regulatory documents.</p>
                            <div className="info-box">
                                <p>This is a full-stack application featuring a Retrieval-Augmented Generation (RAG) agent. Ask a question, and the agent will retrieve relevant information from its knowledge base (GDPR, CCPA, HIPAA) to generate a grounded answer.</p>
                            </div>
                            <div className="status-note">
                                <p><strong>Server Status:</strong> The live AI backend on the AWS EC2 server is currently stopped to save costs. If you would like to see a live demo, please contact me at: <a href="mailto:devaaman8@gmail.com">devaaman8@gmail.com</a></p>
                            </div>
                        </div>
                    )}
                    {/* ======================================= */}

                    {messages.map((msg, index) => (
                        <div key={msg._id || index} className={`message-bubble ${msg.role}`}>
                            <p>{msg.content}</p>
                        </div>
                    ))}
                    {isLoading && <div className="message-bubble assistant"><p>Thinking...</p></div>}
                    <div ref={messagesEndRef} />
                </div>
                <form onSubmit={handleSend} className="chat-input-form">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask a question about GDPR, CCPA, or HIPAA..."
                        disabled={isLoading}
                    />
                    <button type="submit" disabled={isLoading || !input.trim()}>Send</button>
                </form>
            </div>
        </div>
    );
};

// --- Login/Signup Page Component (No changes needed) ---
const AuthPage = ({ setToken }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const url = `${API_BASE_URL}/auth/${isLogin ? 'login' : 'signup'}`;
        try {
            const res = await axios.post(url, { username, password });
            if (isLogin) {
                localStorage.setItem('token', res.data.token);
                setToken(res.data.token);
            } else {
                setError('Signup successful! Please login.');
                setUsername('');
                setPassword('');
                setIsLogin(true);
            }
        } catch (err) {
            setError(isLogin ? 'Invalid credentials' : 'Username might already exist.');
        }
    };
    return (
        <div className="auth-container">
            <form onSubmit={handleSubmit} className="auth-form">
                <h2>{isLogin ? 'Login' : 'Sign Up'}</h2>
                {error && <p className="error">{error}</p>}
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" required />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required />
                <button type="submit">{isLogin ? 'Login' : 'Sign Up'}</button>
                <p onClick={() => {setIsLogin(!isLogin); setError('')}} className="toggle-auth">
                    {isLogin ? 'Need an account? Sign Up' : 'Already have an account? Login'}
                </p>
            </form>
        </div>
    );
};

// --- Main App Component ---
function App() {
    const [token, setToken] = useState(localStorage.getItem('token'));
    if (!token) { return <AuthPage setToken={setToken} />; }
    return <ChatPage setToken={setToken} />;
}

export default App;