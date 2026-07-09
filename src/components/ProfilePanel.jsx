import React, { useState, useEffect } from 'react';
import { getAvatarUrl } from '../utils/avatarUtils';
import { API_BASE_URL } from '../config';

export default function ProfilePanel({ activeChat, isOpen, onClose, socketRef, onMemberRemoved, onMemberAdded, onChatDeleted }) {
  const [activeTab, setActiveTab] = useState('media');
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isMuteLoading, setIsMuteLoading] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');

  // Получаем участников канала или группового чата
  useEffect(() => {
    if (!isOpen || !activeChat) return;
    
    console.log('📋 activeChat в ProfilePanel:', activeChat);
    
    if (activeChat.type === 'channel') {
      fetchChannelMembers();
    }
    
    if (activeChat.type === 'group') {
      fetchChatMembers();
    }
    fetchMuteStatus();
  }, [isOpen, activeChat]);

  // Функция загрузки участников канала (ОДНА!)
  const fetchChannelMembers = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const channelId = activeChat.id.replace('channel_', '');
      
      console.log(`📡 Запрос участников для канала ${channelId}`);
      
      const response = await fetch(`http://localhost:5001/api/channels/${channelId}/members`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Ответ сервера:', response.status, errorText);
        throw new Error('Ошибка загрузки участников');
      }
      
      const data = await response.json();
      console.log('✅ Участники канала загружены:', data);
      setMembers(Array.isArray(data) ? data.filter(m => m && m.id) : []);
      
    } catch (error) {
      console.error('Ошибка получения участников:', error);
      setMembers([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Функция загрузки участников группового чата
  const fetchChatMembers = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const chatId = activeChat.id.replace('chat_', '');
      
      console.log(`📡 Запрос участников для группового чата ${chatId}`);
      
      const response = await fetch(`http://localhost:5001/api/chats/${chatId}/members`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Ответ сервера:', response.status, errorText);
        throw new Error('Ошибка загрузки участников чата');
      }
      
      const data = await response.json();
      console.log('✅ Участники группового чата загружены:', data);
      setMembers(Array.isArray(data) ? data.filter(m => m && m.id) : []);
      
    } catch (error) {
      console.error('Ошибка получения участников чата:', error);
      setMembers([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Получаем всех пользователей для добавления
  useEffect(() => {
    if (!showAddMember) return;
    
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:5001/api/users', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Ошибка загрузки пользователей');
        
        const data = await response.json();
        const memberIds = (members || []).filter(m => m && m.userId).map(m => m.userId);
        setAllUsers(data.filter(u => !memberIds.includes(u.dbId || u.id)));
      } catch (error) {
        console.error('Ошибка получения пользователей:', error);
      }
    };

    fetchUsers();
  }, [showAddMember, members]);

  // Добавить участника (для каналов И групповых чатов)
const handleAddMember = async () => {
    if (!selectedUserId) return;
    
    try {
        const token = localStorage.getItem('token');
        let newMember;
        let chatTypeForSocket;
        
        // ✅ ДЛЯ ГРУППОВЫХ ЧАТОВ
        if (activeChat.type === 'group') {
            const chatId = activeChat.id.replace('chat_', '');
            chatTypeForSocket = 'group';
            
            const response = await fetch(`http://localhost:5001/api/chats/${chatId}/members`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId: parseInt(selectedUserId) })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка добавления участника');
            }
            
            newMember = await response.json();
            console.log('✅ Участник добавлен в группу:', newMember);
            
        // ✅ ДЛЯ КАНАЛОВ
        } else if (activeChat.type === 'channel') {
            const channelId = activeChat.id.replace('channel_', '');
            chatTypeForSocket = 'channel';
            
            console.log(`📤 Добавляем пользователя ${selectedUserId} в канал ${channelId}`);
            
            const response = await fetch(`http://localhost:5001/api/channels/${channelId}/members`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId: parseInt(selectedUserId) })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка добавления участника в канал');
            }
            
            newMember = await response.json();
            console.log('✅ Участник добавлен в канал:', newMember);
        }
        
       // ✅ ОБНОВЛЯЕМ ЛОКАЛЬНЫЙ СПИСОК (с проверкой на дубликаты)
setMembers(prev => {
    const memberExists = prev.some(m => m.userId === newMember.userId);
    if (memberExists) return prev;
    return [...prev, newMember];
});
        
        // ✅ ОТПРАВЛЯЕМ СОБЫТИЕ ЧЕРЕЗ СОКЕТ
        if (socketRef?.current) {
            socketRef.current.emit('add_member', {
                chatId: activeChat.id,
                userId: parseInt(selectedUserId),
                chatType: chatTypeForSocket
            });
            console.log(`📤 Отправлено add_member в ${activeChat.id} (${chatTypeForSocket})`);
        }
        
        // ✅ ВЫЗЫВАЕМ onMemberAdded ДЛЯ ОБНОВЛЕНИЯ В APP
        if (onMemberAdded && newMember) {
            onMemberAdded(activeChat.id, newMember);
        }
        
        setShowAddMember(false);
        setSelectedUserId('');
        
    } catch (error) {
        console.error('❌ Ошибка добавления участника:', error);
        alert('Не удалось добавить участника: ' + error.message);
    }
};

  // 🔕 ФУНКЦИЯ ЗАГРУЗКИ СТАТУСА "НЕ БЕСПОКОИТЬ"
  const fetchMuteStatus = async () => {
    if (!activeChat) return;
    
    try {
      const token = localStorage.getItem('token');
      let type, id;
      
      if (activeChat.type === 'private') {
        type = 'private';
        id = activeChat.id?.replace('user_', '');
      } else if (activeChat.type === 'channel') {
        type = 'channel';
        id = activeChat.id?.replace('channel_', '');
      } else if (activeChat.type === 'group') {
        type = 'chat';
        id = activeChat.id?.replace('chat_', '');
      } else {
        return;
      }

      if (!id) return;

      const response = await fetch(
        `${API_BASE_URL}/api/mute-status?type=${type}&id=${id}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setIsMuted(data.muted);
      }
    } catch (error) {
      console.error('Ошибка загрузки статуса mute:', error);
    }
  };

  // 🔕 ФУНКЦИЯ ПЕРЕКЛЮЧЕНИЯ РЕЖИМА
  const handleToggleMute = async () => {
    setIsMuteLoading(true);
    try {
      const token = localStorage.getItem('token');
      let type, id;
      
      if (activeChat.type === 'private') {
        type = 'private';
        id = activeChat.id?.replace('user_', '');
      } else if (activeChat.type === 'channel') {
        type = 'channel';
        id = activeChat.id?.replace('channel_', '');
      } else if (activeChat.type === 'group') {
        type = 'chat';
        id = activeChat.id?.replace('chat_', '');
      } else {
        return;
      }

      if (!id) return;

      const response = await fetch(`${API_BASE_URL}/api/mute`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type, id })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ошибка');
      }

      const data = await response.json();
      setIsMuted(data.muted);
      
    } catch (error) {
      console.error('Ошибка переключения mute:', error);
      alert('Не удалось изменить режим');
    } finally {
      setIsMuteLoading(false);
    }
  };

  // Удалить участника
  // Удалить участника
const handleRemoveMember = async (userId) => {
    const isChannel = activeChat.type === 'channel';
    const isGroup = activeChat.type === 'group';
    
    // ✅ ЗАЩИТА: НЕЛЬЗЯ УДАЛИТЬ САМОГО СЕБЯ
    if (userId === currentUserId) {
        alert('❌ Вы не можете удалить самого себя из чата');
        return;
    }
    
    const chatTypeLabel = isChannel ? 'канала' : 'группового чата';
    if (!confirm(`Удалить участника из ${chatTypeLabel}?`)) return;
    
    try {
        let chatTypeForSocket;
        
        if (isChannel) {
            chatTypeForSocket = 'channel';
        } else if (isGroup) {
            chatTypeForSocket = 'group';
        } else {
            alert('❌ Нельзя удалять участников из этого типа чата');
            return;
        }
        
        if (socketRef?.current) {
            console.log(`📤 Отправляю remove_member: chatId=${activeChat.id}, userId=${userId}, chatType=${chatTypeForSocket}`);
            socketRef.current.emit('remove_member', {
                chatId: activeChat.id,
                userId: userId,
                chatType: chatTypeForSocket
            });
            
            setMembers(prev => prev.filter(m => m.userId !== userId));
            console.log(`✅ Локально удален участник ${userId} из списка`);
        } else {
            alert('❌ Нет подключения к серверу');
        }
        
    } catch (error) {
        console.error('Ошибка удаления участника:', error);
        alert('Не удалось удалить участника: ' + error.message);
    }
};

  if (!isOpen || !activeChat) return null;

  const messages = activeChat?.messages || [];
  const mediaImages = messages.filter(msg => msg && msg.mediaType === 'image' && !msg.isDeleted);
  const audioFiles = messages.filter(msg => msg && msg.mediaType === 'audio' && !msg.isDeleted);
  
  const currentUserId = JSON.parse(localStorage.getItem('user') || '{}').id;
  const isAdmin = activeChat.type === 'channel' 
    ? members.some(m => m.userId === currentUserId && m.role === 'admin')
    : activeChat.creatorId === currentUserId;
  const isCreator = activeChat.creatorId === currentUserId; 

  console.log('🔍 ProfilePanel DEBUG:', {
    activeChatType: activeChat?.type,
    activeChatId: activeChat?.id,
    creatorId: activeChat?.creatorId,
    currentUserId: currentUserId,
    isCreator: isCreator,
    isAdmin: isAdmin,
    membersCount: members.length,
  });

  const handleMediaClick = (messageId) => {
    const element = document.getElementById(`msg-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('highlight-animation');
      setTimeout(() => element.classList.remove('highlight-animation'), 2000);
    }
  };

  // Удалить канал
  const handleDeleteChannel = async () => {
    if (!activeChat || !activeChat.id) {
      alert('❌ Канал уже удален или не существует');
      onClose();
      return;
    }
    
    if (!confirm(`Вы уверены, что хотите удалить канал "${activeChat?.name}"? Это действие необратимо!`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const channelId = activeChat.id.replace('channel_', '');
      
      console.log(`🗑️ Удаляем канал ${channelId}`);
      
      const response = await fetch(`http://localhost:5001/api/channels/${channelId}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 404) {
        console.log('❌ Канал уже удален');
        alert('❌ Канал уже был удален');
        onClose();
        return;
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ошибка удаления канала');
      }
      
      console.log('✅ Канал удален');
      onClose();
      
    } catch (error) {
      console.error('❌ Ошибка удаления канала:', error);
      alert('Не удалось удалить канал: ' + error.message);
      onClose();
    }
  };

  // Удалить групповой чат
  const handleDeleteChat = async () => {
    if (!activeChat || !activeChat.id) {
      alert('❌ Чат уже удален или не существует');
      onClose();
      return;
    }
    
    if (!confirm(`Вы уверены, что хотите удалить чат "${activeChat?.name}"? Это действие необратимо!`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const chatId = activeChat.id.replace('chat_', '');
      
      console.log(`🗑️ Удаляем групповой чат ${chatId}`);
      
      const response = await fetch(`http://localhost:5001/api/chats/${chatId}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 404) {
        alert('❌ Чат уже был удален');
        onClose();
        return;
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ошибка удаления чата');
      }
      
      console.log('✅ Групповой чат удален');
      onClose();
      
    } catch (error) {
      console.error('❌ Ошибка удаления группового чата:', error);
      alert('Не удалось удалить чат: ' + error.message);
      onClose();
    }
  };

  return (
    <div className={`w-80 h-full border-l flex flex-col animate-fade-in fixed right-0 top-0 z-50 md:relative md:z-0 shadow-2xl md:shadow-none ${
      document.documentElement.classList.contains('dark') 
        ? 'bg-zinc-950 border-zinc-800' 
        : 'bg-white border-zinc-200'
    }`}>      
      <div className={`p-4 border-b flex items-center justify-between ${
        document.documentElement.classList.contains('dark') 
          ? 'border-zinc-800 bg-zinc-950/40' 
          : 'border-zinc-200 bg-white/40'
      }`}>
        <h3 className={`font-semibold text-sm ${
          document.documentElement.classList.contains('dark') 
            ? 'text-zinc-200' 
            : 'text-zinc-800'
        }`}>Информация</h3>
        <button 
          onClick={onClose} 
          className={`p-1.5 rounded-lg transition ${
            document.documentElement.classList.contains('dark') 
              ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' 
              : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
          }`}
          title="Закрыть"
        >
          ✕
        </button>
      </div>

      <div className={`flex-1 overflow-y-auto p-5 space-y-6 no-scrollbar ${
        document.documentElement.classList.contains('dark') 
          ? 'text-zinc-200' 
          : 'text-zinc-800'
      }`}>
        
        <div className="flex flex-col items-center text-center space-y-3">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center text-5xl shadow-lg border-2 overflow-hidden ${
            document.documentElement.classList.contains('dark') 
              ? 'bg-zinc-800 border-zinc-700/50' 
              : 'bg-zinc-100 border-zinc-300/50'
          }`}>
            {activeChat.avatar && typeof activeChat.avatar === 'string' && activeChat.avatar.startsWith('/uploads/') ? (
              <img 
                src={getAvatarUrl(activeChat.avatar)} 
                alt={activeChat.name} 
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentElement.textContent = activeChat.name?.[0]?.toUpperCase() || '💬';
                }}
              />
            ) : (
              <span>{activeChat.avatar || '💬'}</span>
            )}
          </div>

          <div className="w-full">
            <h2 className={`font-bold text-lg leading-tight ${
              document.documentElement.classList.contains('dark') 
                ? 'text-white' 
                : 'text-zinc-900'
            }`}>
              {activeChat.name}
            </h2>
            <span className={`text-xs ...`}>
              {activeChat.type === 'channel' ? '📢 Канал' : 
               activeChat.type === 'group' ? '👥 Групповой чат' : 
               '💬 Чат'}
            </span>
          </div>
        </div>

        <hr className={`${
          document.documentElement.classList.contains('dark') 
            ? 'border-zinc-800/60' 
            : 'border-zinc-200/60'
        }`} />

        {(activeChat.type === 'channel' || activeChat.type === 'group') && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <h4 className={`text-sm font-semibold ${
                document.documentElement.classList.contains('dark') 
                  ? 'text-zinc-300' 
                  : 'text-zinc-700'
              }`}>
                Участники ({members.length})
              </h4>
              {isAdmin && (
                <button 
                  onClick={() => setShowAddMember(!showAddMember)}
                  className="text-xs text-emerald-400 hover:text-emerald-300 transition"
                >
                  {showAddMember ? '✕ Отмена' : '+ Добавить'}
                </button>
              )}
            </div>
            
            {showAddMember && (
              <div className={`mb-3 p-3 rounded-lg ${
                document.documentElement.classList.contains('dark') 
                  ? 'bg-zinc-900' 
                  : 'bg-zinc-100'
              }`}>
                <div className="max-h-48 overflow-y-auto space-y-1 mb-2">
                  {allUsers.length === 0 ? (
                    <div className="text-center text-zinc-400 text-sm py-2">Нет доступных пользователей</div>
                  ) : (
                    allUsers.map(user => {
                      const avatarUrl = user.avatar && typeof user.avatar === 'string' && user.avatar.startsWith('/uploads/') 
                        ? `http://localhost:5001${user.avatar}` 
                        : user.avatar || '👤';
                      
                      return (
                        <label 
                          key={user.id} 
                          className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition ${
                            selectedUserId === String(user.dbId || user.id)
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50'
                              : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <input
                            type="radio"
                            name="selectedUser"
                            value={user.dbId || user.id}
                            checked={selectedUserId === String(user.dbId || user.id)}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                            className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                          />
                          <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {user.avatar && typeof user.avatar === 'string' && user.avatar.startsWith('/uploads/') ? (
                              <img 
                                src={avatarUrl} 
                                alt={user.username} 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.parentElement.textContent = user.username?.[0]?.toUpperCase() || '👤';
                                }}
                              />
                            ) : (
                              <span className="text-sm">{user.avatar || '👤'}</span>
                            )}
                          </div>
                          <span className="text-sm text-zinc-700 dark:text-zinc-300">
                            {user.name || user.username}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>

                <button
                  onClick={handleAddMember}
                  disabled={!selectedUserId}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2 rounded-lg transition"
                >
                  Добавить участника
                </button>
              </div>
            )}
            
            {isLoading ? (
              <div className={`text-center py-4 text-sm ${
                document.documentElement.classList.contains('dark') 
                  ? 'text-zinc-500' 
                  : 'text-zinc-400'
              }`}>Загрузка...</div>
            ) : !members || members.length === 0 ? (
              <div className={`text-center py-4 text-sm ${
                document.documentElement.classList.contains('dark') 
                  ? 'text-zinc-500' 
                  : 'text-zinc-400'
              }`}>Нет участников</div>
            ) : (
              <div className="space-y-2">

 {members
    .filter(m => m && m.id)
    .map((member) => {
        const userData = member?.user || {};
        const username = userData?.username || 'Неизвестный';
        const avatar = userData?.avatar || '👤';
        const role = member?.role || 'member';
        const isSelf = member.userId === currentUserId; // ← ДОБАВЬ
        
        return (
            <div key={member.id} className={`flex items-center justify-between p-2 rounded-lg transition ${
                document.documentElement.classList.contains('dark') 
                    ? 'bg-zinc-900/50 hover:bg-zinc-900' 
                    : 'bg-zinc-100/50 hover:bg-zinc-100'
            }`}>
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm overflow-hidden ${
                        document.documentElement.classList.contains('dark') 
                            ? 'bg-zinc-800' 
                            : 'bg-zinc-200'
                    }`}>
                        {avatar && typeof avatar === 'string' && avatar.startsWith('/uploads/') ? (
                            <img 
                                src={getAvatarUrl(avatar)} 
                                alt={username} 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.parentElement.textContent = username?.[0]?.toUpperCase() || '👤';
                                }}
                            />
                        ) : (
                            <span>{avatar}</span>
                        )}
                    </div>

                    <div>
                        <p className={`text-sm font-medium ${
                            document.documentElement.classList.contains('dark') 
                                ? 'text-zinc-200' 
                                : 'text-zinc-800'
                        }`}>
                            {username}
                            {isSelf && (
                                <span className="ml-1.5 text-[10px] text-emerald-400 dark:text-emerald-500 font-medium">
                                    (Вы)
                                </span>
                            )}
                        </p>
                        <span className={`text-xs ${
                            document.documentElement.classList.contains('dark') 
                                ? 'text-zinc-500' 
                                : 'text-zinc-400'
                        }`}>
                            {role === 'admin' ? '👑 Админ' : '👤 Участник'}
                        </span>
                    </div>
                </div>

                {isAdmin && role !== 'admin' && !isSelf && (
                    <button 
                        onClick={() => handleRemoveMember(member.userId)}
                        className="text-xs text-red-400 hover:text-red-300 transition opacity-50 hover:opacity-100"
                    >
                        Удалить
                    </button>
                )}
            </div>
        );
    })}


              </div>
            )}
          </div>
        )}
        
        <hr className={`${
          document.documentElement.classList.contains('dark') 
            ? 'border-zinc-800/60' 
            : 'border-zinc-200/60'
        }`} />

        <div>
          <button
            onClick={handleToggleMute}
            disabled={isMuteLoading}
            className={`w-full py-2.5 px-4 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 ${
              isMuted 
                ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300' 
                : 'bg-zinc-800/30 hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-300'
            }`}
          >
            <span>{isMuted ? '🔕' : '🔔'}</span>
            {isMuted ? 'Включить уведомления' : 'Отключить уведомления'}
            {isMuteLoading && (
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin ml-1"></span>
            )}
          </button>
        </div>

        <hr className={`${
          document.documentElement.classList.contains('dark') 
            ? 'border-zinc-800/60' 
            : 'border-zinc-200/60'
        }`} />

        {activeChat?.type === 'channel' && isCreator && (
          <div className="mt-4 pt-4 border-t border-zinc-800/60">
            <button
              onClick={handleDeleteChannel}
              className="w-full py-2 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2"
            >
              <span>🗑️</span>
              Удалить канал
            </button>
          </div>
        )}
        
        {activeChat?.type === 'group' && isCreator && (
          <div className="mt-4 pt-4 border-t border-zinc-800/60">
            <button
              onClick={handleDeleteChat}
              className="w-full py-2 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2"
            >
              <span>🗑️</span>
              Удалить групповой чат
            </button>
          </div>
        )}
        
        <hr className={`${
          document.documentElement.classList.contains('dark') 
            ? 'border-zinc-800/60' 
            : 'border-zinc-200/60'
        }`} />

        <div className={`flex border-b text-xs ${
          document.documentElement.classList.contains('dark') 
            ? 'border-zinc-800/60' 
            : 'border-zinc-200/60'
        }`}>
          <button 
            onClick={() => setActiveTab('media')}
            className={`flex-1 pb-2.5 font-semibold uppercase tracking-wider transition-colors ${
              activeTab === 'media' 
                ? document.documentElement.classList.contains('dark')
                  ? 'border-b border-white text-white'
                  : 'border-b border-zinc-800 text-zinc-800'
                : document.documentElement.classList.contains('dark')
                  ? 'text-zinc-500 hover:text-zinc-300'
                  : 'text-zinc-400 hover:text-zinc-600'
            }`}
          >
            Медиа ({mediaImages.length})
          </button>
          <button 
            onClick={() => setActiveTab('audio')}
            className={`flex-1 pb-2.5 font-semibold uppercase tracking-wider transition-colors ${
              activeTab === 'audio' 
                ? document.documentElement.classList.contains('dark')
                  ? 'border-b border-white text-white'
                  : 'border-b border-zinc-800 text-zinc-800'
                : document.documentElement.classList.contains('dark')
                  ? 'text-zinc-500 hover:text-zinc-300'
                  : 'text-zinc-400 hover:text-zinc-600'
            }`}
          >
            Аудио ({audioFiles.length})
          </button>
        </div>

        <div className="pt-2">
          {activeTab === 'media' && (
            <>
              {mediaImages.length === 0 ? (
                <p className={`text-xs italic text-center py-4 rounded-xl border border-dashed ${
                  document.documentElement.classList.contains('dark') 
                    ? 'text-zinc-500 bg-zinc-900/20 border-zinc-800/40' 
                    : 'text-zinc-400 bg-zinc-100/20 border-zinc-300/40'
                }`}>
                  Нет отправленных изображений
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {mediaImages.map(msg => (
                    <div 
                      key={msg.id} 
                      onClick={() => handleMediaClick(msg.id)}
                      className={`aspect-square rounded-lg overflow-hidden border group relative cursor-pointer ${
                        document.documentElement.classList.contains('dark') 
                          ? 'bg-zinc-900 border-zinc-800' 
                          : 'bg-zinc-100 border-zinc-300'
                      }`}
                    >
                      <img 
                        src={msg.mediaUrl} 
                        alt="Shared" 
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'audio' && (
            <>
              {audioFiles.length === 0 ? (
                <p className={`text-xs italic text-center py-4 rounded-xl border border-dashed ${
                  document.documentElement.classList.contains('dark') 
                    ? 'text-zinc-500 bg-zinc-900/20 border-zinc-800/40' 
                    : 'text-zinc-400 bg-zinc-100/20 border-zinc-300/40'
                }`}>
                  Нет отправленных аудиосообщений
                </p>
              ) : (
                <div className="space-y-2">
                  {audioFiles.map(msg => (
                    <div 
                      key={msg.id}
                      onClick={() => handleMediaClick(msg.id)}
                      className={`p-2.5 border rounded-xl flex items-center gap-3 cursor-pointer transition-colors ${
                        document.documentElement.classList.contains('dark') 
                          ? 'bg-zinc-900 hover:bg-zinc-900/80 border-zinc-800' 
                          : 'bg-zinc-100 hover:bg-zinc-100/80 border-zinc-300'
                      }`}
                    >
                      <div className={`text-xl p-1.5 rounded-lg ${
                        document.documentElement.classList.contains('dark') 
                          ? 'bg-zinc-800' 
                          : 'bg-zinc-200'
                      }`}>🎙️</div>
                      <div className="flex-1 min-w-0">
                        <span className={`text-[10px] block mb-1 ${
                          document.documentElement.classList.contains('dark') 
                            ? 'text-zinc-500' 
                            : 'text-zinc-400'
                        }`}>
                          {msg.createdAt ? new Date(msg.createdAt).toLocaleDateString() : 'Голосовое сообщение'}
                        </span>
                        <audio 
                          src={msg.mediaUrl || msg.audio || msg.fileUrl || ""}
                          controls 
                          className={`w-full h-6 text-xs ${
                            document.documentElement.classList.contains('dark') 
                              ? 'filter invert opacity-70 hover:opacity-100' 
                              : 'opacity-80 hover:opacity-100'
                          }`}
                          onClick={(e) => e.stopPropagation()} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}