import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/Logo';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dailyAffirmation, setDailyAffirmation] = useState('Loading your daily inspiration...');
  const { login } = useAuth();
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
    <div className="min-h-screen flex items-center justify-center bg-neutral-100 px-4 py-12">
      <div className="w-full max-w-[400px]">
        <div className="bg-white rounded-3xl shadow-soft border border-neutral-200/80 p-8 md:p-10">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <Logo size="xl" />
            </div>
            <p className="text-neutral-500 text-base font-medium">Sign in to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-neutral-700 mb-1.5">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-base"
                required
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-neutral-700 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-base"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-base"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-neutral-100">
            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">Daily affirmation</p>
            <p className="text-sm text-neutral-600 leading-relaxed">{dailyAffirmation}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
