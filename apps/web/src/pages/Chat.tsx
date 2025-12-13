import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, AlertCircle } from 'lucide-react';
import { api, EpisodicMemory } from '../lib/api';
import clsx from 'clsx';

export function Chat() {
  const [input, setInput] = useState('');
  const [semanticEnabled, setSemanticEnabled] = useState(false);
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading, error } = useQuery({
    queryKey: ['episodic'],
    queryFn: api.episodic.list,
    refetchInterval: 5000,
  });

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      // 1. Store Episodic (Always)
      const episodicData = {
        role: 'user' as const,
        content,
        provenance: {
          source: 'web-ui',
          context: { semanticEnabled },
        },
      };
      await api.episodic.create(episodicData);

      // 2. Store Semantic (Optional)
      if (semanticEnabled) {
        await api.semantic.create({
          content,
          metadata: { type: 'chat-message' },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['episodic'] });
      setInput('');
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage.mutate(input);
  };

  if (isLoading) return <div>Loading chat...</div>;
  if (error) return (
    <div className="text-red-400 flex items-center gap-2">
      <AlertCircle />
      <span>Error loading chat: {error.message}</span>
    </div>
  );

  // Sort messages by timestamp
  const sortedMessages = [...(messages || [])].sort((a: EpisodicMemory, b: EpisodicMemory) => a.timestamp - b.timestamp);

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Chat Stream</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400">Semantic Write:</label>
          <button
            onClick={() => setSemanticEnabled(!semanticEnabled)}
            className={clsx(
              'w-12 h-6 rounded-full transition-colors relative',
              semanticEnabled ? 'bg-blue-600' : 'bg-gray-700'
            )}
          >
            <div
              className={clsx(
                'w-4 h-4 bg-white rounded-full absolute top-1 transition-all',
                semanticEnabled ? 'left-7' : 'left-1'
              )}
            />
          </button>
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 bg-gray-800 rounded-lg p-4 overflow-y-auto mb-4 space-y-4 border border-gray-700"
      >
        {sortedMessages.length === 0 ? (
          <div className="text-gray-500 text-center mt-10">No messages yet. Start the conversation.</div>
        ) : (
          sortedMessages.map((msg: EpisodicMemory) => (
            <div
              key={msg.id}
              className={clsx(
                'p-3 rounded-lg max-w-[80%]',
                msg.role === 'user' 
                  ? 'bg-blue-900/50 ml-auto border border-blue-800' 
                  : 'bg-gray-700 border border-gray-600'
              )}
            >
              <div className="text-xs text-gray-400 mb-1 flex justify-between gap-4">
                <span className="capitalize">{msg.role}</span>
                <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
              </div>
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
          disabled={sendMessage.isPending}
        />
        <button
          type="submit"
          disabled={sendMessage.isPending || !input.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2 rounded-lg flex items-center gap-2 font-medium"
        >
          <Send size={18} />
          Send
        </button>
      </form>
      {sendMessage.error && (
        <div className="text-red-400 text-sm mt-2">
          Error sending message: {sendMessage.error.message}
        </div>
      )}
    </div>
  );
}
