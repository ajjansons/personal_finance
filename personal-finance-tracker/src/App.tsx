import { Outlet } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col gradient-bg">
      <Navbar />
      <main className="flex-1 container mx-auto p-6 animate-fade-in-up">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

