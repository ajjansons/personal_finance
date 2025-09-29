import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import Dashboard from './pages/Dashboard';
import Holdings from './pages/Holdings';
import HeatMap from './pages/HeatMap';
import Categories from './pages/Categories';
import Settings from './pages/Settings';
import ResearchReport from './pages/ResearchReport';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'holdings', element: <Holdings /> },
      { path: 'heat-map', element: <HeatMap /> },
      { path: 'categories', element: <Categories /> },
      { path: 'settings', element: <Settings /> },
      { path: 'research/:reportId', element: <ResearchReport /> }
    ]
  }
]);
