import { useState } from 'react'
import { SHARED_CONSTANT } from '@talker/shared'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="App">
      <h1>Talker Client</h1>
      <p>Shared: {SHARED_CONSTANT}</p>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
      </div>
    </div>
  )
}

export default App
