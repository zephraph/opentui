import { render, useKeyHandler, useRenderer, useTerminalDimensions } from "@opentui/solid"
import { bold, dim, MouseEvent, type Renderable, type RenderableOptions } from "@opentui/core"
import { createEffect, createSignal, For } from "solid-js"

type TooltipConfig = Pick<RenderableOptions, "top" | "left" | "right" | "bottom" | "justifySelf" | "alignSelf">

type SelectOption = {
  name: string
  value?: string
}

const positionOptions: SelectOption[] = [
  { name: "Unset" },
  { name: "Anchor-Top", value: "anchor-top" },
  { name: "Anchor-Bottom", value: "anchor-bottom" },
  { name: "Anchor-Left", value: "anchor-left" },
  { name: "Anchor-Right", value: "anchor-right" },
  { name: "Anchor-Center", value: "anchor-center" },
]

export default function AnchorDemo() {
  const renderer = useRenderer()
  const td = useTerminalDimensions()
  const [anchor, setAnchor] = createSignal<Renderable | undefined>(undefined)
  const [tooltipConfig, setTooltipConfig] = createSignal<TooltipConfig | undefined>(undefined)
  const [focusedDropdown, setFocusedDropdown] = createSignal(0)

  useKeyHandler((key) => {
    switch (key.name) {
      case "g":
        if (key.ctrl) {
          renderer.dumpHitGrid()
        }
        break
    }
  })

  return (
    <box width={td().width} height={td().height}>
      <box justifyContent="center" width="100%" height={4} alignItems="center" backgroundColor="#001122">
        <ascii_font text="Anchor Demo" font="tiny" />
      </box>
      <box flexDirection="row" width="100%" flexGrow={1} backgroundColor="#123123">
        <box border title="Test area ( hover on a target to see )" flexGrow={1}>
          <box alignItems="center" justifyContent="space-evenly" flexDirection="row" flexGrow={1}>
            <box
              ref={setAnchor}
              title="target-1"
              style={{ width: 20, height: 10, backgroundColor: "#004400" }}
              border
            />
            <box
              ref={setAnchor}
              title="target-2"
              style={{ width: 20, height: 10, marginRight: 2, marginTop: 3, backgroundColor: "#004400" }}
              border
            />
          </box>
          <box alignItems="center" justifyContent="space-evenly" flexDirection="row" flexGrow={1}>
            <box
              ref={setAnchor}
              title="target-1"
              style={{ width: 20, height: 10, marginLeft: -2, marginTop: 2, backgroundColor: "#004400" }}
              border
            />
            <box
              ref={setAnchor}
              title="target-2"
              style={{ width: 20, height: 10, marginRight: 5, marginTop: -2, backgroundColor: "#004400" }}
              border
            />
          </box>
        </box>
        <box title="Anchor config" minWidth={40} border onMouseDown={(e) => setFocusedDropdown(-1)}>
          {bold("Position")}
          <Dropdown
            focused={focusedDropdown() === 0}
            name="Top"
            selectedOption={(() => {
              const index = positionOptions.findIndex((x) => x.value === tooltipConfig()?.top)
              return index === -1 ? 0 : index
            })()}
            onSelect={(option) => {
              setTooltipConfig((c) => ({ ...c, top: option.value }))
            }}
            onClick={(e) => {
              e.preventDefault()
              setFocusedDropdown(0)
            }}
            options={positionOptions}
          />
          <Dropdown
            focused={focusedDropdown() === 1}
            name="Bottom"
            selectedOption={(() => {
              const index = positionOptions.findIndex((x) => x.value === tooltipConfig()?.bottom)
              return index === -1 ? 0 : index
            })()}
            onSelect={(option) => {
              setTooltipConfig((c) => ({ ...c, bottom: option.value }))
            }}
            onClick={(e) => {
              e.preventDefault()
              setFocusedDropdown(1)
            }}
            options={positionOptions}
          />
          <Dropdown
            focused={focusedDropdown() === 2}
            name="Left"
            selectedOption={(() => {
              const index = positionOptions.findIndex((x) => x.value === tooltipConfig()?.left)
              return index === -1 ? 0 : index
            })()}
            onSelect={(option) => {
              setTooltipConfig((c) => ({ ...c, right: option.value }))
            }}
            onClick={(e) => {
              e.preventDefault()
              setFocusedDropdown(2)
            }}
            options={positionOptions}
          />
          <Dropdown
            focused={focusedDropdown() === 3}
            name="Right"
            selectedOption={(() => {
              const index = positionOptions.findIndex((x) => x.value === tooltipConfig()?.right)
              return index === -1 ? 0 : index
            })()}
            onSelect={(option) => {
              setTooltipConfig((c) => ({ ...c, right: option.value }))
            }}
            onClick={(e) => {
              e.preventDefault()
              setFocusedDropdown(3)
            }}
            options={positionOptions}
          />
        </box>
      </box>
    </box>
  )
}

function Dropdown(props: {
  name: string
  options: SelectOption[]
  selectedOption: number
  onSelect?: (option: SelectOption) => void
  onClick?: (e: MouseEvent) => void
  focused?: boolean
}) {
  const [showDropdown, setShowDropdown] = createSignal(false)
  const selectedOptionItem = () => props.options[props.selectedOption]

  createEffect((prev) => {
    setShowDropdown(props.focused || false)

    return props.focused
  })

  let ref

  return (
    <>
      <box
        ref={ref}
        focused={props.focused}
        title={props.name}
        border
        onMouseDown={props.onClick}
        onKeyDown={(key) => {}}
      >
        <text selectable={false}>{selectedOptionItem()?.name ?? "Select an option"}</text>
      </box>
      <box
        positionAnchor={ref}
        style={{
          visible: showDropdown(),
          top: "anchor-bottom",
          left: "anchor-left",
          right: "anchor-right",
          marginTop: -1,
          paddingLeft: 1,
          paddingRight: 1,
          zIndex: 100,
          backgroundColor: "#44000050",
        }}
      >
        <box
          style={{
            width: "100%",
            // border: ["bottom"],
            backgroundColor: "#440000",
          }}
        >
          <For each={props.options}>
            {(anchor, index) => (
              <box
                onMouseDown={(event) => {
                  props.onSelect?.(anchor)
                  event.preventDefault()
                }}
                paddingLeft={1}
              >
                <text selectable={false}>
                  {index() === props.selectedOption ? bold(anchor.name) : dim(anchor.name)}
                </text>
              </box>
            )}
          </For>
        </box>
      </box>
    </>
  )
}

function AbsoluteTest() {
  return (
    <box flexDirection="row" height="100%" width="100%">
      <box
        style={{
          minWidth: 1,
          padding: 1,
          backgroundColor: "#ffffff70",
        }}
      >
        <box
          border
          style={{
            left: 20,
            width: 60,
            height: 30,
            backgroundColor: "#ffffff70",
            zIndex: 100,
          }}
        ></box>
        <box
          border
          style={{
            top: 2,
            left: 20,
            width: 60,
            height: 20,
            backgroundColor: "#ffffff70",
            zIndex: 100,
          }}
        ></box>
      </box>
      <box flexGrow={1} flexDirection="row" backgroundColor="#001122" height="100%" />
    </box>
  )
}

if (import.meta.main) {
  // const renderer = await render(AbsoluteTest)
  const renderer = await render(AnchorDemo)
  renderer.console.show()
}
