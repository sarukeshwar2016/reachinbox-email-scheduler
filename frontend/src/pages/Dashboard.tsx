import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LogOut, Plus, Clock, Send, MessageSquare, Search } from 'lucide-react';
import ComposeEmailModal from '../components/ComposeEmailModal';

axios.defaults.withCredentials = true;

const Dashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [slackConnected, setSlackConnected] = useState(false);
  
  // Data States
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch User
    axios.get('http://localhost:5000/api/auth/me')
      .then((res) => setUser(res.data.data))
      .catch(() => {
        window.location.href = '/login';
      });

    // Fetch Slack status
    axios.get('http://localhost:5000/api/slack/status')
      .then((res) => setSlackConnected(res.data.data.connected))
      .catch(console.error);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === 'scheduled' ? '/scheduled' : '/sent';
      const res = await axios.get(`http://localhost:5000/api/emails${endpoint}`);
      setEmails(res.data.data.emails);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, activeTab]);

  const handleLogout = async () => {
    await axios.post('http://localhost:5000/api/auth/logout');
    window.location.href = '/login';
  };

  const handleSlackConnect = () => {
    window.location.href = 'http://localhost:5000/api/slack/connect';
  };

  const handleSlackDisconnect = async () => {
    await axios.post('http://localhost:5000/api/slack/disconnect');
    setSlackConnected(false);
  };

  if (!user) return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-8">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-tight uppercase">ONE</h1>
          <div className="relative w-64 ml-8">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search" 
              className="w-full bg-[#F5F5F5] border-none rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <button 
            onClick={slackConnected ? handleSlackDisconnect : handleSlackConnect}
            className={`flex items-center gap-2 text-sm font-medium ${slackConnected ? 'text-green-600' : 'text-gray-500'}`}
          >
            <MessageSquare className="w-4 h-4" />
            {slackConnected ? 'Slack Connected' : 'Connect Slack'}
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
              {user.avatarUrl && <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium leading-none">{user.name}</span>
              <span className="text-xs text-gray-500 mt-1">{user.email}</span>
            </div>
            <button onClick={handleLogout} className="ml-4 text-gray-400 hover:text-gray-600">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col p-4">
          <button 
            onClick={() => setIsComposeOpen(true)}
            className="w-full bg-white border border-primary text-primary font-medium py-2.5 rounded-full flex items-center justify-center gap-2 mb-8 hover:bg-green-50 transition-colors"
          >
            <Plus className="w-4 h-4" /> Compose
          </button>

          <nav className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-3">Core</span>
            
            <button 
              onClick={() => setActiveTab('scheduled')}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'scheduled' ? 'bg-[#E8F5EE] text-primary' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4" />
                Scheduled
              </div>
            </button>

            <button 
              onClick={() => setActiveTab('sent')}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'sent' ? 'bg-[#E8F5EE] text-primary' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <div className="flex items-center gap-3">
                <Send className="w-4 h-4" />
                Sent
              </div>
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-white p-8">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-500">Loading emails...</div>
          ) : emails.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <div className="text-lg mb-2">No emails found</div>
              <p className="text-sm">You have no {activeTab} emails.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {emails.map((email) => (
                <div key={email.id} className="flex items-center justify-between p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer group">
                  <div className="flex-1 grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-3 text-sm font-medium text-gray-900 truncate">
                      To: {email.recipient}
                    </div>
                    <div className="col-span-7 flex items-center gap-2 truncate">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${email.status === 'scheduled' ? 'bg-orange-100 text-orange-600' : email.status === 'sent' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {email.status.charAt(0).toUpperCase() + email.status.slice(1)}
                      </span>
                      <span className="text-sm text-gray-600 truncate">{email.subject}</span>
                      <span className="text-sm text-gray-400 truncate">- {email.body.substring(0, 40)}...</span>
                    </div>
                    <div className="col-span-2 text-right text-xs text-gray-500">
                      {new Date(email.scheduledAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {isComposeOpen && (
        <ComposeEmailModal onClose={() => { setIsComposeOpen(false); fetchData(); }} />
      )}
    </div>
  );
};

export default Dashboard;
