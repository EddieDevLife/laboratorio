import './App.css'
import { AccessibilityDemo } from './components/AccessibilityDemo'
import { CommandCenter } from './components/CommandCenter'

function App() {
  return (
    <div className="app">
      <CommandCenter />
      <AccessibilityDemo />
    </div>
  )
}

export default App
