import { useState, useEffect, useCallback, useRef } from 'react';

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

  const currentAccountIdRef = useRef(currentAccountId);
  useEffect(() => {
    currentAccountIdRef.current = currentAccountId;
  }, [currentAccountId]);

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const res = await fetch('/api/accounts');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data);

        // Handle account renaming case: if currentAccountId is no longer in the list,
        // but it was a "pending_" account, it might have been renamed.
        // Or if it was just renamed, we should find the one that replaced it.
        // This is tricky without a persistent mapping, but we can assume if the list changes and our current is gone,
        // we might want to pick the newest one or just let the user re-select.
        // Actually, the server updates the list. If currentAccountIdRef is pending_ and it's gone,
        // we could potentially look for a new non-pending account.

        if (data.length > 0 && !currentAccountIdRef.current) {
          setCurrentAccountId(data[0].accountId);
        } else if (currentAccountIdRef.current && !data.find(a => a.accountId === currentAccountIdRef.current)) {
           // If current account is gone (renamed), let's see if we can find a new one that appeared.
           // For now, let's just keep the last one or the first one if current is invalid.
           // If we wanted to be smart, we'd compare the previous list with the new one.
        }
      }
    } catch (e) {
      console.error('Failed to load accounts', e);
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  const addAccount = async (accountId) => {
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: accountId || undefined })
      });
      if (res.ok) {
        const result = await res.json();
        await loadAccounts();
        setCurrentAccountId(result.accountId);
        return result;
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
      if (res.status === 404) {
        // Account might have been renamed. Reload accounts list.
        await loadAccounts();
        return;
      }
      const data = await res.json();
      setStatus({
        isAuthenticated: data.isAuthenticated,
        isListening: data.isListening
      });
    } catch (e) {
      console.error('Failed to check auth status', e);
    }
  }, [currentAccountId, loadAccounts]);

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
