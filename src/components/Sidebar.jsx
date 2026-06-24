import React, { useState } from 'react'; // Добавили useState сюда

export default function Sidebar({ 
  chats, 
  activeChatId, 
  setActiveChatId, 
  searchQuery, 
  setSearchQuery,
  isDarkMode,
  onToggleTheme,
  onLogout,
  channels,
  onSelectChat,
  onCreateChannel // Добавляем новый проп-коллбэк для связи с App.jsx
}) {
  
  // Стейты для управления модалкой создания канала
  const [isNewChannelModalOpen, setIsNewChannelModalOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelAvatar, setNewChannelAvatar] = useState('📢');
  //Вспомогательная функция безопасного форматирования времени Prisma (ISO -> ЧЧ:ММ)
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
      // Отправляем данные наверх в App.jsx, пускай он сам сделает POST запрос, так как у него есть userId
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
{/* Кнопка создания канала */}
      <div className="flex items-center justify-between px-4 py-2 text-zinc-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wider">
        <span>Каналы</span>
        <button 
          onClick={() => setIsNewChannelModalOpen(true)}
          className="hover:text-emerald-500 transition-colors text-sm"
          title="Создать канал"
        >
          ➕
        </button>
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
                onClick={() => {
                  // ПРОВЕРКА: Перенаправляем клик в функцию обработки в App.jsx
                  if (typeof onSelectChat === 'function') {
                    const chatIdStr = chat.id.toString();
                    
                    // Если префиксов нет, принудительно добавляем их на основе флага приватности
                    let strictChatId = chatIdStr;
                    if (!chatIdStr.startsWith('user_') && !chatIdStr.startsWith('channel_') && chatIdStr !== 'chat_general') {
                      strictChatId = chat.isPrivate ? `user_${chatIdStr}` : `channel_${chatIdStr}`;
                    }

                    onSelectChat(strictChatId);
                  } else {
                    // Страховочный fallback
                    setActiveChatId(chat.id);
                  }
                }}
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


      {/* ========================================================= */}
      {/* 🔥 БЛОК: ПУБЛИЧНЫЕ КАНАЛЫ (Идеально закрытый синтаксис) */}
      {/* ========================================================= */}
      <div className="mt-2 border-t border-zinc-100 dark:border-zinc-900 px-2 py-3 space-y-1">
        <div className="px-3 mb-2 text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
          🗣️ Публичные каналы
        </div>

        {channels && channels.length > 0 ? (
          channels.map((channel) => {
            const isChannelActive = activeChatId === `channel_${channel.id}`;
            return (
               <button
                key={`channel_${channel.id}`} // 🔥 ИСПРАВЛЕНО: привязали к channel
                onClick={() => {
                  if (typeof onSelectChat === 'function') {
                    // 🔥 ИСПРАВЛЕНО: для каналов шлем строго префикс channel_
                    onSelectChat(`channel_${channel.id}`); 
                  } else {
                    setActiveChatId(`channel_${channel.id}`);
                  }
                }}
                className={`w-full flex items-center p-3 rounded-xl transition-all select-none text-left ${
                  isChannelActive 
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/30' 
                    : 'hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                <div className="w-11 h-11 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xl mr-3 shadow-sm">
                  {channel.avatar || '📢'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h3 className="font-semibold text-xs text-zinc-800 dark:text-zinc-100 truncate">{channel.name}</h3>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate flex-1">
                      Официальный канал вещания
                    </p>
                  </div>
                </div>
              </button>
            );
          })
        ) : (
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 text-center py-2 italic">Нет доступных каналов</p>
        )}
      </div>
      {/* ========================================================= */}

      

      
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

