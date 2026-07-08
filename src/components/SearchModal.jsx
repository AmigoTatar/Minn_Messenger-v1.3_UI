import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../config';
import { getAvatarUrl } from '../utils/avatarUtils';

const SearchModal = ({ isOpen, onClose, onMessageClick }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [total, setTotal] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      setTotal(0);
      return;
    }

    const searchTimer = setTimeout(() => {
      performSearch();
    }, 400);

    return () => clearTimeout(searchTimer);
  }, [query, filter]);

  const performSearch = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      params.append('query', query);
      if (filter !== 'all') {
        params.append('chatType', filter);
      }

      const response = await fetch(
        `${API_BASE_URL}/api/messages/search?${params}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ошибка поиска');
      }

      const data = await response.json();
      setResults(data.results || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('❌ Ошибка поиска:', error);
      alert('Не удалось выполнить поиск');
    } finally {
      setLoading(false);
    }
  };

  const highlightText = (text, highlight) => {
    if (!text || !highlight) return text;
    
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === highlight.toLowerCase() ? 
        <span key={i} className="bg-yellow-300 dark:bg-yellow-700 text-yellow-900 dark:text-yellow-200 px-0.5 rounded font-medium">
          {part}
        </span> : part
    );
  };

  const getChatIcon = (type) => {
    switch(type) {
      case 'private': return '👤';
      case 'group': return '👥';
      case 'channel': return '📢';
      default: return '💬';
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      return d.toLocaleString([], { 
        day: '2-digit', 
        month: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return '';
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-16 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-bold text-zinc-800 dark:text-white flex items-center gap-2">
            <span>🔍</span> Поиск сообщений
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition text-zinc-500 dark:text-zinc-400"
          >
            ✕
          </button>
        </div>

        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">🔍</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Введите слово или фразу для поиска..."
              className="w-full bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 text-zinc-800 dark:text-white placeholder-zinc-400"
            />
            {query.length > 0 && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-1.5 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 flex-wrap">
          {[
            { id: 'all', label: 'Все' },
            { id: 'private', label: '👤 Личные' },
            { id: 'group', label: '👥 Группы' },
            { id: 'channel', label: '📢 Каналы' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                filter === f.id 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {f.label}
            </button>
          ))}
          {total > 0 && (
            <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500 self-center">
              {total} результатов
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : query.length < 2 ? (
            <div className="text-center py-12 text-sm text-zinc-400 dark:text-zinc-500">
              Введите минимум 2 символа для поиска
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-12 text-sm text-zinc-400 dark:text-zinc-500">
              <span className="text-4xl block mb-3">🔍</span>
              Ничего не найдено по запросу "{query}"
            </div>
          ) : (
            results.map(msg => (
              <div
                key={msg.id}
                onClick={() => {
                  onMessageClick(msg.chatId, msg.id);
                  onClose();
                }}
                className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/80 cursor-pointer transition border border-zinc-200/50 dark:border-zinc-700/50"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {msg.sender?.avatar && msg.sender.avatar.startsWith('/uploads/') ? (
                      <img 
                        src={getAvatarUrl(msg.sender.avatar)} 
                        alt={msg.sender?.username} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-sm">{msg.sender?.username?.[0]?.toUpperCase() || '?'}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-zinc-800 dark:text-zinc-200">
                        {msg.sender?.username || 'Unknown'}
                      </span>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">
                        {formatTime(msg.createdAt)}
                      </span>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500 flex items-center gap-0.5">
                        {getChatIcon(msg.chatType)}
                        <span>{msg.chatName}</span>
                      </span>
                      {msg.isPinned && (
                        <span className="text-[10px] text-amber-500 dark:text-amber-400">📌</span>
                      )}
                      {msg.edited && (
                        <span className="text-[9px] text-zinc-400 dark:text-zinc-500 italic">изменено</span>
                      )}
                    </div>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-0.5 break-words">
                      {highlightText(msg.text || '📎 Медиафайл', query)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-400 dark:text-zinc-500 flex justify-between">
          <span>Ctrl+K для быстрого открытия</span>
          <span>Esc для закрытия</span>
        </div>
      </div>
    </div>
  );
};

export default SearchModal;