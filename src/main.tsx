import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'

import { AllCommunityModule as AgChartsAllCommunityModule, ModuleRegistry as AgChartsModuleRegistry } from 'ag-charts-community'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import { store } from '@/app/store'
import { ThemeProvider } from '@/components/theme-provider'
import { RouterProvider, createRouter } from '@tanstack/react-router'

import { routeTree } from './routeTree.gen'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'
import './index.css'

ModuleRegistry.registerModules([AllCommunityModule])
AgChartsModuleRegistry.registerModules([AgChartsAllCommunityModule])

const router = createRouter({ routeTree, basepath: import.meta.env.BASE_URL })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark">
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>
    </ThemeProvider>
  </StrictMode>,
)
