import React, { useState } from 'react';

// Принимаем проп apiBaseUrl из App.jsx для бесшовной мобильной Capacitor-сборки
export default function Auth({ onAuthSuccess, apiBaseUrl }) {
  const [isLogin, setIsLogin] = useState(true); // true = вход, false = регистрация
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    // Используем динамический URL сервера из пропов, либо локальный фоллбек
    const currentBaseUrl = apiBaseUrl || 'http://localhost:5001';

    try {
      const response = await fetch(`${currentBaseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Что-то пошло не так');
      }

      // [БЕЗОПАСНОСТЬ] Сначала сохраняем валидный токен и юзера локально для автозахода
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // [ИСПРАВЛЕНО] Передаем ОБА аргумента (user и токен) наверх в App.jsx, убирая баг с undefined
      if (typeof onAuthSuccess === 'function') {
        onAuthSuccess(data.user, data.token);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 dark:bg-zinc-900 px-4 transition-colors duration-300">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-white dark:bg-zinc-950 p-8 shadow-2xl border border-zinc-200 dark:border-zinc-800 transition-colors duration-300">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {isLogin ? 'Войти в аккаунт' : 'Создать аккаунт'}
          </h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {isLogin ? 'Рады видеть тебя снова!' : 'Присоединяйся к нашему мессенджеру'}
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-red-500/10 p-3 text-sm text-red-500 text-center border border-red-500/20">
            {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400">Никнейм</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent px-4 py-3 text-zinc-900 dark:text-white shadow-sm focus:border-blue-500 focus:outline-none transition-colors duration-200"
              placeholder="Введите ваш ник"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400">Пароль</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent px-4 py-3 text-zinc-900 dark:text-white shadow-sm focus:border-blue-500 focus:outline-none transition-colors duration-200"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white shadow-md hover:bg-blue-500 active:scale-98 transition duration-200 disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Загрузка...' : isLogin ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>

        <div className="text-center text-sm mt-4">
          <button
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="font-medium text-blue-500 hover:text-blue-400 dark:text-blue-400 cursor-pointer transition-colors"
          >
            {isLogin ? 'Ещё нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
          </button>
        </div>

      </div>
    </div>
  );
}
