import { useState, useEffect, useCallback } from 'react';
import { getRepository } from '@/lib/repository';
import type { AiThread, AiMessage } from '@/lib/repository/types';
import type { ChatMessage } from '@/components/ai/ChatPanel';

export function useChatThread(pageRoute?: string) {
  const [currentThread, setCurrentThread] = useState<AiThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load or create thread for the current page
  useEffect(() => {
    if (!pageRoute) return;

    const loadThread = async () => {
      setIsLoading(true);
      const repo = getRepository();

      // Try to find existing thread for this page
      const threads = await repo.getThreads({ pageRoute, limit: 1 });

      if (threads.length > 0) {
        const thread = threads[0];
        setCurrentThread(thread);

        // Load messages for this thread
        const threadMessages = await repo.getMessages(thread.id);
        const chatMessages: ChatMessage[] = threadMessages.map((msg) => ({
          id: msg.id,
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          toolCalls: msg.toolCalls,
          showAppDataBadge: false
        }));
        setMessages(chatMessages);
      } else {
        // Create new thread
        const threadId = await repo.createThread({
          title: `Chat - ${new Date().toLocaleDateString()}`,
          pageRoute,
          pinned: false
        });
        const newThread = await repo.getThread(threadId);
        setCurrentThread(newThread);
        setMessages([]);
      }

      setIsLoading(false);
    };

    loadThread();
  }, [pageRoute]);

  // Save a message to the database
  const saveMessage = useCallback(async (message: ChatMessage, provider?: string, modelId?: string) => {
    if (!currentThread) return;

    const repo = getRepository();
    await repo.addMessage({
      threadId: currentThread.id,
      role: message.role,
      content: message.content,
      provider,
      modelId,
      toolCalls: message.toolCalls
    });
  }, [currentThread]);

  // Add message to state and save to DB
  const addMessage = useCallback(async (message: ChatMessage, provider?: string, modelId?: string) => {
    setMessages((prev) => [...prev, message]);
    await saveMessage(message, provider, modelId);
  }, [saveMessage]);

  // Update message in state and save to DB
  const updateMessage = useCallback(async (messageId: string, updates: Partial<ChatMessage>) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, ...updates } : msg))
    );
  }, []);

  // Clear all messages (create new thread)
  const clearThread = useCallback(async () => {
    if (!pageRoute) return;

    const repo = getRepository();
    const threadId = await repo.createThread({
      title: `Chat - ${new Date().toLocaleDateString()}`,
      pageRoute,
      pinned: false
    });
    const newThread = await repo.getThread(threadId);
    setCurrentThread(newThread);
    setMessages([]);
  }, [pageRoute]);

  // Rename current thread
  const renameThread = useCallback(async (newTitle: string) => {
    if (!currentThread) return;

    const repo = getRepository();
    await repo.updateThread(currentThread.id, { title: newTitle });
    setCurrentThread({ ...currentThread, title: newTitle });
  }, [currentThread]);

  // Pin/unpin thread
  const togglePin = useCallback(async () => {
    if (!currentThread) return;

    const repo = getRepository();
    const newPinned = !currentThread.pinned;
    await repo.updateThread(currentThread.id, { pinned: newPinned });
    setCurrentThread({ ...currentThread, pinned: newPinned });
  }, [currentThread]);

  return {
    currentThread,
    messages,
    setMessages,
    isLoading,
    addMessage,
    updateMessage,
    saveMessage,
    clearThread,
    renameThread,
    togglePin
  };
}
