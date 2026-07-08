import React, { useState, useEffect } from 'react';

export default function ProfilePanel({ activeChat, isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('media');
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');



const handleSaveName = async () => {
    if (!newName.trim() || newName === activeChat.name) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:5001/api/users/profile', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: newName.trim() })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Ошибка обновления имени');
        }

        const data = await response.json();
        console.log('✅ Имя обновлено:', data);

        // Обновляем локальный стейт (если нужно)
        // Можно также обновить активный чат через пропс
        
        setIsEditingName(false);
        setNewName('');
        
        
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        alert('Не удалось изменить имя: ' + error.message);
    }
};



// Получаем участников канала или группового чата
useEffect(() => {
  if (!isOpen || !activeChat) return;
  
  console.log('📋 activeChat в ProfilePanel:', activeChat);
  
  // Для каналов
  if (activeChat.type === 'channel') {
    fetchChannelMembers();
  }
  
  // Для групповых чатов
  if (activeChat.type === 'group') {
    fetchChatMembers();
  }
}, [isOpen, activeChat]);

// Функция загрузки участников канала
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
    setMembers(data);
    
  } catch (error) {
    console.error('Ошибка получения участников:', error);
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
    setMembers(data);
    
  } catch (error) {
    console.error('Ошибка получения участников чата:', error);
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
        // Фильтруем тех, кто уже в канале
        const memberIds = members.map(m => m.userId);
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
    
    // Определяем тип чата
    if (activeChat.type === 'channel') {
      // Для каналов
      const channelId = activeChat.id.replace('channel_', '');
      const response = await fetch(`http://localhost:5001/api/channels/${channelId}/members`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: parseInt(selectedUserId) })
      });
      
      if (!response.ok) throw new Error('Ошибка добавления участника');
      
      const newMember = await response.json();
      setMembers([...members, newMember]);
      
    } else if (activeChat.type === 'group') {
      // Для групповых чатов
      const chatId = activeChat.id.replace('chat_', '');
      const response = await fetch(`http://localhost:5001/api/chats/${chatId}/members`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: parseInt(selectedUserId) })
      });
      
      if (!response.ok) throw new Error('Ошибка добавления участника в группу');
      
      const newMember = await response.json();
      setMembers([...members, newMember]);
    }
    
    setShowAddMember(false);
    setSelectedUserId('');
    
  } catch (error) {
    console.error('Ошибка добавления участника:', error);
    alert('Не удалось добавить участника: ' + error.message);
  }
};

  // Удалить участника
  const handleRemoveMember = async (userId) => {
    if (!confirm('Удалить участника из канала?')) return;
    
    try {
      const token = localStorage.getItem('token');
      const channelId = activeChat.id.replace('channel_', '');
      
      const response = await fetch(`http://localhost:5001/api/channels/${channelId}/members/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Ошибка удаления участника');
      
      setMembers(members.filter(m => m.userId !== userId));
    } catch (error) {
      console.error('Ошибка удаления участника:', error);
      alert('Не удалось удалить участника');
    }
  };
// Удалить участника из группового чата
const handleRemoveChatMember = async (userId) => {
  if (!confirm('Удалить участника из группового чата?')) return;
  
  try {
    const token = localStorage.getItem('token');
    const chatId = activeChat.id.replace('chat_', '');
    
    const response = await fetch(`http://localhost:5001/api/chats/${chatId}/members/${userId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error('Ошибка удаления участника');
    
    setMembers(members.filter(m => m.userId !== userId));
  } catch (error) {
    console.error('Ошибка удаления участника из чата:', error);
    alert('Не удалось удалить участника');
  }
};
  if (!isOpen || !activeChat) return null;

  const messages = activeChat?.messages || [];
  const mediaImages = messages.filter(msg => msg && msg.mediaType === 'image' && !msg.isDeleted);
  const audioFiles = messages.filter(msg => msg && msg.mediaType === 'audio' && !msg.isDeleted);
  
  // Проверяем, является ли пользователь админом канала
const currentUserId = JSON.parse(localStorage.getItem('user') || '{}').id;
const isAdmin = activeChat.type === 'channel' 
  ? members.some(m => m.userId === currentUserId && m.role === 'admin')
  : activeChat.creatorId === currentUserId;
const isCreator = activeChat.creatorId === currentUserId; 


 // ✅ ДОБАВЛЯЕМ ОТЛАДОЧНЫЕ ЛОГИ
  console.log('🔍 ProfilePanel DEBUG:', {
    activeChatType: activeChat?.type,
    activeChatId: activeChat?.id,
    creatorId: activeChat?.creatorId,
    currentUserId: currentUserId,
    isCreator: isCreator,
    isAdmin: isAdmin,
    membersCount: members.length,
    showDeleteButton: activeChat?.type === 'channel' && isCreator
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
    // ✅ ПРОВЕРЯЕМ, ЧТО КАНАЛ ЕЩЕ СУЩЕСТВУЕТ
    if (!activeChat || !activeChat.id) {
        alert('❌ Канал уже удален или не существует');
        onClose();  // ✅ ЗАКРЫВАЕМ ПРОФИЛЬ
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

        // ✅ ОБРАБАТЫВАЕМ 404
        if (response.status === 404) {
            console.log('❌ Канал уже удален');
            alert('❌ Канал уже был удален');
            onClose();  // ✅ ЗАКРЫВАЕМ ПРОФИЛЬ
            return;
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Ошибка удаления канала');
        }
        
        const result = await response.json();
        console.log('✅ Канал удален:', result);
        
        // ✅ ЗАКРЫВАЕМ ПРОФИЛЬ
        onClose();
        
    } catch (error) {
        console.error('❌ Ошибка удаления канала:', error);
        alert('Не удалось удалить канал: ' + error.message);
        onClose();  // ✅ ЗАКРЫВАЕМ ПРОФИЛЬ ДАЖЕ ПРИ ОШИБКЕ
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
        
        const result = await response.json();
        console.log('✅ Групповой чат удален:', result);
        
        // ✅ Закрываем профиль
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
        {/* Шапка */}
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

        {/* Контент */}
        <div className={`flex-1 overflow-y-auto p-5 space-y-6 no-scrollbar ${
            document.documentElement.classList.contains('dark') 
                ? 'text-zinc-200' 
                : 'text-zinc-800'
        }`}>
            
            {/* Аватар и имя */}
            <div className="flex flex-col items-center text-center space-y-3">
                <div className={`w-24 h-24 rounded-full flex items-center justify-center text-5xl shadow-lg border-2 ${
                    document.documentElement.classList.contains('dark') 
                        ? 'bg-zinc-800 border-zinc-700/50' 
                        : 'bg-zinc-100 border-zinc-300/50'
                }`}>
                    {activeChat.avatar || '💬'}
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

            {/* 👥 УЧАСТНИКИ (для каналов и групповых чатов) */}
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
                    
                    {/* Форма добавления */}
                    {showAddMember && (
                        <div className={`mb-3 p-3 rounded-lg ${
                            document.documentElement.classList.contains('dark') 
                                ? 'bg-zinc-900' 
                                : 'bg-zinc-100'
                        }`}>
                            <select 
                                value={selectedUserId}
                                onChange={(e) => setSelectedUserId(e.target.value)}
                                className={`w-full text-sm rounded-lg px-3 py-2 mb-2 focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                                    document.documentElement.classList.contains('dark') 
                                        ? 'bg-zinc-800 text-white' 
                                        : 'bg-white text-zinc-900 border border-zinc-300'
                                }`}
                            >
                                <option value="">Выберите пользователя</option>
                                {allUsers.map(user => (
                                    <option key={user.id} value={user.dbId || user.id}>
                                        {user.name || user.username}
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={handleAddMember}
                                disabled={!selectedUserId}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-1.5 rounded-lg transition"
                            >
                                Добавить
                            </button>
                        </div>
                    )}
                    
                    {/* Список участников */}
                    {isLoading ? (
                        <div className={`text-center py-4 text-sm ${
                            document.documentElement.classList.contains('dark') 
                                ? 'text-zinc-500' 
                                : 'text-zinc-400'
                        }`}>Загрузка...</div>
                    ) : members.length === 0 ? (
                        <div className={`text-center py-4 text-sm ${
                            document.documentElement.classList.contains('dark') 
                                ? 'text-zinc-500' 
                                : 'text-zinc-400'
                        }`}>Нет участников</div>
                    ) : (
                        <div className="space-y-2">
                            {members.map((member) => (
                                <div key={member.id} className={`flex items-center justify-between p-2 rounded-lg transition ${
                                    document.documentElement.classList.contains('dark') 
                                        ? 'bg-zinc-900/50 hover:bg-zinc-900' 
                                        : 'bg-zinc-100/50 hover:bg-zinc-100'
                                }`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                                            document.documentElement.classList.contains('dark') 
                                                ? 'bg-zinc-800' 
                                                : 'bg-zinc-200'
                                        }`}>
                                            {member.user?.avatar || '👤'}
                                        </div>
                                        <div>
                                            <p className={`text-sm font-medium ${
                                                document.documentElement.classList.contains('dark') 
                                                    ? 'text-zinc-200' 
                                                    : 'text-zinc-800'
                                            }`}>{member.user?.username || 'Неизвестный'}</p>
                                            <span className={`text-xs ${
                                                document.documentElement.classList.contains('dark') 
                                                    ? 'text-zinc-500' 
                                                    : 'text-zinc-400'
                                            }`}>
                                                {member.role === 'admin' ? '👑 Админ' : '👤 Участник'}
                                            </span>
                                        </div>
                                    </div>
                                    {isAdmin && member.role !== 'admin' && (
                                        <button 
                                            onClick={() => {
                                                if (activeChat.type === 'channel') {
                                                    handleRemoveMember(member.userId);
                                                } else if (activeChat.type === 'group') {
                                                    handleRemoveChatMember(member.userId);
                                                }
                                            }}
                                            className="text-xs text-red-400 hover:text-red-300 transition opacity-50 hover:opacity-100"
                                        >
                                            Удалить
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            
            <hr className={`${
                document.documentElement.classList.contains('dark') 
                    ? 'border-zinc-800/60' 
                    : 'border-zinc-200/60'
            }`} />

            {/* 🗑️ УДАЛЕНИЕ КАНАЛА (только для создателя) */}
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
            
            {/* 🗑️ УДАЛЕНИЕ ГРУППОВОГО ЧАТА (только для создателя) */}
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

            {/* Медиа / Аудио */}
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