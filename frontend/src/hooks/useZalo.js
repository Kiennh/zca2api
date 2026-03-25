import { useState, useEffect, useCallback } from 'react';

export function useZalo() {
  const [accounts, setAccounts] = useState([]);
  const [currentAccountId, setCurrentAccountId] = useState(null);
  const [status, setStatus] = useState({ isAuthenticated: false, isListening: false });
  const [groups, setGroups] = useState([]);
  const [messages, setMessages] = useState([]);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const res = await fetch('/api/accounts');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data);
        if (data.length > 0 && !currentAccountId) {
          setCurrentAccountId(data[0].accountId);
        }
      }
    } catch (e) {
      console.error('Failed to load accounts', e);
    } finally {
      setLoadingAccounts(true);
    }
  }, [currentAccountId]);

  const addAccount = async (accountId) => {
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId })
      });
      if (res.ok) {
        await loadAccounts();
        setCurrentAccountId(accountId);
        return await res.json();
      }
    } catch (e) {
      console.error('Failed to add account', e);
      throw e;
    }
  };

  const checkAuthStatus = useCallback(async () => {
    if (!currentAccountId) return;
    try {
      const res = await fetch(`/api/${currentAccountId}/auth-status`);
      const data = await res.json();
      setStatus({
        isAuthenticated: data.isAuthenticated,
        isListening: data.isListening
      });
    } catch (e) {
      console.error('Failed to check auth status', e);
    }
  }, [currentAccountId]);

  const refreshQR = async () => {
    if (!currentAccountId) return;
    try {
      await fetch(`/api/${currentAccountId}/refresh-qr`, { method: 'POST' });
    } catch (e) {
      console.error('Failed to refresh QR', e);
    }
  };

  const loadGroups = useCallback(async () => {
    if (!currentAccountId) return;
    setLoadingGroups(true);
    try {
      const res = await fetch(`/api/${currentAccountId}/groups`);
      if (res.ok) {
        const data = await res.json();
        setGroups(data);
      }
    } catch (e) {
      console.error('Failed to load groups', e);
    } finally {
      setLoadingGroups(false);
    }
  }, [currentAccountId]);

  const loadMessages = useCallback(async () => {
    if (!currentAccountId) return;
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/${currentAccountId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (e) {
      console.error('Failed to load messages', e);
    } finally {
      setLoadingMessages(false);
    }
  }, [currentAccountId]);

  const sendMessage = async (text, threadId, type) => {
    if (!currentAccountId) return;
    try {
      const res = await fetch(`/api/${currentAccountId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, threadId, type })
      });
      return await res.json();
    } catch (e) {
      console.error('Failed to send message', e);
      throw e;
    }
  };

  const loadWebhookConfig = useCallback(async () => {
    if (!currentAccountId) return;
    try {
      const res = await fetch(`/api/${currentAccountId}/webhook-config`);
      if (res.ok) {
        const data = await res.json();
        setWebhookUrl(data.webhookUrl || '');
      }
    } catch (e) {
      console.error('Failed to load webhook config', e);
    }
  }, [currentAccountId]);

  const updateWebhookConfig = async (url) => {
    if (!currentAccountId) return;
    try {
      const res = await fetch(`/api/${currentAccountId}/webhook-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: url })
      });
      if (res.ok) {
        const data = await res.json();
        setWebhookUrl(data.webhookUrl);
        return data;
      }
    } catch (e) {
      console.error('Failed to update webhook config', e);
      throw e;
    }
  };

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (currentAccountId) {
      checkAuthStatus();
      loadGroups();
      loadMessages();
      loadWebhookConfig();
    }
  }, [currentAccountId, checkAuthStatus, loadGroups, loadMessages, loadWebhookConfig]);

  useEffect(() => {
    const authInterval = setInterval(checkAuthStatus, 5000);
    const msgInterval = setInterval(loadMessages, 10000);
    const accountsInterval = setInterval(loadAccounts, 10000);

    return () => {
      clearInterval(authInterval);
      clearInterval(msgInterval);
      clearInterval(accountsInterval);
    };
  }, [checkAuthStatus, loadMessages, loadAccounts]);

  return {
    accounts,
    currentAccountId,
    setCurrentAccountId,
    addAccount,
    isAuthenticated: status.isAuthenticated,
    isListening: status.isListening,
    groups,
    messages,
    webhookUrl,
    loadingGroups,
    loadingMessages,
    refreshQR,
    loadGroups,
    loadMessages,
    sendMessage,
    checkAuthStatus,
    loadWebhookConfig,
    updateWebhookConfig
  };
}
