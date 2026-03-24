import { useState, useEffect, useCallback } from 'react';

export function useZalo() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [groups, setGroups] = useState([]);
  const [messages, setMessages] = useState([]);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const checkAuthStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth-status');
      const data = await res.json();
      setIsAuthenticated(data.isAuthenticated);
      setIsListening(data.isListening);
    } catch (e) {
      console.error('Failed to check auth status', e);
    }
  }, []);

  const refreshQR = async () => {
    try {
      await fetch('/api/refresh-qr', { method: 'POST' });
      fetch('/qr.png?' + new Date().getTime()); // Trigger re-gen
    } catch (e) {
      console.error('Failed to refresh QR', e);
    }
  };

  const loadGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const res = await fetch('/api/groups');
      if (res.ok) {
        const data = await res.json();
        setGroups(data);
      }
    } catch (e) {
      console.error('Failed to load groups', e);
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  const loadMessages = useCallback(async () => {
    setLoadingMessages(true);
    try {
      const res = await fetch('/api/messages');
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (e) {
      console.error('Failed to load messages', e);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const sendMessage = async (text, threadId, type) => {
    try {
      const res = await fetch('/api/send', {
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
    try {
      const res = await fetch('/api/webhook-config');
      if (res.ok) {
        const data = await res.json();
        setWebhookUrl(data.webhookUrl || '');
      }
    } catch (e) {
      console.error('Failed to load webhook config', e);
    }
  }, []);

  const updateWebhookConfig = async (url) => {
    try {
      const res = await fetch('/api/webhook-config', {
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
    checkAuthStatus();
    loadGroups();
    loadMessages();
    loadWebhookConfig();

    const authInterval = setInterval(checkAuthStatus, 5000);
    const msgInterval = setInterval(loadMessages, 10000);

    return () => {
      clearInterval(authInterval);
      clearInterval(msgInterval);
    };
  }, [checkAuthStatus, loadGroups, loadMessages, loadWebhookConfig]);

  return {
    isAuthenticated,
    isListening,
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
