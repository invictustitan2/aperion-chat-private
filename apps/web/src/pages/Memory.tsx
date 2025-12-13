import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Save, AlertCircle, Clock } from 'lucide-react';
import { api, IdentityRecord, EpisodicMemory } from '../lib/api';

export function Memory() {
  const [identityKey, setIdentityKey] = useState('user');
  const [identityValue, setIdentityValue] = useState('');
  const queryClient = useQueryClient();

  const { data: identity, isLoading: isLoadingIdentity, error: identityError } = useQuery({
    queryKey: ['identity', identityKey],
    queryFn: () => api.identity.get(identityKey),
    retry: false,
  });

  const { data: episodic, isLoading: isLoadingEpisodic } = useQuery({
    queryKey: ['episodic'],
    queryFn: api.episodic.list,
  });

  const updateIdentity = useMutation({
    mutationFn: async () => {
      let parsedValue;
      try {
        parsedValue = JSON.parse(identityValue);
      } catch (e) {
        parsedValue = identityValue; // Treat as string if not JSON
      }
      await api.identity.set(identityKey, parsedValue);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['identity', identityKey] });
      alert('Identity updated successfully');
    },
  });

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <section>
        <h2 className="text-2xl font-bold mb-4">Identity Store</h2>
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-1">Key</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={identityKey}
                  onChange={(e) => setIdentityKey(e.target.value)}
                  className="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-2"
                />
                <button 
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['identity', identityKey] })}
                  className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded"
                >
                  <Search size={18} />
                </button>
              </div>
            </div>
          </div>

          {isLoadingIdentity ? (
            <div>Loading identity...</div>
          ) : identityError ? (
            <div className="text-yellow-400 flex items-center gap-2 mb-4">
              <AlertCircle size={18} />
              <span>Identity not found or error: {identityError.message}</span>
            </div>
          ) : (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Current Value</h3>
              <pre className="bg-gray-900 p-4 rounded overflow-auto max-h-60 text-sm">
                {JSON.stringify(identity, null, 2)}
              </pre>
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Update Value (JSON or String)</label>
            <textarea
              value={identityValue}
              onChange={(e) => setIdentityValue(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 h-32 font-mono text-sm mb-2"
              placeholder='{"name": "User", "preferences": ...}'
            />
            <button
              onClick={() => updateIdentity.mutate()}
              disabled={updateIdentity.isPending}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded flex items-center gap-2"
            >
              <Save size={18} />
              Save Identity
            </button>
            {updateIdentity.error && (
              <div className="text-red-400 mt-2 text-sm">
                Error: {updateIdentity.error.message}
              </div>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Clock className="text-blue-400" />
          Recent Episodic Memory
        </h2>
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          {isLoadingEpisodic ? (
            <div className="p-6">Loading episodic memory...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-900 text-gray-400">
                  <tr>
                    <th className="p-4">Time</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Content</th>
                    <th className="p-4">ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {(episodic || []).slice(0, 20).map((mem: EpisodicMemory) => (
                    <tr key={mem.id} className="hover:bg-gray-750">
                      <td className="p-4 whitespace-nowrap text-gray-400">
                        {new Date(mem.timestamp).toLocaleString()}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          mem.role === 'user' ? 'bg-blue-900 text-blue-200' :
                          mem.role === 'assistant' ? 'bg-green-900 text-green-200' :
                          'bg-gray-700 text-gray-300'
                        }`}>
                          {mem.role}
                        </span>
                      </td>
                      <td className="p-4 max-w-md truncate" title={mem.content}>
                        {mem.content}
                      </td>
                      <td className="p-4 font-mono text-xs text-gray-500">
                        {mem.id.slice(0, 8)}...
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
