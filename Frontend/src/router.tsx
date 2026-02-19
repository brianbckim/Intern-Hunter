import { createBrowserRouter } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/login'
import Dashboard from './pages/Dashboard'
import ErrorPage from './pages/ErrorPage'
import Resume from './pages/Resume'
import ParseTest from './pages/ParseTest'

const router = createBrowserRouter([
  { path: '/', element: <Dashboard />, errorElement: <ErrorPage /> },
  { path: '/home', element: <Home />, errorElement: <ErrorPage /> },
  { path: '/login', element: <Login />, errorElement: <ErrorPage /> },
  { path: '/resume', element: <Resume />, errorElement: <ErrorPage /> },
  { path: '/parse-test', element: <ParseTest />, errorElement: <ErrorPage /> },
])

export default router

