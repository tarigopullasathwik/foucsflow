import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight, Globe, Sparkles } from 'lucide-react';
import { useAuth } from '../firebase';

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const { login, register, loginWithGoogle, resetPassword, isMock } = useAuth();
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || (!isForgot && !password)) return;
    
    setLoading(true);
    setMessage(null);

    try {
      if (isForgot) {
        await resetPassword(email);
        setMessage({ text: `Reset link dispatched to ${email}.`, type: 'success' });
      } else if (isRegister) {
        await register(email, password, name || email.split('@')[0]);
        navigate('/dashboard');
      } else {
        await login(email, password);
        navigate('/dashboard');
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ 
        text: err.message || "Authentication failed. Verify credentials.", 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await loginWithGoogle();
      navigate('/dashboard');
    } catch (err: any) {
      console.error(err);
      setMessage({ text: "Google Sign-In failed.", type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative flex flex-col justify-center items-center p-4">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/3 w-80 h-80 bg-primary-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-accent-cyan/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Auth Panel */}
      <div className="w-full max-w-md relative z-10 space-y-6">
        
        {/* Logo and Greeting */}
        <div className="text-center space-y-2">
          <div 
            onClick={() => navigate('/')}
            className="inline-flex w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary-600 to-accent-cyan flex items-center justify-center shadow-lg shadow-primary-500/25 cursor-pointer mx-auto"
          >
            <span className="text-white font-extrabold text-xl">⚡</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white mt-4 font-sans">
            {isForgot ? 'Reclaim Access' : (isRegister ? 'Create Your Account' : 'Welcome to FocusFlow')}
          </h2>
          <p className="text-xs text-zinc-500">
            {isForgot 
              ? 'Enter email to receive password reset links' 
              : 'AI-first task mapping and deadline forecasting.'}
          </p>
        </div>

        {/* Sandbox alert if in Mock Mode */}
        {isMock && (
          <div className="p-3.5 bg-accent-violet/10 border border-accent-violet/20 rounded-2xl text-[11px] text-accent-violet flex items-center gap-2">
            <Sparkles size={14} className="shrink-0" />
            <div>
              <span className="font-bold">Sandbox Mode Activated:</span> Firebase keys are not set. Register/Login instantly with any details.
            </div>
          </div>
        )}

        {/* Main Card */}
        <div className="glass-panel p-6 sm:p-8 space-y-5 bg-zinc-950/60">
          
          {/* Notification Message */}
          {message && (
            <div className={`p-3 rounded-xl text-xs font-medium border ${
              message.type === 'success' 
                ? 'bg-accent-emerald/10 border-accent-emerald/20 text-accent-emerald' 
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}>
              {message.text}
            </div>
          )}

          {/* Forgot Password Flow */}
          {isForgot ? (
            <form onSubmit={handleAuth} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 text-zinc-500" size={16} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 focus:border-primary-500 focus:outline-none rounded-xl py-3 pl-11 pr-4 text-xs text-white placeholder-zinc-600 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-white text-black hover:bg-zinc-200 disabled:bg-zinc-850 disabled:text-zinc-650 py-3 rounded-xl text-xs font-semibold transition-all duration-200"
              >
                {loading ? 'Dispatched...' : 'Send Password Reset Link'}
              </button>

              <button
                type="button"
                onClick={() => setIsForgot(false)}
                className="w-full text-center text-xs text-zinc-500 hover:text-white transition-colors"
              >
                Back to Sign In
              </button>
            </form>
          ) : (
            /* Login & Register Forms */
            <form onSubmit={handleAuth} className="space-y-4">
              {isRegister && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 text-zinc-500" size={16} />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Alex Carter"
                      className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 focus:border-primary-500 focus:outline-none rounded-xl py-3 pl-11 pr-4 text-xs text-white placeholder-zinc-600 transition-colors"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 text-zinc-500" size={16} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 focus:border-primary-500 focus:outline-none rounded-xl py-3 pl-11 pr-4 text-xs text-white placeholder-zinc-600 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-zinc-400">Password</label>
                  {!isRegister && (
                    <button
                      type="button"
                      onClick={() => setIsForgot(true)}
                      className="text-[10px] text-zinc-500 hover:text-primary-400 hover:underline transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 text-zinc-500" size={16} />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 focus:border-primary-500 focus:outline-none rounded-xl py-3 pl-11 pr-4 text-xs text-white placeholder-zinc-600 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary-600 to-accent-violet hover:from-primary-500 hover:to-accent-violet/90 disabled:from-zinc-900 disabled:to-zinc-900 disabled:text-zinc-650 text-white py-3 rounded-xl text-xs font-semibold shadow-lg shadow-primary-500/10 transition-all duration-200"
              >
                {loading ? 'Authenticating...' : (
                  <>
                    {isRegister ? 'Create Account' : 'Sign In'}
                    <ArrowRight size={14} />
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 py-2">
                <div className="flex-1 h-[1px] bg-zinc-900" />
                <span className="text-[10px] text-zinc-650 font-mono">OR CONTINUE WITH</span>
                <div className="flex-1 h-[1px] bg-zinc-900" />
              </div>

              {/* Google Sign-In */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-750 text-zinc-300 hover:text-white py-3 rounded-xl text-xs font-semibold transition-all duration-200"
              >
                <Globe size={14} className="text-primary-400" />
                Google Authenticator
              </button>
            </form>
          )}
        </div>

        {/* Tab Swappers */}
        {!isForgot && (
          <p className="text-center text-xs text-zinc-500">
            {isRegister ? 'Already have an account?' : 'New to FocusFlow?'}
            <button
              onClick={() => setIsRegister(!isRegister)}
              className="text-primary-400 font-semibold hover:underline ml-1.5 transition-all"
            >
              {isRegister ? 'Sign In Instead' : 'Create Account Free'}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
