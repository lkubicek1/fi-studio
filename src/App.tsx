import { useState } from 'react'

import { Button } from '@/components/ui/button'

function App() {
  const [count, setCount] = useState(0)

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <section className="flex w-full max-w-xs flex-col gap-6 text-center text-sm leading-loose">
        <h1 className="font-medium">FI Studio Shell</h1>

        <p className="text-6xl leading-none">{count}</p>

        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => setCount((value) => value + 1)}>
            Increment
          </Button>
          <Button className="flex-1" variant="outline" onClick={() => setCount(0)}>
            Reset
          </Button>
        </div>
      </section>
    </main>
  )
}

export default App
