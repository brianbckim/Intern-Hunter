import { createBrowserRouter } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/login'
import Dashboard from './pages/Dashboard'
import ErrorPage from './pages/ErrorPage'

const router = createBrowserRouter([
  { path: '/', element: <Dashboard />, errorElement: <ErrorPage /> },
  { path: '/home', element: <Home />, errorElement: <ErrorPage /> },
  { path: '/login', element: <Login />, errorElement: <ErrorPage /> },
])

export default router
