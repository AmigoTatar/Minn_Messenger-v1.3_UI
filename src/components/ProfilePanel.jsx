import React from 'react';

export default function ProfilePanel({ activeChat, isOpen, onClose }) {
  if (!isOpen || !activeChat) return null;

  // Ищем все сообщения-картинки в текущем чате, которые не были удалены
  const mediaImages = activeChat.messages.filter(msg => msg.type === 'image' && !msg.isDeleted);

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

        {/* Блок отправленных Медиа (картинок) */}
        <div className="space-y-2.5">
          <div className="flex justify-between items-center">
            <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Медиа</span>
            <span className="text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full">{mediaImages.length}</span>
          </div>
          
          {mediaImages.length === 0 ? (
            <p className="text-xs text-zinc-500 italic text-center py-4 bg-zinc-900/20 rounded-xl border border-dashed border-zinc-800/40">
              Нет отправленных изображений
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {mediaImages.map(msg => (
                <div key={msg.id} className="aspect-square bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 group relative cursor-pointer">
                  <img 
                    src={msg.image} 
                    alt="Shared" 
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
