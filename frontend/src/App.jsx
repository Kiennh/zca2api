import React, { useState, useMemo } from 'react';
import { Button } from '@openai/apps-sdk-ui/components/Button';
import { Input } from '@openai/apps-sdk-ui/components/Input';
import { Textarea } from '@openai/apps-sdk-ui/components/Textarea';
import { Select } from '@openai/apps-sdk-ui/components/Select';
import { Badge } from '@openai/apps-sdk-ui/components/Badge';
import { Send, RefreshCw, MessageSquare, Users, FileText } from 'lucide-react';
import { useZalo } from './hooks/useZalo';

export default function App() {
  const { 
    isAuthenticated, 
    isListening,
    groups, 
    messages, 
    loadingGroups, 
    refreshQR, 
    loadGroups, 
    loadMessages, 
    sendMessage 
  } = useZalo();

  const [selectedThreadId, setSelectedThreadId] = useState('');
  const [threadType, setThreadType] = useState('user');
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const groupOptions = useMemo(() => {
    return groups.map(g => ({
      value: g.id,
      label: g.name
    }));
  }, [groups]);

  const handleGroupChange = (val) => {
    const threadId = typeof val === 'object' && val !== null ? val.value : val;
    setSelectedThreadId(threadId);
    setThreadType('group');
  };

  const handleSend = async () => {
    if (!messageText || !selectedThreadId) return;
    setIsSending(true);
    try {
      await sendMessage(messageText, selectedThreadId, threadType);
      setMessageText('');
      loadMessages();
    } catch (e) {
      alert('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold">Zalo Messaging</h1>
            <a
              href="/api-docs"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
            >
              <FileText size={16} /> API Docs
            </a>
          </div>
          <div className="flex gap-2">
            <Badge color={isAuthenticated ? 'green' : 'red'}>
              {isAuthenticated ? 'ONLINE' : 'OFFLINE'}
            </Badge>
            {isAuthenticated && (
              <Badge color={isListening ? 'blue' : 'gray'}>
                {isListening ? 'LISTENER UP' : 'LISTENER DOWN'}
              </Badge>
            )}
          </div>
        </div>

        {!isAuthenticated ? (
          <div className="p-8 text-center bg-gray-50 border-dashed border-2 rounded-xl flex flex-col gap-4 items-center">
            <h2 className="text-xl font-semibold">Authentication Required</h2>
            <p className="text-gray-500">Scan the QR code with your Zalo app to continue.</p>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <img 
                src={`/qr.png?t=${new Date().getTime()}`} 
                alt="Zalo Login QR" 
                className="w-64 h-64"
              />
            </div>
            <Button onClick={refreshQR}>
              <RefreshCw size={16} className="mr-2 inline" /> Refresh QR
            </Button>
          </div>
        ) : (
          <>
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Send size={20} className="text-blue-600" />
                <h3 className="text-lg font-semibold">Send Message</h3>
              </div>

              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">To Group/User</label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Select
                        options={groupOptions}
                        value={selectedThreadId}
                        onChange={handleGroupChange}
                        placeholder="Select a group or search..."
                        searchPlaceholder="Type to filter groups..."
                        searchEmptyMessage="No groups found"
                      />
                    </div>
                    <Button onClick={loadGroups} variant="secondary">
                       <RefreshCw size={14} className="mr-1 inline" /> Refresh
                    </Button>
                  </div>
                </div>

                <div className="flex gap-3 mt-2">
                  <div className="flex-1">
                     <label className="text-sm font-medium mb-1 block">Override Thread ID</label>
                     <Input
                      value={typeof selectedThreadId === 'string' ? selectedThreadId : selectedThreadId?.value || ''}
                      onChange={(e) => setSelectedThreadId(e?.target?.value ?? e)}
                      placeholder="Enter thread ID manualy"
                    />
                  </div>
                  <div style={{ width: '120px' }}>
                     <label className="text-sm font-medium mb-1 block">Type</label>
                    <Select
                      options={[
                        { value: 'user', label: 'User' },
                        { value: 'group', label: 'Group' }
                      ]}
                      value={threadType}
                      onChange={(val) => setThreadType(typeof val === 'object' && val !== null ? val.value : val)}
                    />
                  </div>
                </div>

                <div className="mt-2">
                  <label className="text-sm font-medium mb-1 block">Message</label>
                  <Textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Enter your message here..."
                    rows={4}
                  />
                </div>

                <div className="mt-2">
                  <Button 
                    variant="primary" 
                    onClick={handleSend} 
                    loading={isSending}
                    disabled={!messageText || !selectedThreadId}
                  >
                    <Send size={16} className="mr-2 inline" /> Send Message
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <MessageSquare size={20} className="text-blue-600" />
                  <h3 className="text-lg font-semibold">Message History</h3>
                </div>
                <Button variant="secondary" onClick={loadMessages}>
                  <RefreshCw size={14} className="mr-1 inline" /> Refresh
                </Button>
              </div>

              <hr className="border-gray-200" />

              <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-2">
                {messages.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No messages yet.</p>
                ) : (
                  [...messages].reverse().map((m, i) => (
                    <div key={i} className="p-3 bg-gray-50 rounded-md border border-gray-200 hover:border-gray-300 transition-colors flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-sm truncate flex items-center gap-1">
                          {m.from === 'user' ? <Users size={12} /> : <MessageSquare size={12} />}
                          {m.from || 'Unknown'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(m.time).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{m.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
