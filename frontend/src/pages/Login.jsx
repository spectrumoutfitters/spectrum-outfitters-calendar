import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import Logo from '../components/Logo';
import ThemeToggle from '../components/ui/ThemeToggle';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dailyAffirmation, setDailyAffirmation] = useState('Loading your daily inspiration...');
  const { login } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    const today = new Date().toDateString();
    const cached = localStorage.getItem(`affirmation_${today}`);
    if (cached) {
      setDailyAffirmation(cached);
      return;
    }
    const affirmations = [
      "You're capable of amazing things today!",
      "Every challenge is an opportunity to grow.",
      "Your hard work makes a difference.",
      "Today is a fresh start full of possibilities.",
      "You have the strength to overcome any obstacle.",
      "You have the power to make today great!"
    ];
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    const affirmation = affirmations[dayOfYear % affirmations.length];
    localStorage.setItem(`affirmation_${today}`, affirmation);
    setDailyAffirmation(affirmation);
  }, []);

  const getBrowserGeo = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        () => resolve(null),
        { timeout: 5000, maximumAge: 60000 }
      );
    });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const browserGeo = await getBrowserGeo();
    const result = await login(username, password, browserGeo);

    if (result.success) {
      navigate('/dashboard');
    } else {
      if (result.error?.includes('Cannot connect') || result.error?.includes('ERR_CONNECTION_REFUSED') || result.error?.includes('Network Error')) {
        setError('Cannot connect to server. Please ensure the backend is running on port 5000.');
      } else {
        setError(result.error);
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-100 dark:bg-neutral-950 px-4 py-8 sm:py-12 safe-area-pb relative">
      <div className="absolute top-4 right-4 flex items-center gap-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-2 py-1.5 shadow-sm">
        <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300 sm:inline">
          {theme === 'dark' ? 'Dark' : 'Light'}
        </span>
        <ThemeToggle variant="standalone" />
      </div>
      <div className="w-full max-w-[400px] mx-auto">
        <div className="bg-white dark:bg-neutral-900 rounded-2xl sm:rounded-3xl shadow-sm border border-neutral-200 dark:border-neutral-800 p-6 sm:p-8 md:p-10">
          <div className="text-center mb-6 sm:mb-8">
            <div className="flex justify-center mb-4 sm:mb-6">
              <Logo size="xl" />
            </div>
            <p className="text-neutral-500 dark:text-neutral-400 text-base font-medium">Sign in to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-base h-12"
                required
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-base h-12"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full min-h-[3rem] py-3 text-base"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 sm:mt-8 pt-6 border-t border-neutral-100 dark:border-neutral-800">
            <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-2">Daily affirmation</p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">{dailyAffirmation}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
