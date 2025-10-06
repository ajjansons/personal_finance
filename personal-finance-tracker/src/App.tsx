import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import { useUIStore } from '@/lib/state/uiStore';
import AssistantDock from '@/components/ai/AssistantDock';
import ResearchJobToasts from '@/components/research/ResearchJobToasts';

export default function App() {
  const theme = useUIStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
  }, [theme]);

  return (
    <div className="min-h-screen flex flex-col gradient-bg transition-colors duration-500">
      <Navbar />
      <main className="flex-1 container mx-auto p-6 animate-fade-in-up">
        <Outlet />
      </main>
      <Footer />
      <ResearchJobToasts />
      <AssistantDock />
    </div>
  );
}



