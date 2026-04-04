import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'

import { ThemeProvider } from '@/components/theme-provider'
import { RouterProvider, createRouter } from '@tanstack/react-router'

import { routeTree } from './routeTree.gen'
import './index.css'

const router = createRouter({ routeTree, basepath: import.meta.env.BASE_URL })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ThemeProvider defaultTheme="dark">
            <RouterProvider router={router} />
        </ThemeProvider>
    </StrictMode>,
)
