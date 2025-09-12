import { render, useRenderer } from "@opentui/react"
import { useEffect, useState } from "react"

function App() {
  const renderer = useRenderer()
  renderer.console.show()

  const [items, setItems] = useState([{ id: "banana" }, { id: "apple" }, { id: "pear" }])

  useEffect(() => {
    console.log("setting items")
    setTimeout(() => {
      setItems([{ id: "banana" }, { id: "pear" }, { id: "apple" }])
    }, 1500)
  }, [])

  return (
    <box id="container">
      {items.map((item) => (
        <text key={item.id}>{item.id}</text>
      ))}
      <box height={1} id="separator" />
    </box>
  )
}

render(<App />)
