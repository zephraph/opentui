import { createCliRenderer, type CliRenderer } from ".."
import { setupCommonDemoKeys } from "./lib/standalone-keys"
import { TextRenderable } from "../renderables/Text"
import { ScrollAreaRenderable } from "../renderables/ScrollArea"
import {
  t,
  red,
  green,
  blue,
  yellow,
  magenta,
  cyan,
  white,
  brightRed,
  brightGreen,
  brightBlue,
  brightYellow,
  brightMagenta,
  brightCyan,
  bold,
  italic,
  underline,
  dim,
  type StyledText,
  type StylableInput,
} from "../lib/styled-text"

let renderer: CliRenderer | null = null
let scrollArea: ScrollAreaRenderable | null = null
let textRenderables: TextRenderable[] = []

// Array of sample texts for random generation
const sampleTexts = [
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit",
  "The quick brown fox jumps over the lazy dog",
  "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua",
  "Ut enim ad minim veniam, quis nostrud exercitation",
  "Duis aute irure dolor in reprehenderit in voluptate velit",
  "Excepteur sint occaecat cupidatat non proident",
  "Sunt in culpa qui officia deserunt mollit anim",
  "At vero eos et accusamus et iusto odio dignissimos",
  "Et harum quidem rerum facilis est et expedita distinctio",
  "Nam libero tempore, cum soluta nobis est eligendi",
  "Temporibus autem quibusdam et aut officiis debitis",
  "Aut reiciendis voluptatibus maiores alias consequatur",
  "Itaque earum rerum hic tenetur a sapiente delectus",
  "Ut aut reiciendis voluptatibus maiores alias consequatur",
  "Sed ut perspiciatis unde omnis iste natus error",
  "Nemo enim ipsam voluptatem quia voluptas sit aspernatur",
  "Neque porro quisquam est qui dolorem ipsum quia",
  "Quis autem vel eum iure reprehenderit qui in ea",
  "Vel illum qui dolorem eum fugiat quo voluptas",
  "But I must explain to you how all this mistaken idea",
]

// Array of styling functions for random application
const colorFunctions = [
  red,
  green,
  blue,
  yellow,
  magenta,
  cyan,
  white,
  brightRed,
  brightGreen,
  brightBlue,
  brightYellow,
  brightMagenta,
  brightCyan,
]
const styleFunctions = [bold, italic, underline, dim]

function getRandomText(): string {
  return sampleTexts[Math.floor(Math.random() * sampleTexts.length)]
}

function getRandomColor() {
  return colorFunctions[Math.floor(Math.random() * colorFunctions.length)]
}

function getRandomStyle() {
  return styleFunctions[Math.floor(Math.random() * styleFunctions.length)]
}

function generateRandomStyledText(): StyledText {
  const text = getRandomText()
  const shouldStyle = Math.random() > 0.3 // 70% chance of styling

  if (!shouldStyle) {
    return t`${text}`
  }

  const shouldColor = Math.random() > 0.4 // 60% chance of color
  const shouldApplyStyle = Math.random() > 0.5 // 50% chance of style (bold, italic, etc.)

  let chunk: StylableInput = text

  if (shouldColor) {
    const colorFunc = getRandomColor()
    chunk = colorFunc(chunk)
  }

  if (shouldApplyStyle) {
    const styleFunc = getRandomStyle()
    chunk = styleFunc(chunk)
  }

  return t`${chunk}`
}

export function run(rendererInstance: CliRenderer): void {
  renderer = rendererInstance
  renderer.setBackgroundColor("#001122")

  const screenWidth = renderer.width
  const screenHeight = renderer.height

  // Create a centered scroll area that takes up 80% of screen
  const scrollWidth = Math.floor(screenWidth * 0.8)
  const scrollHeight = Math.floor(screenHeight * 0.8)
  const scrollX = Math.floor((screenWidth - scrollWidth) / 2)
  const scrollY = Math.floor((screenHeight - scrollHeight) / 2)

  scrollArea = new ScrollAreaRenderable(renderer, {
    width: scrollWidth,
    height: scrollHeight,
    position: "absolute",
    left: scrollX,
    top: scrollY,
  })

  // Generate 100 text renderables with random styled text
  textRenderables = []
  for (let i = 0; i < 100; i++) {
    const styledText = generateRandomStyledText()

    const textRenderable = new TextRenderable(renderer, {
      content: styledText,
      marginBottom: 1, // Add some spacing between text items
    })

    textRenderables.push(textRenderable)
    scrollArea.add(textRenderable)
  }

  renderer.root.add(scrollArea)
  scrollArea.focus()
}

export function destroy(rendererInstance: CliRenderer): void {
  if (scrollArea) {
    // Remove all text renderables
    for (const text of textRenderables) {
      text.destroy()
    }
    textRenderables = []

    rendererInstance.root.remove(scrollArea.id)
    scrollArea.destroy()
    scrollArea = null
  }

  renderer = null
}

if (import.meta.main) {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
  })

  run(renderer)
  setupCommonDemoKeys(renderer)
  renderer.start()
}
