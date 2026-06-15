import './App.css'
import { AccessibilityDemo } from './components/AccessibilityDemo'
import { CommandCenter } from './components/CommandCenter'
import { DOMCapturePanel } from './components/DOMCapturePanel'

function App() {
  return (
    <div className="app">
      <CommandCenter />
      <DOMCapturePanel />
      <AccessibilityDemo />
    </div>
  )
}

export default App
