import React from 'react';

export default function Sidebar({ 
  chats, 
  activeChatId, 
  setActiveChatId, 
  searchQuery, 
  setSearchQuery,
  isDarkMode,
  onToggleTheme,
  onLogout
}) {
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

  return (
    <div className={`w-full md:w-80 h-full border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-white dark:bg-zinc-950 transition-colors duration-300 ${activeChatId ? 'hidden md:flex' : 'flex'}`}>
      
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
            placeholder="Поиск собеседника..."
            className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-emerald-500 transition text-zinc-800 dark:text-white placeholder-zinc-400"
          />
          <span className="absolute left-3 top-2.5 text-xs text-zinc-400">🔍</span>
        </div>
      </div>

      {/* Список чатов */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-2 space-y-1">
        {!chats || chats.length === 0 ? (
          <p className="text-xs text-zinc-400 text-center py-8">Ничего не найдено</p>
        ) : (
          chats.map(chat => {
            const isActive = chat.id === activeChatId;
            
            // ЗАЩИТА: Добавили цепочку ?. на случай, если messages нет или массив пустой
            const lastMessage = chat.messages && chat.messages.length > 0 
              ? chat.messages[chat.messages.length - 1] 
              : null;

            return (
              <button
                key={chat.id}
                onClick={() => setActiveChatId(chat.id)}
                className={`w-full flex items-center p-3 rounded-xl transition-all select-none text-left ${
                  isActive 
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/30' 
                    : 'hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                <div className="w-11 h-11 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xl mr-3 shadow-sm">
                  {chat.avatar || '👤'}
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
                  
                  {/* Контейнер для последнего сообщения и СЧЕТЧИКА */}
                  <div className="flex justify-between items-center gap-2">
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate flex-1">
                      {lastMessage 
                        ? lastMessage.isDeleted 
                          ? '🚫 Сообщение удалено' 
                          : lastMessage.mediaType === 'image' 
                            ? '🖼️ Фотография' 
                            : lastMessage.mediaType === 'audio'
                              ? '🎙️ Голосовое сообщение'
                              : lastMessage.text 
                        : 'Нет сообщений'}
                    </p>
                    
                    {/* ЗЕЛЁНЫЙ КРУЖОК СЧЕТЧИКА НЕПРОЧИТАННЫХ */}
                    {chat.unreadCount > 0 && (
                      <span className="bg-emerald-500 text-white text-[10px] font-bold h-4 min-w-4 px-1 rounded-full flex items-center justify-center select-none shrink-0 animate-pulse">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>

                </div>
              </button>
            );
          })
        )}
      </div>
      {/* Подвал сайдбара с кнопками темы и выхода */}
      <div className="p-3 border-t border-zinc-100 dark:border-zinc-900 flex flex-col gap-2 bg-zinc-50/50 dark:bg-zinc-950/20">
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-zinc-400 font-medium">Mini Messenger v1.3</span>
          <button
            onClick={onToggleTheme}
            className="p-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-amber-500 rounded-xl transition active:scale-95 text-sm shadow-sm"
            title={isDarkMode ? "Включить светлую тему" : "Включить темную тему"}
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
        </div>
        
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-zinc-100 hover:bg-red-50 dark:bg-zinc-900 dark:hover:bg-red-950/30 px-4 py-2.5 text-sm font-medium text-zinc-600 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 transition duration-200 cursor-pointer"
        >
          <span>🚪</span>
          Выйти из аккаунта
        </button>
      </div>

    </div>
  );
}
