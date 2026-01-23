'use client';

import { useState } from 'react';
import { useAuth } from '../lib/supabase/auth-context';

export function AuthModal({
  onClose,
  onSuccess,
  hideClose,
}: {
  onClose?: () => void;
  onSuccess?: () => void;
  hideClose?: boolean;
}) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { signIn, signUp } = useAuth();

  const handleSuccess = () => {
    if (onSuccess) {
      onSuccess();
      return;
    }
    onClose?.();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password);
        if (error) throw error;
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          // Check if it's an email confirmation message
          if (error.message.includes('email')) {
            setError(error.message);
            setMode('signin');
            return; // Don't close modal, let them see the message
          }
          throw error;
        }
        handleSuccess();
      }
      if (mode === 'signin') {
        handleSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="surface-card rounded-2xl p-6 sm:p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold mb-6 text-white">
          {mode === 'signin' ? 'Sign In' : 'Create Account'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full input-field rounded-lg px-4 py-3 text-white"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full input-field rounded-lg px-4 py-3 text-white"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className={`text-sm p-3 rounded-lg border ${
              error.includes('verification')
                ? 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                : 'bg-red-500/10 text-red-300 border-red-500/20'
            }`}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary text-white rounded-xl px-6 py-3 font-semibold shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError('');
            }}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            {mode === 'signin'
              ? "Don't have an account? Sign up"
              : 'Already have an account? Sign in'}
          </button>
        </div>

        {onClose && !hideClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
