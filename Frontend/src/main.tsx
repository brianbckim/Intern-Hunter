import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import router from './router'
import ErrorBoundary from './components/ErrorBoundary'
import "./index.css"

const storedTheme = window.localStorage.getItem('theme')
const initialTheme = storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : 'light'

document.documentElement.setAttribute('data-theme', initialTheme)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  </React.StrictMode>
)