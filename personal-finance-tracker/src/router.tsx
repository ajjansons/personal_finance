import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import Dashboard from './pages/Dashboard';
import Holdings from './pages/Holdings';
import Categories from './pages/Categories';
import Settings from './pages/Settings';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'holdings', element: <Holdings /> },
      { path: 'categories', element: <Categories /> },
      { path: 'settings', element: <Settings /> }
    ]
  }
]);

