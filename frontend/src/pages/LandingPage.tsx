import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Sparkles, 
  ArrowRight, 
  Bot, 
  AlertTriangle,
  Zap, 
  BellRing, 
  ChevronRight,
  ShieldCheck
} from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  const features = [
    {
      title: "AI Smart Planner",
      desc: "Sends tasks to Google Gemini to schedule your day with automated work blocks, calendar sync, and breaks.",
      icon: Sparkles,
      color: "from-primary-500 to-accent-violet"
    },
    {
      title: "AI Priority Engine",
      desc: "Scores tasks (1–100) dynamically using deadline closeness, difficulty, and importance rather than just due dates.",
      icon: Zap,
      color: "from-accent-cyan to-primary-500"
    },
    {
      title: "Deadline Risk Predictor",
      desc: "Continuously tracks calendar events and remaining hours to predict deadline failure risk percentages with suggestions.",
      icon: AlertTriangle,
      color: "from-rose-500 to-amber-500"
    },
    {
      title: "AI Productivity Coach",
      desc: "A conversational bot with live access to tasks, schedule, and habits. Ask: 'What should I do now?' or 'Plan my evening'.",
      icon: Bot,
      color: "from-accent-violet to-rose-500"
    }
  ];

  const steps = [
    {
      step: "01",
      title: "Sync Your Inputs",
      desc: "Connect Google Calendar and add your assignments, projects, or tasks with easy estimated durations."
    },
    {
      step: "02",
      title: "Run FocusFlow AI",
      desc: "Our model reviews calendar blockages, deadline proximity, and task difficulty to compute risk and priority scores."
    },
    {
      step: "03",
      title: "Execute Your Day",
      desc: "Accept your custom hourly timeline, receive proactive alerts, and let the AI Coach guide you block by block."
    }
  ];

  return (
    <div className="min-h-screen bg-background relative selection:bg-primary-500 selection:text-white overflow-hidden flex flex-col justify-between">
      
      {/* Background Glow Elements */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary-700/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] bg-accent-cyan/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-[400px] h-[400px] bg-rose-900/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full px-4 sm:px-8 py-4 bg-background/50 backdrop-blur-xl border-b border-zinc-900/60">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary-600 to-accent-cyan flex items-center justify-center shadow-lg shadow-primary-500/20">
              <span className="text-white font-extrabold text-lg">⚡</span>
            </div>
            <div>
              <h1 className="text-md font-bold tracking-tight text-white font-sans flex items-center gap-1.5">
                FocusFlow <span className="text-[9px] bg-primary-500/20 text-primary-400 font-medium px-1.5 py-0.5 rounded-full border border-primary-500/30">AI</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/login')} 
              className="text-xs font-semibold text-zinc-400 hover:text-white px-4 py-2 rounded-xl hover:bg-zinc-900/50 transition-all duration-200"
            >
              Sign In
            </button>
            <button 
              onClick={() => navigate('/register')} 
              className="text-xs font-semibold bg-white text-black hover:bg-zinc-200 px-5 py-2.5 rounded-xl transition-all duration-200 shadow-lg shadow-white/5"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pt-16 sm:pt-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-6"
        >
          {/* Tagline Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-full text-[10px] sm:text-xs text-zinc-400">
            <Sparkles size={12} className="text-primary-400" />
            <span>Introducing FocusFlow AI 1.0</span>
            <ChevronRight size={10} className="text-zinc-650" />
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-7xl font-bold font-sans tracking-tight text-white leading-[1.05]">
            Stop Managing Checklists.<br />
            <span className="text-gradient-primary">Start Beating Deadlines.</span>
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            FocusFlow AI is an active productivity companion. It scores task priorities, maps timeline schedules around calendar blocks, predicts completion failure risks, and coaches you to finish work early.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={() => navigate('/register')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-primary-600 to-accent-violet hover:from-primary-500 hover:to-accent-violet/90 text-white font-semibold text-sm px-7 py-3.5 rounded-xl shadow-xl shadow-primary-500/25 transition-all duration-200"
            >
              Start Planning Free <ArrowRight size={16} />
            </button>
            <button
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-white font-semibold text-sm px-7 py-3.5 rounded-xl transition-all duration-200"
            >
              Sign In with Google
            </button>
          </div>
        </motion.div>
      </section>

      {/* Feature Showcase Grid */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-20 sm:py-32">
        <div className="text-center space-y-3 mb-16">
          <h2 className="text-2xl sm:text-4xl font-bold">Proactive AI Productive Engine</h2>
          <p className="text-xs sm:text-sm text-zinc-500 max-w-lg mx-auto">
            Traditional tools wait for you to fail. FocusFlow works alongside you to guarantee you succeed.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, idx) => {
            const Icon = f.icon;
            return (
              <div 
                key={idx}
                className="p-6 bg-zinc-950/40 border border-zinc-900 hover:border-zinc-850 hover:bg-zinc-900/30 rounded-2xl transition-all duration-300 flex flex-col justify-between group cursor-pointer"
              >
                <div>
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-tr ${f.color} flex items-center justify-center text-white mb-6 shadow-md`}>
                    <Icon size={20} />
                  </div>
                  <h3 className="font-semibold text-zinc-100 text-sm mb-2 group-hover:text-primary-400 transition-colors">{f.title}</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Why AI is Different - Comparison Section */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pb-20 sm:pb-32">
        <div className="glass-panel p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-2 mb-6">
            <h3 className="text-xl font-bold">Passive Reminders vs. FocusFlow AI</h3>
            <p className="text-xs text-zinc-500">Why checklists make you miss deadlines and how AI resolves it.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-900 text-zinc-500">
                  <th className="pb-3 pr-4 font-semibold">Capabilities</th>
                  <th className="pb-3 px-4 font-semibold text-rose-400 flex items-center gap-1"><BellRing size={12} /> Standard Apps</th>
                  <th className="pb-3 pl-4 font-semibold text-primary-400"><Sparkles size={12} className="inline mr-1" /> FocusFlow AI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 text-zinc-400">
                <tr>
                  <td className="py-4 pr-4 font-medium text-zinc-200">Task Sorting</td>
                  <td className="py-4 px-4 text-zinc-500">Simple chronological due date list</td>
                  <td className="py-4 pl-4 text-zinc-300 font-semibold flex items-center gap-1.5"><ShieldCheck size={12} className="text-primary-500" /> AI Priority Ranking (1–100)</td>
                </tr>
                <tr>
                  <td className="py-4 pr-4 font-medium text-zinc-200">Scheduling Daily Workflow</td>
                  <td className="py-4 px-4 text-zinc-500">Manual slot dragging or calendar alerts</td>
                  <td className="py-4 pl-4 text-zinc-300 font-semibold"><ShieldCheck size={12} className="inline mr-1.5 text-primary-500" /> Automated calendar-aware smart planner</td>
                </tr>
                <tr>
                  <td className="py-4 pr-4 font-medium text-zinc-200">Deadline Risk Evaluation</td>
                  <td className="py-4 px-4 text-zinc-500">Red color warning AFTER you miss the date</td>
                  <td className="py-4 pl-4 text-zinc-300 font-semibold"><ShieldCheck size={12} className="inline mr-1.5 text-primary-500" /> Pre-emptive percentage risk predictions</td>
                </tr>
                <tr>
                  <td className="py-4 pr-4 font-medium text-zinc-200">Productivity Coach</td>
                  <td className="py-4 px-4 text-zinc-500">None (Passive checklists)</td>
                  <td className="py-4 pl-4 text-zinc-300 font-semibold"><ShieldCheck size={12} className="inline mr-1.5 text-primary-500" /> Dynamic, context-aware chatbot support</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pb-20 sm:pb-32">
        <div className="text-center space-y-3 mb-16">
          <h2 className="text-2xl sm:text-4xl font-bold">How it Works</h2>
          <p className="text-xs sm:text-sm text-zinc-500">Start checking off tasks in three simple steps.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((s, idx) => (
            <div key={idx} className="relative space-y-4">
              <div className="text-4xl sm:text-6xl font-extrabold text-zinc-800 font-mono tracking-tight">{s.step}</div>
              <h3 className="font-semibold text-zinc-200 text-sm">{s.title}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Call To Action */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-20 sm:pb-32 text-center">
        <div className="glass-panel p-8 sm:p-16 space-y-6 bg-gradient-to-br from-primary-950/20 to-zinc-950 border-primary-500/10">
          <h2 className="text-2xl sm:text-5xl font-bold leading-tight">Ready to Flow?</h2>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto">
            Create an account in less than 30 seconds and let FocusFlow handle your daily roadmap.
          </p>
          <button
            onClick={() => navigate('/register')}
            className="inline-flex items-center gap-2 bg-white text-black hover:bg-zinc-200 font-bold text-xs px-6 py-3 rounded-xl transition-all duration-200 shadow-xl"
          >
            Get Started Now <ArrowRight size={14} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-zinc-900 bg-zinc-950/30 py-8 px-6 text-center text-xs text-zinc-650 space-y-3">
        <p>&copy; {new Date().getFullYear()} FocusFlow AI. Built with Google Gemini API & Firebase for the Google AI Hackathon.</p>
        <p className="flex justify-center gap-4 text-zinc-500">
          <a href="#" className="hover:text-zinc-300">Privacy Policy</a>
          <span>&middot;</span>
          <a href="#" className="hover:text-zinc-300">Terms of Service</a>
          <span>&middot;</span>
          <a href="#" className="hover:text-zinc-300">GitHub Codebase</a>
        </p>
      </footer>
    </div>
  );
}
