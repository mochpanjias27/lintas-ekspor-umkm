import { World } from './scene/World'
import { useApp } from './store'
import { Home, Simulator, SpotCard, TopBar } from './ui/Panels'
import { Optimizer } from './ui/Optimizer'
import { ModelMap } from './ui/ModelMap'

export default function App() {
  const page = useApp((s) => s.page)
  return (
    <div className={`app page-${page}`}>
      <div className="stage">
        <World />
      </div>
      <TopBar />
      <main className="overlay">
        {page === 'beranda' && <Home />}
        {page === 'simulator' && <Simulator />}
        {page === 'optimasi' && <Optimizer />}
        {page === 'struktur' && <ModelMap />}
        <SpotCard />
      </main>
    </div>
  )
}
