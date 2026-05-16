import { createBrowserRouter } from 'react-router-dom'
import App from './App'
import { AddTransactionSheet } from './ui/components/AddTransactionSheet'
import { GameWorkspace } from './ui/screens/GameWorkspace'
import { GamesList } from './ui/screens/GamesList'

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <App />,
      children: [
        {
          index: true,
          element: <GamesList />,
        },
        {
          path: 'g/:gameId',
          element: <GameWorkspace />,
          children: [
            {
              path: 'tx/new',
              element: <AddTransactionSheet />,
            },
          ],
        },
      ],
    },
  ],
  {
    basename: import.meta.env.BASE_URL,
  },
)
