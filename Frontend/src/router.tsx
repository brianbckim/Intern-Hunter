import { createBrowserRouter } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/login'
import Register from './pages/Register'
import Profile from './pages/Profile'
import Dashboard from './pages/Dashboard'
import Jobs from './pages/Jobs'
import Applications from './pages/Applications'
import Settings from './pages/Settings'
import ErrorPage from './pages/ErrorPage'
import Resume from './pages/Resume'
import ParseTest from './pages/ParseTest'
import ProtectedRoute from './components/ProtectedRoute'

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />,
  },
  { path: '/home', element: <Home />, errorElement: <ErrorPage /> },
  { path: '/login', element: <Login />, errorElement: <ErrorPage /> },
  { path: '/register', element: <Register />, errorElement: <ErrorPage /> },
  {
    path: '/profile',
    element: (
      <ProtectedRoute>
        <Profile />
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />,
  },
  {
    path: '/resume',
    element: (
      <ProtectedRoute>
        <Resume />
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />,
  },
  {
    path: '/parse-test',
    element: (
      <ProtectedRoute>
        <ParseTest />
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />,
  },
  {
    path: '/jobs',
    element: (
      <ProtectedRoute>
        <Jobs />
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />,
  },
  {
    path: '/applications',
    element: (
      <ProtectedRoute>
        <Applications />
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />,
  },
  {
    path: '/settings',
    element: (
      <ProtectedRoute>
        <Settings />
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />,
  },
])

export default router

