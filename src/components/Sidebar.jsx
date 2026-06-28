import React, { useState } from 'react';
import { CHAT_IDS } from '../config';

export default function Sidebar({ 
  chats, 
  activeChatId, 
  messages,
  setActiveChatId, 
  searchQuery, 
  setSearchQuery,
  isDarkMode,
  onToggleTheme,
  onLogout,
  channels,
  onSelectChat,
  onCreateChannel 
}) {
  const { GENERAL, GENERAL_ALT } = CHAT_IDS;
  // Стейты для управления модалкой создания канала
  const [isNewChannelModalOpen, setIsNewChannelModalOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelAvatar, setNewChannelAvatar] = useState('📢');

  // Вспомогательная функция безопасного форматирования времени Prisma (ISO -> ЧЧ:ММ)
  const formatMsgTime = (dateString) => {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };
  const handleSubmitChannel = async (e) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    if (typeof onCreateChannel === 'function') {
      await onCreateChannel({
        name: newChannelName.trim(),
        avatar: newChannelAvatar
      });
    }

    // Сбрасываем форму и закрываем окно
    setNewChannelName('');
    setNewChannelAvatar('📢');
    setIsNewChannelModalOpen(false);
  };
  // 📊 ВСЕЯДНЫЙ И БЕЗОПАСНЫЙ СБОР НЕПРОЧИТАННЫХ ДЛЯ ОБЩЕГО ЧАТА
const generalUnreadCount = (() => {
  // Вариант 1: Ищем в массиве чатов
  if (Array.isArray(chats)) {
    const found = chats.find(c => c && (String(c.id) === GENERAL || c.id === GENERAL_ALT || c.id === 0));
    if (found && found.unreadCount > 0) {
      return Number(found.unreadCount);
    }
  }
  // Вариант 2: Если бэкенд не обновил chats, вручную считаем по массиву messages
  if (Array.isArray(messages)) {
    const count = messages.filter(m => m && !m.receiverId && !m.channelId && m.status === 'unread').length;
    
    return count;
  }
  
  return 0;
})();


  return (
    <div className={`w-full md:w-80 h-full max-h-screen overflow-hidden border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-white dark:bg-zinc-950 transition-colors duration-300 ${activeChatId ? 'hidden md:flex' : 'flex'}`}>
      
      {/* Шапка и строка поиска */}
      <div className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold text-zinc-800 dark:text-white">Чаты</h1>
        </div>
        
        <div className="relative">
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск..."
            className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-emerald-500 transition text-zinc-800 dark:text-white placeholder-zinc-400"
          />
          <span className="absolute left-3 top-2.5 text-xs text-zinc-400">🔍</span>
        </div>
      </div>

 {/* ========================================================================= */}
      {/* 📦 ЕДИНЫЙ БЕСШОВНЫЙ СКРОЛЛ-КОНТЕЙНЕР (УБИРАЕТ НЕВИДИМЫЕ ОТСТУПЫ И ЛИШНИЕ СКРОЛЛЫ) */}
      {/* ========================================================================= */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-2 py-2 space-y-1">
        
        {/* 💬 1. СТАТИЧНАЯ КНОПКА ОБЩЕГО ЧАТА СО СЧЕТЧИКОМ */}
<button
  key="static_chat_general"
  type="button"
  onClick={() => {
    if (typeof onSelectChat === 'function') {
      onSelectChat('chat_general');
    } else if (typeof setActiveChatId === 'function') {
      setActiveChatId('chat_general');
    }
  }}
  className={`w-full flex items-center p-3 rounded-xl transition-all select-none text-left relative ${
    activeChatId === 'chat_general'
      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/30'
      : 'hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300'
  }`}
>
  <div className="relative mr-3 shrink-0">
    <div className="w-11 h-11 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xl shadow-sm">
      💬
    </div>
  </div>
  <div className="flex-1 min-w-0">
    <div className="flex justify-between items-baseline mb-0.5">
      <h3 className="font-semibold text-xs text-zinc-800 dark:text-zinc-100 truncate">Общий чат</h3>
    </div>
    
    {/* 👇 КОНТЕЙНЕР ДЛЯ ОПИСАНИЯ И ЗЕЛЕНОГО КРУЖКА */}
    <div className="flex justify-between items-center gap-2">
      <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate flex-1">Глобальная комната вещания</p>
      
      {/* 🟢 ЗДЕСЬ ДОЛЖЕН БЫТЬ ЗЕЛЕНЫЙ КРУЖОК */}
      {generalUnreadCount > 0 && (
        <span className="bg-emerald-500 text-white text-[10px] font-bold h-4 min-w-4 px-1 rounded-full flex items-center justify-center select-none shrink-0 animate-pulse">
          {generalUnreadCount}
        </span>
      )}
    </div>
  </div>
</button>


        {/* 👥 2. ДИНАМИЧЕСКИЙ СПИСОК ПРИВАТНЫХ ДИАЛОГОВ И ПОЛЬЗОВАТЕЛЕЙ */}
        {Array.isArray(chats) && chats
  .filter(chat => chat.id !== GENERAL && chat.id !== GENERAL_ALT)
  .map((chat, index) => {
          const isActive = chat.id === activeChatId;
          const lastMessage = chat.messages && chat.messages.length > 0 
            ? chat.messages[chat.messages.length - 1] 
            : null;

          return (
            <button
              key={`${chat.id}_${index}`}
              onClick={() => {
                if (typeof onSelectChat === 'function') {
                  const chatIdStr = chat.id.toString();
                  let strictChatId = chatIdStr;
                  if (!chatIdStr.startsWith('user_') && !chatIdStr.startsWith('channel_') && chatIdStr !== 'chat_general') {
                    strictChatId = chat.isPrivate ? `user_${chatIdStr}` : `channel_${chatIdStr}`;
                  }
                  onSelectChat(strictChatId);
                } else {
                  setActiveChatId(chat.id);
                }
              }}
              className={`w-full flex items-center p-3 rounded-xl transition-all select-none text-left relative ${
                isActive 
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/30' 
                  : 'hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              <div className="relative mr-3 shrink-0">
                <div className="w-11 h-11 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xl shadow-sm">
                  {chat.avatar || '👤'}
                </div>
                {chat.isOnline && chat.id !== 'chat_general' && !chat.id?.startsWith('channel_') && (
                  <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-950 ring-1 ring-emerald-500/20 animate-pulse" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                  <h3 className="font-semibold text-xs text-zinc-800 dark:text-zinc-100 truncate">{chat.name}</h3>
                  {lastMessage && (
                    <span className="text-[10px] text-zinc-400 whitespace-nowrap ml-1">
                      {formatMsgTime(lastMessage.createdAt)}
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center gap-2">
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate flex-1">
                    {lastMessage 
                      ? lastMessage.isDeleted ? '🚫 Сообщение удалено' : lastMessage.mediaType === 'image' ? '🖼️ Фотография' : lastMessage.mediaType === 'audio' ? '🎙️ Голосовое сообщение' : lastMessage.text 
                      : 'Нет сообщений'}
                  </p>
                  {chat.unreadCount > 0 && (
                    <span className="bg-emerald-500 text-white text-[10px] font-bold h-4 min-w-4 px-1 rounded-full flex items-center justify-center select-none shrink-0">
                      {chat.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}

        {/* 🗣️ 3. ДИНАМИЧЕСКИЙ СПИСОК ПУБЛИЧНЫХ КАНАЛОВ (БЕЗОПАСНАЯ ИЗОЛЯЦИЯ И МГНОВЕННЫЕ СОКЕТЫ) */}
        {Array.isArray(channels) && channels.map((channelItem, index) => {
  if (!channelItem) return null;
  
  const isChannelActive = activeChatId === `channel_${channelItem.id}`;
  
  // 🛡️ ПЕРЕХВАТ СОКЕТОВ ДЛЯ МГНОВЕННОГО ОБНОВЛЕНИЯ КРУЖОЧКОВ:
  const liveUpdateInChats = Array.isArray(chats) 
    ? chats.find(c => c && (String(c.id) === `channel_${channelItem.id}` || String(c.id) === String(channelItem.id))) 
    : null;

  const currentUnread = Number(liveUpdateInChats ? liveUpdateInChats.unreadCount : (channelItem.unreadCount || 0));
  

          return (
<button
      key={`sidebar_chan_${channelItem.id}_${index}`}
      type="button"
      onClick={() => {
        if (typeof onSelectChat === 'function') {
          onSelectChat(`channel_${channelItem.id}`); 
        } else if (typeof setActiveChatId === 'function') {
          setActiveChatId(`channel_${channelItem.id}`);
        }
      }}
      className={`w-full flex items-center p-3 rounded-xl transition-all select-none text-left ${
        isChannelActive 
          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/30' 
          : 'hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300'
      }`}
    >
      <div className="w-11 h-11 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xl mr-3 shadow-sm">
        {channelItem.avatar || '📢'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-0.5">
          <h3 className="font-semibold text-xs text-zinc-800 dark:text-zinc-100 truncate">{channelItem.name}</h3>
        </div>
        <div className="flex justify-between items-center gap-2">
          <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate flex-1">Официальный канал вещания</p>
          
          {/* 🟢 ЗДЕСЬ ДОЛЖЕН БЫТЬ ЗЕЛЕНЫЙ КРУЖОК */}
          {currentUnread > 0 && (
            <span className="bg-emerald-500 text-white text-[10px] font-bold h-4 min-w-4 px-1 rounded-full flex items-center justify-center select-none shrink-0 animate-pulse">
              {currentUnread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
})}




      </div>

      {/* Подвал сайдбара с кнопками темы и выхода */}
      <div className="p-3 border-t border-zinc-100 dark:border-zinc-900 flex flex-col gap-2 bg-zinc-50/50 dark:bg-zinc-950/20 mt-auto">
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-zinc-400 font-medium">Mini Messenger v1.3</span>
          <button
            type="button"
            onClick={onToggleTheme}
            className="p-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-amber-500 dark:hover:text-amber-400 rounded-xl transition active:scale-95 shadow-sm"
            title={isDarkMode ? "Включить светлую тему" : "Включить темную тему"}
          >
            {isDarkMode ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M16.243 17.657l.707.707M7.05 7.05l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
        
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-zinc-100 hover:bg-red-50 dark:bg-zinc-900 dark:hover:bg-red-950/30 px-4 py-2.5 text-sm font-medium text-zinc-600 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 transition duration-200 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Выйти из аккаунта
        </button>
      </div>
      {/* Модальное окно создания канала */}
      {isNewChannelModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-zinc-100 dark:border-zinc-800 transition-colors">
            <h3 className="text-lg font-bold text-zinc-800 dark:text-white mb-4">Создать новый канал</h3>
            
            <form onSubmit={handleSubmitChannel} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Иконка / Эмодзи</label>
                <input 
                  type="text" 
                  value={newChannelAvatar}
                  onChange={(e) => setNewChannelAvatar(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-center text-xl focus:outline-none focus:border-emerald-500 text-zinc-800 dark:text-white"
                  maxLength={2}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Название канала</label>
                <input 
                  type="text" 
                  placeholder="Например: Новости IT"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs focus:outline-none focus:border-emerald-500 text-zinc-800 dark:text-white"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewChannelModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-md shadow-emerald-600/10"
                >
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
