import { useState, useMemo, useEffect } from 'react';
import { Button } from '@openai/apps-sdk-ui/components/Button';
import { Input } from '@openai/apps-sdk-ui/components/Input';
import { Textarea } from '@openai/apps-sdk-ui/components/Textarea';
import { Select } from '@openai/apps-sdk-ui/components/Select';
import { Badge } from '@openai/apps-sdk-ui/components/Badge';
import { Send, RefreshCw, MessageSquare, Users, FileText, Settings, Globe, Plus, List, LogIn, Trash2, X } from 'lucide-react';
import { useZalo } from './hooks/useZalo';

export default function App() {
  const { 
    accounts,
    currentAccountId,
    setCurrentAccountId,
    addAccount,
    deleteAccount,
    reLogin,
    isAuthenticated, 
    isListening,
    groups, 
    messages, 
    webhookUrl,
    loadingGroups, 
    refreshQR, 
    loadGroups, 
    loadMessages, 
    sendMessage,
    updateWebhookConfig
  } = useZalo();

  const [selectedThreadId, setSelectedThreadId] = useState('');
  const [threadType, setThreadType] = useState('user');
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [localWebhookUrl, setLocalWebhookUrl] = useState('');
  const [isUpdatingWebhook, setIsUpdatingWebhook] = useState(false);
  const [newAccountId, setNewAccountId] = useState('');
  const [showAddAccount, setShowAddAccount] = useState(false);

  useEffect(() => {
    setLocalWebhookUrl(webhookUrl);
  }, [webhookUrl]);

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

  const handleUpdateWebhook = async () => {
    setIsUpdatingWebhook(true);
    try {
      await updateWebhookConfig(localWebhookUrl);
      alert('Webhook configuration updated');
    } catch (e) {
      alert('Failed to update webhook');
    } finally {
      setIsUpdatingWebhook(false);
    }
  };

  const handleAddAccount = async () => {
    try {
      const result = await addAccount(newAccountId);
      setNewAccountId('');
      setShowAddAccount(false);
      if (result && result.accountId) {
        setCurrentAccountId(result.accountId);
      }
    } catch (e) {
      alert('Failed to add account');
    }
  };

  const handleDeleteAccount = async (id, e) => {
    if (e) e.stopPropagation();
    const accountToDelete = id || currentAccountId;
    if (!accountToDelete) return;
    if (confirm(`Are you sure you want to delete account ${accountToDelete}? All data will be lost.`)) {
      try {
        await deleteAccount(accountToDelete);
      } catch (e) {
        alert('Failed to delete account');
      }
    }
  };

  const handleReLogin = async () => {
    if (!currentAccountId) return;
    if (confirm(`Reset session and re-login for ${currentAccountId}?`)) {
      try {
        await reLogin(currentAccountId);
      } catch (e) {
        alert('Failed to restart login process');
      }
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <List size={20} /> Accounts
          </h2>
          <Button size="icon" variant="secondary" onClick={() => setShowAddAccount(!showAddAccount)}>
            <Plus size={16} />
          </Button>
        </div>

        {showAddAccount && (
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col gap-2">
            <label className="text-xs font-medium uppercase text-gray-500 flex items-center gap-1">
              Account ID <span className="lowercase text-[10px]">(Optional)</span>
            </label>
            <Input
              value={newAccountId}
              onChange={(e) => setNewAccountId(e.target.value)}
              placeholder="Leave empty to auto-detect"
            />
            <Button onClick={handleAddAccount} variant="primary" size="sm">Add Account</Button>
            <p className="text-[10px] text-gray-400">If empty, it will be named after login.</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {accounts.map(acc => (
            <div
              key={acc.accountId}
              onClick={() => setCurrentAccountId(acc.accountId)}
              className={`p-4 cursor-pointer hover:bg-gray-50 flex flex-col gap-1 relative group ${currentAccountId === acc.accountId ? 'bg-blue-50 border-r-4 border-blue-500' : ''}`}
            >
              <div className="flex justify-between items-center pr-6">
                <span className={`font-semibold truncate ${acc.accountId.startsWith('pending_') ? 'italic text-gray-400' : ''}`}>
                  {acc.accountId}
                </span>
                <div className={`w-2 h-2 rounded-full ${acc.isAuthenticated ? 'bg-green-500' : 'bg-red-500'}`}></div>
              </div>
              <span className="text-xs text-gray-500 pr-6">
                {acc.isAuthenticated ? (acc.isListening ? 'Online' : 'Connected') : (acc.accountId.startsWith('pending_') ? 'Waiting for Login...' : 'Offline')}
              </span>
              <button
                onClick={(e) => handleDeleteAccount(acc.accountId, e)}
                className="absolute top-4 right-2 p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete Account"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto py-8 px-4">
        {currentAccountId ? (
          <div className="max-w-3xl mx-auto flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <h1 className="text-3xl font-bold">Zalo: {currentAccountId}</h1>
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

            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Settings size={20} className="text-blue-600" />
                  <h3 className="text-lg font-semibold">Account Actions</h3>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={handleReLogin}>
                       <LogIn size={14} className="mr-1 inline" /> Re-login
                    </Button>
                    <Button variant="red" size="sm" onClick={(e) => handleDeleteAccount(null, e)}>
                       <Trash2 size={14} className="mr-1 inline" /> Delete Account
                    </Button>
                </div>
              </div>

              <hr className="border-gray-100" />

              <div className="flex flex-col gap-3">
                <label className="text-sm font-medium mb-1 block flex items-center gap-2">
                  <Globe size={14} /> Webhook URL (POST messages to this URL)
                </label>
                <div className="flex gap-2">
                  <Input
                    value={localWebhookUrl}
                    onChange={(e) => setLocalWebhookUrl(e.target.value)}
                    placeholder="https://your-webhook-endpoint.com/api/callback"
                  />
                  <Button
                    onClick={handleUpdateWebhook}
                    loading={isUpdatingWebhook}
                    variant="primary"
                  >
                    Save
                  </Button>
                </div>
              </div>
            </div>

            {!isAuthenticated ? (
              <div className="p-8 text-center bg-gray-50 border-dashed border-2 rounded-xl flex flex-col gap-4 items-center">
                <h2 className="text-xl font-semibold">Authentication Required</h2>
                <p className="text-gray-500">Scan the QR code with your Zalo app to continue.</p>
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <img
                    src={`/qr/${currentAccountId}.png?t=${new Date().getTime()}`}
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
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-4">
             <List size={48} className="opacity-20" />
             <p className="text-xl">Select an account from the sidebar or add a new one.</p>
             <Button onClick={() => setShowAddAccount(true)}>
                <Plus size={16} className="mr-2" /> Add Account
             </Button>
          </div>
        )}
      </div>
    </div>
  );
}
