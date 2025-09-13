// frontend/src/App.js
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

// --- Main Chat Page Component ---
const ChatPage = ({ setToken }) => {
    const [conversations, setConversations] = useState([]);
    const [activeConversationId, setActiveConversationId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

    // Fetch all conversation titles when the component mounts
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

    // Fetch messages for the active conversation
    useEffect(() => {
        const fetchMessages = async () => {
            if (!activeConversationId) {
                setMessages([]);
                return;
            };
            const token = localStorage.getItem('token');
            try {
                const res = await axios.get(`${API_BASE_URL}/chat/messages/${activeConversationId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setMessages(res.data);
            } catch (err) {
                console.error("Failed to fetch messages", err);
                setMessages([]);
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
        setInput('');
        setIsLoading(true);

        const token = localStorage.getItem('token');
        try {
            const res = await axios.post(`${API_BASE_URL}/chat/new`, 
                { message: input, conversationId: activeConversationId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            setMessages(prev => [...prev, res.data.assistantMessage]);
            
            // If a new conversation was created, refresh the list and set it as active
            if(res.data.newConversation) {
                setConversations(prev => [res.data.newConversation, ...prev]);
                setActiveConversationId(res.data.newConversation._id);
            }
        } catch (err) {
            console.error("Failed to send message", err);
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
                    <h2>Cogni-Compliance</h2>
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
                    {messages.map((msg, index) => (
                        <div key={index} className={`message ${msg.role}`}>
                            <p>{msg.content}</p>
                        </div>
                    ))}
                    {isLoading && <div className="message assistant"><p>Thinking...</p></div>}
                    <div ref={messagesEndRef} />
                </div>
                <form onSubmit={handleSend} className="chat-input-form">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask a question..."
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
