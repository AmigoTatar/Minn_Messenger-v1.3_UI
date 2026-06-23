import React, { useState } from 'react';

export default function ProfilePanel({ activeChat, isOpen, onClose }) {
  // Стейт для вкладок: 'media' или 'audio'
  const [activeTab, setActiveTab] = useState('media');

  if (!isOpen || !activeChat) return null;

  // Безопасно берем массив сообщений
const messages = activeChat?.messages || [];

// Фильтруем картинки по полям твоей базы данных
const mediaImages = messages.filter(msg => msg && msg.mediaType === 'image' && !msg.isDeleted);

// Фильтруем аудиосообщения по полям твоей базы данных
const audioFiles = messages.filter(msg => msg && msg.mediaType === 'audio' && !msg.isDeleted);



  // Функция плавного скролла к сообщению по клику на миниатюру
  const handleMediaClick = (messageId) => {
    const element = document.getElementById(`msg-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Красивая подсветка при скролле
      element.classList.add('highlight-animation');
      setTimeout(() => element.classList.remove('highlight-animation'), 2000);
    } else {
      console.warn(`Сообщение msg-${messageId} не найдено в зоне видимости чата`);
    }
  };

  return (
    <div className="w-80 h-full bg-zinc-950 border-l border-zinc-800 flex flex-col animate-fade-in fixed right-0 top-0 z-50 md:relative md:z-0 shadow-2xl md:shadow-none">
      
      {/* Шапка панели */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/40">
        <h3 className="font-semibold text-sm text-zinc-200">Информация</h3>
        <button 
          onClick={onClose} 
          className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition"
          title="Закрыть"
        >
          ✕
        </button>
      </div>

      {/* Основной контент профиля */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 no-scrollbar">
        
        {/* Блок аватарки и имени */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-24 h-24 rounded-full bg-zinc-800 flex items-center justify-center text-5xl shadow-lg border-2 border-zinc-700/50">
            {activeChat.avatar}
          </div>
          <div>
            <h2 className="font-bold text-lg text-white leading-tight">{activeChat.name}</h2>
            <span className="text-xs text-emerald-400">онлайн</span>
          </div>
        </div>

        <hr className="border-zinc-800/60" />

        {/* Данные пользователя */}
        <div className="space-y-4 text-sm">
          <div className="space-y-1">
            <span className="text-xs text-zinc-500 block">Номер телефона</span>
            <span className="text-zinc-200 font-medium">+7 (999) 123-45-67</span>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-zinc-500 block">О себе</span>
            <span className="text-zinc-300 leading-relaxed">
              {activeChat.id === 'chat_1' && 'Занят кодом. Не беспокоить по пустякам 👨‍💻'}
              {activeChat.id === 'chat_2' && 'Обсуждение планов на обед и кофе-брейки ☕'}
              {activeChat.id === 'chat_3' && 'Главный человек в твоей жизни ❤️'}
            </span>
          </div>
        </div>

        <hr className="border-zinc-800/60" />

        {/* Переключатель вкладок: Медиа / Аудио */}
        <div className="flex border-b border-zinc-800/60 text-xs">
          <button 
            onClick={() => setActiveTab('media')}
            className={`flex-1 pb-2.5 font-semibold uppercase tracking-wider transition-colors ${
              activeTab === 'media' ? 'border-b border-white text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Медиа ({mediaImages.length})
          </button>
          <button 
            onClick={() => setActiveTab('audio')}
            className={`flex-1 pb-2.5 font-semibold uppercase tracking-wider transition-colors ${
              activeTab === 'audio' ? 'border-b border-white text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Аудио ({audioFiles.length})
          </button>
        </div>

        {/* Контент активной вкладки */}
        <div className="pt-2">
          {/* ВКЛАДКА: МЕДИА */}
          {activeTab === 'media' && (
            <>
              {mediaImages.length === 0 ? (
                <p className="text-xs text-zinc-500 italic text-center py-4 bg-zinc-900/20 rounded-xl border border-dashed border-zinc-800/40">
                  Нет отправленных изображений
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {mediaImages.map(msg => (
                    <div 
                      key={msg.id} 
                      onClick={() => handleMediaClick(msg.id)}
                      className="aspect-square bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 group relative cursor-pointer"
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

          {/* ВКЛАДКА: АУДИО */}
          {activeTab === 'audio' && (
            <>
              {audioFiles.length === 0 ? (
                <p className="text-xs text-zinc-500 italic text-center py-4 bg-zinc-900/20 rounded-xl border border-dashed border-zinc-800/40">
                  Нет отправленных аудиосообщений
                </p>
              ) : (
                <div className="space-y-2">
                  {audioFiles.map(msg => (
                    <div 
                      key={msg.id}
                      onClick={() => handleMediaClick(msg.id)}
                      className="p-2.5 bg-zinc-900 hover:bg-zinc-900/80 border border-zinc-800 rounded-xl flex items-center gap-3 cursor-pointer transition-colors"
                    >
                      <div className="text-xl bg-zinc-800 p-1.5 rounded-lg">🎙️</div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] text-zinc-500 block mb-1">
                          {msg.createdAt ? new Date(msg.createdAt).toLocaleDateString() : 'Голосовое сообщение'}
                        </span>
                        <audio 
  src={msg.mediaUrl  || msg.audio  || msg.fileUrl  || ""} // Берём любое доступное поле с URL
  controls 
  className="w-full h-6 text-xs filter invert opacity-70 hover:opacity-100 transition" 
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
