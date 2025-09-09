import { ConsolePosition } from "@opentui/core/src/console"
import { render, useRenderer } from "@opentui/solid"
import { createSignal, Match, onMount, Switch } from "solid-js"

const tabs = [
  { title: "Text & Attributes" },
  { title: "Basics" },
  { title: "Borders" },
  { title: "Animation" },
  { title: "Titles" },
  { title: "Interactive" },
]

export default function TabSelectDemo() {
  const renderer = useRenderer()
  const [activeTab, setActiveTab] = createSignal(0)

  onMount(() => {
    renderer.useConsole = true
    renderer.console.show()
  })

  return (
    <box style={{ flexDirection: "column", flexGrow: 1 }}>
      <tab_select
        height={2}
        width="100%"
        options={tabs.map((tab, index) => ({
          name: tab.title,
          value: index,
          description: "",
        }))}
        showDescription={false}
        onChange={(index) => {
          setActiveTab(index)
        }}
        focused
      />
      <Switch>
        <Match when={activeTab() === 0}>
          <text>Tab 1/6 - Use Left/Right arrows to navigate | Press Ctrl+C to exit | D: toggle debug</text>
        </Match>
        <Match when={activeTab() === 1}>
          <text>Tab 2/6 - Use Left/Right arrows to navigate | Press Ctrl+C to exit | D: toggle debug</text>
        </Match>
        <Match when={activeTab() === 2}>
          <text>Tab 3/6 - Use Left/Right arrows to navigate | Press Ctrl+C to exit | D: toggle debug</text>
          <input
            focused
            placeholder="tab 3 input"
            onSubmit={(value) => {
              console.log("tab 3", value)
            }}
          />
        </Match>
        <Match when={activeTab() === 3}>
          <text>Tab 4/6 - Use Left/Right arrows to navigate | Press Ctrl+C to exit | D: toggle debug</text>
          <input
            focused
            placeholder="tab 4 input"
            onSubmit={(value) => {
              console.log("tab 4", value)
            }}
          />
        </Match>
      </Switch>
    </box>
  )
}

if (import.meta.main) {
  render(TabSelectDemo, {
    consoleOptions: {
      position: ConsolePosition.BOTTOM,
      maxStoredLogs: 1000,
      sizePercent: 40,
    },
  })
}
