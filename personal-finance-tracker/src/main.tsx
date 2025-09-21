import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import { router } from './router';
import { queryClient } from './lib/state/queryClient';
import { useUIStore } from '@/lib/state/uiStore';

const initialTheme = useUIStore.getState().theme;
const rootEl = document.documentElement;
rootEl.setAttribute('data-theme', initialTheme);
rootEl.classList.toggle('dark', initialTheme === 'dark');
rootEl.classList.toggle('light', initialTheme === 'light');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
