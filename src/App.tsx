import { Outlet } from 'react-router-dom'

export default function App() {
  return (
    <div className="min-h-screen bg-mist-950 text-mist-100">
      <Outlet />
    </div>
  )
}
