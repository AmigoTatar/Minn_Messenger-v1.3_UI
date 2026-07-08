import React, { useState, useEffect } from 'react';
import { CHAT_IDS } from '../config';
import { getAvatarUrl } from '../utils/avatarUtils';
import SearchModal from './SearchModal';

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
  groupChats = [], 
  onSelectChat,
  onCreateChannel,
  onCreateGroupChat,
  unreadCounts = {},
  onMarkAsRead,
  user, 
  setUser,  
  onUpdateUser
}) {
  
  const { GENERAL, GENERAL_ALT } = CHAT_IDS;
  const [isNewChannelModalOpen, setIsNewChannelModalOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelAvatar, setNewChannelAvatar] = useState('📢');
  const [isNewGroupChatModalOpen, setIsNewGroupChatModalOpen] = useState(false);
  const [newGroupChatName, setNewGroupChatName] = useState('');
  const [newGroupChatAvatar, setNewGroupChatAvatar] = useState('💬');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [allUsersForChat, setAllUsersForChat] = useState([]);
  const [localAvatar, setLocalAvatar] = useState(user?.avatar || '👤');
  const [mutedStatuses, setMutedStatuses] = useState({});
  const [isSearchOpen, setIsSearchOpen] = useState(false);


  // ==========================================
// 👤 РЕДАКТИРОВАНИЕ ПРОФИЛЯ
// ==========================================
const [isEditingProfile, setIsEditingProfile] = useState(false);
const [editName, setEditName] = useState('');

// Функция загрузки статусов mute для всех чатов
useEffect(() => {
  const fetchMuteStatuses = async () => {
    const token = localStorage.getItem('token');
    const statuses = {};
    
    // Проверяем приватные чаты
    for (const chat of chats) {
      if (chat.id && chat.id.startsWith('user_')) {
        const userId = chat.id.replace('user_', '');
        try {
          const response = await fetch(
            `${API_BASE_URL}/api/mute-status?type=private&id=${userId}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
          if (response.ok) {
            const data = await response.json();
            statuses[chat.id] = data.muted;
          }
        } catch (e) {}
      }
    }
    
    // Проверяем каналы
    for (const channel of channels) {
      if (channel.id) {
        try {
          const response = await fetch(
            `${API_BASE_URL}/api/mute-status?type=channel&id=${channel.id}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
          if (response.ok) {
            const data = await response.json();
            statuses[`channel_${channel.id}`] = data.muted;
          }
        } catch (e) {}
      }
    }
    
    // Проверяем групповые чаты
    for (const group of groupChats) {
      if (group.dbId || group.id) {
        const groupId = group.dbId || group.id;
        try {
          const response = await fetch(
            `${API_BASE_URL}/api/mute-status?type=chat&id=${groupId}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
          if (response.ok) {
            const data = await response.json();
            statuses[group.id] = data.muted;
          }
        } catch (e) {}
      }
    }
    
    setMutedStatuses(statuses);
  };
  
  if (chats.length > 0 || channels.length > 0 || groupChats.length > 0) {
    fetchMuteStatuses();
  }
}, [chats, channels, groupChats]);

const handleSaveProfile = async () => {
    if (!editName.trim() || editName === user?.username) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:5001/api/users/profile', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: editName.trim() })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Ошибка обновления имени');
        }

        const data = await response.json();
        console.log('✅ Имя обновлено:', data);

        // Обновляем локального пользователя
        const updatedUser = { ...user, username: data.user.username };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        // Передаём обновлённого пользователя в App
        if (onUpdateUser) {
            onUpdateUser(updatedUser);
        }

        setIsEditingProfile(false);
        setEditName('');
        
      
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        alert('Не удалось изменить имя: ' + error.message);
    }
};

// ==========================================
// 📷 ЗАГРУЗКА АВАТАРКИ
// ==========================================
const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Проверка размера (максимум 5 МБ)
    if (file.size > 5 * 1024 * 1024) {
        alert('❌ Файл слишком большой. Максимум 5 МБ.');
        return;
    }

    // Проверка типа
    if (!file.type.startsWith('image/')) {
        alert('❌ Пожалуйста, выберите изображение');
        return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:5001/api/users/avatar', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Ошибка загрузки аватарки');
        }

        const data = await response.json();
        console.log('✅ Аватарка обновлена:', data);

        // Обновляем локального пользователя
        const updatedUser = { ...user, avatar: data.user.avatar };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        if (onUpdateUser) {
            onUpdateUser(updatedUser);
        }

    } catch (error) {
        console.error('❌ Ошибка:', error);
        alert('Не удалось загрузить аватарку: ' + error.message);
    }
    
    // Очищаем инпут
    e.target.value = '';
};

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

    setNewChannelName('');
    setNewChannelAvatar('📢');
    setIsNewChannelModalOpen(false);
  };

  const generalUnreadCount = (() => {
    if (Array.isArray(chats)) {
      const found = chats.find(c => c && (String(c.id) === GENERAL || c.id === GENERAL_ALT || c.id === 0));
      if (found && found.unreadCount > 0) {
        return Number(found.unreadCount);
      }
    }
    if (Array.isArray(messages)) {
      const count = messages.filter(m => m && !m.receiverId && !m.channelId && m.status === 'unread').length;
      return count;
    }
    return 0;
  })();

  useEffect(() => {
    if (!isNewGroupChatModalOpen) return;
    
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:5001/api/users', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const users = await response.json();
          setAllUsersForChat(users);
        }
      } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
      }
    };
    
    fetchUsers();
  }, [isNewGroupChatModalOpen]);
  useEffect(() => {
    console.log('📊 unreadCounts изменился:', unreadCounts);
}, [unreadCounts]);

useEffect(() => {
    if (user?.avatar) {
        setLocalAvatar(user.avatar);
    }
}, [user]);

  return (
    <div className={`w-full md:w-80 h-full max-h-screen overflow-hidden border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-white dark:bg-zinc-950 transition-colors duration-300 ${activeChatId ? 'hidden md:flex' : 'flex'}`}>
      
   <div className="p-4 space-y-3">
    {/* ==========================================
        👤 МОЙ ПРОФИЛЬ (аватар + имя)
        ========================================== */}
    <div className="flex items-center gap-3 p-2 rounded-xl bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50">

{console.log('🔍 Avatar path:', user?.avatar)}



<div className="relative w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xl flex-shrink-0 overflow-hidden group">
{localAvatar && localAvatar.startsWith('/uploads/') ? (
    <img 
        src={getAvatarUrl(localAvatar)} 
        alt="avatar" 
        className="w-full h-full object-cover block"
        style={{ display: 'block', width: '100%', height: '100%' }}
        onError={(e) => {
            e.target.style.display = 'none';
            e.target.parentElement.textContent = user?.username?.[0]?.toUpperCase() || '👤';
        }}
    />
) : (
    <span className="text-xl">{localAvatar || '👤'}</span>
)}
    <label 
        htmlFor="avatar-upload" 
        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer rounded-full"
    >
        <span className="text-white text-xs font-medium">📷</span>
    </label>
    <input
        id="avatar-upload"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarUpload}
    />
</div>


        <div className="flex-1 min-w-0">
            {isEditingProfile ? (
                <div className="flex items-center gap-1">
                    <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-emerald-500 text-zinc-800 dark:text-white"
                        placeholder="Новое имя"
                        autoFocus
                    />
                    <button
                        onClick={handleSaveProfile}
                        disabled={!editName.trim() || editName === user?.username}
                        className="px-2 py-1 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition"
                    >
                        💾
                    </button>
                    <button
                        onClick={() => {
                            setIsEditingProfile(false);
                            setEditName('');
                        }}
                        className="px-2 py-1 text-xs font-medium bg-zinc-600 hover:bg-zinc-500 text-white rounded-lg transition"
                    >
                        ✕
                    </button>
                </div>
            ) : (
                <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-zinc-800 dark:text-white truncate">
                        {user?.username || 'Пользователь'}
                    </p>
                    <button
                        onClick={() => setIsEditingProfile(true)}
                        className="text-xs text-zinc-400 hover:text-emerald-400 transition opacity-60 hover:opacity-100 flex-shrink-0"
                        title="Изменить имя"
                    >
                        ✏️
                    </button>
                </div>
            )}
{user?.email && (
    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
        {user.email}
    </p>
)}
        </div>
    </div>

    {/* Заголовок и кнопки */}
    <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-zinc-800 dark:text-white">Чаты</h1>
        <div className="flex gap-2">
            <button
                onClick={() => setIsNewChannelModalOpen(true)}
                className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition shadow-md shadow-emerald-600/20"
                title="Создать канал"
            >
                📢+
            </button>
            <button
                onClick={() => setIsNewGroupChatModalOpen(true)}
                className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition shadow-md shadow-blue-600/20"
                title="Создать групповой чат"
            >
                👥+
            </button>
        </div>
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

      <div className="flex-1 overflow-y-auto no-scrollbar px-2 py-2 space-y-1">
        {/* Приватные чаты */}
{Array.isArray(chats) && chats
  .filter(chat => chat.id !== GENERAL && chat.id !== GENERAL_ALT)
  .map((chat, index) => {
    const isActive = chat.id === activeChatId;
    const lastMessage = chat.lastMessage || null;  // ✅ ДОБАВЬ ЭТУ СТРОКУ
    const unreadCount = unreadCounts[chat.id] || 0;

    return (
      <button
        key={`${chat.id}_${index}`}
        onClick={() => {
          if (typeof onSelectChat === 'function') {
            onSelectChat(chat.id);
          }
          if (unreadCount > 0 && onMarkAsRead) {
            onMarkAsRead('private', chat.id.replace('user_', ''));
          }
        }}
        className={`w-full flex items-center p-3 rounded-xl transition-all select-none text-left relative ${
          isActive 
            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/30' 
            : 'hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300'
        }`}
      >
<div className="relative mr-3 shrink-0">
    <div className="w-11 h-11 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xl shadow-sm overflow-hidden">
        {chat.avatar && typeof chat.avatar === 'string' && chat.avatar.startsWith('/uploads/') ? (
            <img 
                src={getAvatarUrl(chat.avatar)} 
                alt={chat.name} 
                className="w-full h-full object-cover"
                onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentElement.textContent = chat.name?.[0]?.toUpperCase() || '👤';
                }}
            />
        ) : (
            <span>{chat.avatar || '👤'}</span>
        )}
    </div>
    {chat.isOnline && chat.id !== 'chat_general' && !chat.id?.startsWith('channel_') && (
        <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-950 ring-1 ring-emerald-500/20 animate-pulse" />
    )}
</div>

<div className="flex-1 min-w-0">
  <div className="flex justify-between items-baseline mb-0.5">
    <div className="flex items-center gap-1">
      <h3 className="font-semibold text-xs text-zinc-800 dark:text-zinc-100 truncate">
        {chat.name}
      </h3>
      {/* 🔕 ИНДИКАТОР "НЕ БЕСПОКОИТЬ" */}
      {chat.muted && (
        <span className="text-[10px] text-amber-500 flex-shrink-0" title="Уведомления отключены">🔕</span>
      )}
    </div>
    {lastMessage && (
      <span className="text-[10px] text-zinc-400 whitespace-nowrap ml-1">
        {formatMsgTime(lastMessage.createdAt)}
      </span>
    )}
  </div>


          <div className="flex justify-between items-center gap-2">
            <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate flex-1">
              {lastMessage 
                ? lastMessage.isDeleted 
                  ? '🚫 Сообщение удалено' 
                  : lastMessage.mediaType === 'image' 
                    ? '🖼️ Фотография' 
                    : lastMessage.mediaType === 'audio' 
                      ? '🎙️ Голосовое сообщение' 
                      : lastMessage.text || 'Медиафайл'
                : 'Нет сообщений'}
            </p>
{unreadCount > 0 && (
  <span className={`text-white text-[10px] font-bold h-4 min-w-4 px-1 rounded-full flex items-center justify-center select-none shrink-0 ${
    chat.muted ? 'bg-gray-500' : 'bg-emerald-500'
  }`}>
    {unreadCount}
  </span>
)}
          </div>
        </div>
      </button>
    );
  })}

        {/* Каналы */}
{Array.isArray(channels) && channels.map((channelItem, index) => {
  if (!channelItem) return null;
  
  const isChannelActive = activeChatId === `channel_${channelItem.id}`;
  const unreadCount = unreadCounts[`channel_${channelItem.id}`] || 0;
  const lastMessage = channelItem.lastMessage || null;
  
  return (
    <button
      key={`sidebar_chan_${channelItem.id}_${index}`}
      type="button"
      onClick={() => {
        if (typeof onSelectChat === 'function') {
          onSelectChat(`channel_${channelItem.id}`);
        }
        if (unreadCount > 0 && onMarkAsRead) {
          onMarkAsRead('channel', channelItem.id);
        }
      }}
      className={`w-full flex items-center p-3 rounded-xl transition-all select-none text-left ${
        isChannelActive 
          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/30' 
          : 'hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300'
      }`}
    >
     <div className="w-11 h-11 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xl mr-3 shadow-sm overflow-hidden">
    {channelItem.avatar && channelItem.avatar.startsWith('/uploads/') ? (
        <img 
            src={getAvatarUrl(channelItem.avatar)} 
            alt={channelItem.name} 
            className="w-full h-full object-cover"
            onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.textContent = channelItem.name?.[0]?.toUpperCase() || '📢';
            }}
        />
    ) : (
        <span>{channelItem.avatar || '📢'}</span>
    )}
</div>
<div className="flex-1 min-w-0">
  <div className="flex justify-between items-baseline mb-0.5">
    <div className="flex items-center gap-1">
      <h3 className="font-semibold text-xs text-zinc-800 dark:text-zinc-100 truncate">
        {channelItem.name}
      </h3>
      {/* 🔕 ИНДИКАТОР "НЕ БЕСПОКОИТЬ" */}
      {channelItem.muted && (
        <span className="text-[10px] text-amber-500 flex-shrink-0" title="Уведомления отключены">🔕</span>
      )}
    </div>
    {lastMessage && (
      <span className="text-[10px] text-zinc-400 whitespace-nowrap ml-1">
        {formatMsgTime(lastMessage.createdAt)}
      </span>
    )}
  </div>


        <div className="flex justify-between items-center gap-2">
<p className="text-xs text-zinc-400 dark:text-zinc-500 truncate flex-1">
  {lastMessage 
    ? lastMessage.isDeleted 
      ? '🚫 Сообщение удалено' 
      : lastMessage.mediaType === 'image' 
        ? '🖼️ Фотография' 
        : lastMessage.mediaType === 'audio' 
          ? '🎙️ Голосовое сообщение' 
          : lastMessage.text || 'Медиафайл'
    : '📢 Канал'}
</p>
         {unreadCount > 0 && (
  <span className={`text-white text-[10px] font-bold h-4 min-w-4 px-1 rounded-full flex items-center justify-center select-none shrink-0 ${
    channelItem.muted ? 'bg-gray-500' : 'bg-emerald-500'
  }`}>
    {unreadCount}
  </span>
)}
        </div>
      </div>
    </button>
  );
})}

        {/* Групповые чаты */}
        {Array.isArray(groupChats) && groupChats.length > 0 && (
          <>
            <div className="px-3 pt-3 pb-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <span>👥 Групповые чаты</span>
              <span className="text-[9px] text-zinc-500">({groupChats.length})</span>
            </div>
            {groupChats.map((chat) => {
    if (!chat) return null;
    
    const isActive = activeChatId === chat.id;
    const lastMessage = chat.lastMessage || null;
    
    // ✅ ПРАВИЛЬНО ПОЛУЧАЕМ unreadCount
    const chatId = chat.id?.toString() || `chat_${chat.dbId || chat.id}`;
    const unreadCount = unreadCounts[chatId] || 0;
    
    return (
        <button
            key={`group_chat_${chat.id}`}
            type="button"
            onClick={() => {
                if (typeof onSelectChat === 'function') {
                    onSelectChat(chat.id);
                }
                if (unreadCount > 0 && onMarkAsRead) {
                    onMarkAsRead('chat', chat.id.replace('chat_', ''));
                }
            }}
            className={`w-full flex items-center p-3 rounded-xl transition-all select-none text-left ${
                isActive 
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/30' 
                    : 'hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300'
            }`}
        >
            <div className="w-11 h-11 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xl mr-3 shadow-sm relative overflow-hidden">
    {chat.avatar && chat.avatar.startsWith('/uploads/') ? (
        <img 
            src={getAvatarUrl(chat.avatar)} 
            alt={chat.name} 
            className="w-full h-full object-cover"
            onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.textContent = chat.name?.[0]?.toUpperCase() || '💬';
            }}
        />
    ) : (
        <span>{chat.avatar || '💬'}</span>
    )}
                {chat.members && chat.members.length > 0 && (
                    <span className="absolute -bottom-0.5 -right-0.5 text-[8px] bg-zinc-800 dark:bg-zinc-700 text-white rounded-full px-1 min-w-[14px] h-[14px] flex items-center justify-center border border-white dark:border-zinc-900">
                        {chat.members.length}
                    </span>
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                    <h3 className="font-semibold text-xs text-zinc-800 dark:text-zinc-100 truncate">
                        {chat.name}
                    </h3>
                    {lastMessage && (
                        <span className="text-[10px] text-zinc-400 whitespace-nowrap ml-1">
                            {formatMsgTime(lastMessage.createdAt)}
                        </span>
                    )}
                </div>

                
                <div className="flex justify-between items-center gap-2">
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate flex-1">
                        {lastMessage 
                            ? lastMessage.isDeleted ? '🚫 Сообщение удалено' : lastMessage.text || 'Медиафайл'
                            : 'Нет сообщений'}
                    </p>
                 {unreadCount > 0 && (
  <span className={`text-white text-[10px] font-bold h-4 min-w-4 px-1 rounded-full flex items-center justify-center select-none shrink-0 ${
    chat.muted ? 'bg-gray-500' : 'bg-emerald-500'
  }`}>
    {unreadCount}
  </span>
)}
                </div>
            </div>
        </button>
              );
            })}
          </>
        )}
      </div>

<div className="p-3 border-t border-zinc-100 dark:border-zinc-900 flex flex-col gap-2 bg-zinc-50/50 dark:bg-zinc-950/20 mt-auto">
  <div className="flex justify-between items-center">
    <span className="text-[11px] text-zinc-400 font-medium">Mini Messenger v3.1</span>
    <div className="flex items-center gap-1">
      {/* 🔍 КНОПКА ПОИСКА */}
      <button
        onClick={() => setIsSearchOpen(true)}
        className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition text-zinc-500 dark:text-zinc-400"
        title="Поиск (Ctrl+K)"
      >
        🔍
      </button>
      {/* КНОПКА ТЕМЫ */}
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
  </div>
  
  {/* КНОПКА ВЫХОДА */}
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

      {/* Модалка создания канала */}
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

{/* Модалка создания группового чата */}
{isNewGroupChatModalOpen && (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-zinc-100 dark:border-zinc-800">
      <h3 className="text-lg font-bold text-zinc-800 dark:text-white mb-4">
        Создать групповой чат 👥
      </h3>
      
      <form onSubmit={(e) => {
        e.preventDefault();
        if (typeof onCreateGroupChat === 'function') {
          onCreateGroupChat({
            name: newGroupChatName,
            avatar: newGroupChatAvatar || '💬',
            memberIds: selectedUsers
          });
        }
        setIsNewGroupChatModalOpen(false);
        setNewGroupChatName('');
        setNewGroupChatAvatar('💬');
        setSelectedUsers([]);
      }} className="space-y-4">
        
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Название чата
          </label>
          <input 
            type="text" 
            placeholder="Например: Команда проекта"
            value={newGroupChatName}
            onChange={(e) => setNewGroupChatName(e.target.value)}
            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-sm focus:outline-none focus:border-blue-500 text-zinc-800 dark:text-white"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Иконка (эмодзи)
          </label>
          <input 
            type="text" 
            value={newGroupChatAvatar}
            onChange={(e) => setNewGroupChatAvatar(e.target.value)}
            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-center text-2xl focus:outline-none focus:border-blue-500"
            maxLength={2}
            placeholder="💬"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Участники ({selectedUsers.length})
          </label>
          <div className="max-h-40 overflow-y-auto space-y-1 bg-zinc-50 dark:bg-zinc-950 rounded-xl p-2 border border-zinc-200 dark:border-zinc-800">
            {allUsersForChat.length === 0 ? (
              <div className="text-center text-zinc-400 text-sm py-4">Загрузка...</div>
            ) : (
              allUsersForChat.map(user => {
                // Функция для получения правильного URL аватарки
                const getAvatarDisplay = () => {
                  if (user.avatar && typeof user.avatar === 'string' && user.avatar.startsWith('/uploads/')) {
                    return (
                      <img 
                        src={`http://localhost:5001${user.avatar}`} 
                        alt={user.username} 
                        className="w-6 h-6 rounded-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentElement.textContent = user.username?.[0]?.toUpperCase() || '👤';
                        }}
                      />
                    );
                  }
                  return <span className="text-sm">{user.avatar || '👤'}</span>;
                };

                return (
                  <label key={user.id} className="flex items-center gap-3 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.dbId || user.id)}
                      onChange={() => {
                        const userId = user.dbId || user.id;
                        setSelectedUsers(prev =>
                          prev.includes(userId)
                            ? prev.filter(id => id !== userId)
                            : [...prev, userId]
                        );
                      }}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 flex-shrink-0"
                    />
                    
                    <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {getAvatarDisplay()}
                    </div>
                    
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      {user.name || user.username}
                    </span>
                  </label>
                );
              })
            )}
          </div>
          {selectedUsers.length === 0 && (
            <p className="text-xs text-zinc-400 mt-1">Выберите хотя бы одного участника</p>
          )}
        </div>

        <div className="flex justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={() => {
              setIsNewGroupChatModalOpen(false);
              setNewGroupChatName('');
              setNewGroupChatAvatar('💬');
              setSelectedUsers([]);
            }}
            className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={selectedUsers.length === 0 || !newGroupChatName.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition shadow-md shadow-blue-600/10"
          >
            Создать чат
          </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <SearchModal
  isOpen={isSearchOpen}
  onClose={() => setIsSearchOpen(false)}
  onMessageClick={(chatId, messageId) => {
    if (typeof onSelectChat === 'function') {
      onSelectChat(chatId);
    }
  }}
/>
    </div>
  );
}