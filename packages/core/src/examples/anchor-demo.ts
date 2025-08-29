import { CliRenderer, BoxRenderable, TextRenderable, type MouseEvent, createCliRenderer } from "../index"
import { setupCommonDemoKeys } from "./lib/standalone-keys"

let renderer: CliRenderer | null = null
let anchorBoxes: BoxRenderable[] = []
let attachedBoxes: BoxRenderable[] = []
let instructionsText: TextRenderable | null = null

export function run(r: CliRenderer): void {
  renderer = r
  renderer.setBackgroundColor("#001122")

  const width = renderer.terminalWidth
  const height = renderer.terminalHeight

  instructionsText = new TextRenderable(renderer, {
    id: "instructions-anchor",
    position: "absolute",
    left: 2,
    top: 1,
    content:
      "Click on any box to attach a new box to it using the anchor API. Anchored boxes will follow their targets.",
    fg: "#AAAAAA",
    zIndex: 100,
  })
  renderer.root.add(instructionsText)

  createRandomBoxes(width, height)
  renderer.needsUpdate()
}

function createRandomBoxes(width: number, height: number): void {
  const boxCount = 3
  const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1"]

  for (let i = 0; i < boxCount; i++) {
    const boxWidth = 12 + Math.floor(Math.random() * 8)
    const boxHeight = 6 + Math.floor(Math.random() * 4)

    const x = Math.floor(Math.random() * (width - boxWidth - 4)) + 2
    const y = Math.floor(Math.random() * (height - boxHeight - 8)) + 6

    const box = new BoxRenderable(renderer!, {
      id: `anchor-box-${i}`,
      position: "absolute",
      left: x,
      top: y,
      width: boxWidth,
      height: boxHeight,
      backgroundColor: colors[i % colors.length],
      borderStyle: "rounded",
      borderColor: "#FFFFFF",
      shouldFill: true,
      border: true,
      title: `Box ${i + 1}`,
      titleAlignment: "center",
      zIndex: 1,
    })

    box.onMouseDown = (event: MouseEvent) => {
      if (event.button === 0) {
        attachBoxToTarget(box)
      }
    }

    anchorBoxes.push(box)
    renderer!.root.add(box)
  }
}

function attachBoxToTarget(targetBox: BoxRenderable): void {
  const attachedIndex = attachedBoxes.length
  const colors = ["#FF1744", "#E91E63", "#9C27B0"]

  console.log("attaching box to target", targetBox.id)
  const attachedBox = new BoxRenderable(targetBox.ctx, {
    id: `attached-box-${attachedIndex}`,
    position: "absolute",
    positionAnchor: targetBox,
    width: 8,
    height: 4,
    backgroundColor: colors[attachedIndex % colors.length],
    borderStyle: "single",
    borderColor: "#FFFFFF",
    shouldFill: true,
    border: true,
    title: `A${attachedIndex + 1}`,
    titleAlignment: "center",
    zIndex: 10,
  })

  const anchorPositions = [
    { left: "anchor-right", top: "anchor-top" },
    { left: "anchor-left", top: "anchor-bottom" },
    { left: "anchor-right", top: "anchor-bottom" },
    { left: "anchor-left", top: "anchor-top" },
    { left: "anchor-right", top: "anchor-center", alignSelf: "anchor-center" },
    { left: "anchor-center", top: "anchor-bottom", justifySelf: "anchor-center" },
    { left: "anchor-left", top: "anchor-center", alignSelf: "anchor-center" },
    { left: "anchor-center", top: "anchor-top", justifySelf: "anchor-center" },
  ]

  const position = anchorPositions[attachedIndex % anchorPositions.length]
  attachedBox.setPosition(position)

  if (position.alignSelf) {
    attachedBox.alignSelf = position.alignSelf as any
  }
  if (position.justifySelf) {
    attachedBox.justifySelf = position.justifySelf as any
  }

  attachedBox.onMouseDown = (event: MouseEvent) => {
    if (event.button === 0) {
      attachBoxToTarget(attachedBox)
    }
  }

  attachedBoxes.push(attachedBox)
  renderer!.root.add(attachedBox)
  renderer!.needsUpdate()

  updateInstructions()
}

function updateInstructions(): void {
  if (instructionsText) {
    const attachedCount = attachedBoxes.length
    if (attachedCount === 0) {
      instructionsText.content =
        "Click on any box to attach a new box to it using the anchor API. Anchored boxes will follow their targets."
    } else {
      instructionsText.content = `${attachedCount} box(es) attached! Click any box (including attached ones) to create more anchored boxes.`
    }
    renderer!.needsUpdate()
  }
}

export function destroy(r: CliRenderer): void {
  for (const box of anchorBoxes) {
    r.root.remove(box.id)
  }
  for (const box of attachedBoxes) {
    r.root.remove(box.id)
  }
  if (instructionsText) {
    r.root.remove(instructionsText.id)
  }

  anchorBoxes = []
  attachedBoxes = []
  instructionsText = null
  renderer = null
}

if (import.meta.main) {
  const renderer = await createCliRenderer({
    targetFps: 30,
    enableMouseMovement: true,
    exitOnCtrlC: true,
  })
  run(renderer)
  setupCommonDemoKeys(renderer)
}
