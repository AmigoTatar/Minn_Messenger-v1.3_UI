import React, { useState } from 'react';

export default function Auth({ onAuthSuccess, apiBaseUrl }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');      // ✅ ДЛЯ РЕГИСТРАЦИИ
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState([]);

  // Функция проверки пароля в реальном времени
  const validatePassword = (pwd) => {
    const errors = [];
    if (pwd.length < 8) errors.push('минимум 8 символов');
    if (!/[A-Z]/.test(pwd)) errors.push('заглавную букву');
    if (!/[a-z]/.test(pwd)) errors.push('строчную букву');
    if (!/[0-9]/.test(pwd)) errors.push('цифру');
    if (!/[!@#$%^&*]/.test(pwd)) errors.push('спецсимвол (!@#$%^&*)');
    setPasswordErrors(errors);
    return errors.length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // ✅ ДЛЯ РЕГИСТРАЦИИ — проверяем пароль
    if (!isLogin) {
      const isValid = validatePassword(password);
      if (!isValid) {
        setLoading(false);
        return;
      }
    }

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const currentBaseUrl = apiBaseUrl || 'http://localhost:5001';

    // ✅ Формируем body в зависимости от типа
    const body = isLogin 
      ? { username, password }
      : { username, email, password };  // 🔥 ДОБАВЛЯЕМ EMAIL

    try {
      const response = await fetch(`${currentBaseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Что-то пошло не так');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

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
          {/* 👤 ИМЯ ПОЛЬЗОВАТЕЛЯ */}
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400">Никнейм</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent px-4 py-3 text-zinc-900 dark:text-white shadow-sm focus:border-emerald-500 focus:outline-none transition-colors duration-200"
              placeholder="Введите ваш ник"
            />
          </div>

          {/* 📧 EMAIL — ТОЛЬКО ДЛЯ РЕГИСТРАЦИИ */}
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent px-4 py-3 text-zinc-900 dark:text-white shadow-sm focus:border-emerald-500 focus:outline-none transition-colors duration-200"
                placeholder="example@mail.com"
              />
            </div>
          )}

          {/* 🔑 ПАРОЛЬ — С ВАЛИДАЦИЕЙ ТОЛЬКО ДЛЯ РЕГИСТРАЦИИ */}
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Пароль {!isLogin && '(минимум 8 символов)'}
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (!isLogin) {
                  validatePassword(e.target.value);
                }
              }}
              className="mt-1 block w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent px-4 py-3 text-zinc-900 dark:text-white shadow-sm focus:border-emerald-500 focus:outline-none transition-colors duration-200"
              placeholder="••••••••"
            />
            
            {/* ОШИБКИ ПАРОЛЯ — ТОЛЬКО ДЛЯ РЕГИСТРАЦИИ */}
            {!isLogin && passwordErrors.length > 0 && (
              <div className="text-red-500 text-xs mt-2 space-y-0.5">
                {passwordErrors.map((err, i) => (
                  <div key={i}>• {err}</div>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3 font-semibold text-white shadow-md shadow-emerald-600/20 active:scale-98 transition duration-200 disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Загрузка...' : isLogin ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>

        <div className="text-center text-sm mt-4">
          <button
            onClick={() => { 
              setIsLogin(!isLogin); 
              setError('');
              setPasswordErrors([]);
              setPassword('');
            }}
            className="font-medium text-emerald-500 hover:text-emerald-400 dark:text-emerald-400 cursor-pointer transition-colors"
          >
            {isLogin ? 'Ещё нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
          </button>
        </div>
      </div>
    </div>
  );
}