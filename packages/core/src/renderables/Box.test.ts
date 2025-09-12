import { afterEach, beforeEach, expect, test } from "bun:test"
import { TextRenderable } from "."
import { createTestRenderer, type TestRenderer } from "../testing/test-renderer"
import { BoxRenderable, type BoxOptions } from "./Box"

let renderer: TestRenderer
let renderOnce: () => Promise<void>

async function createBoxRenderable(options: BoxOptions): Promise<{ box: BoxRenderable; root: any }> {
  if (!renderer) {
    throw new Error("Renderer not initialized")
  }

  const boxRenderable = new BoxRenderable(renderer, { left: 0, top: 0, ...options })
  renderer.root.add(boxRenderable)
  await renderOnce()

  return { box: boxRenderable, root: renderer.root }
}

beforeEach(async () => {
  ;({ renderer, renderOnce } = await createTestRenderer({}))
})

afterEach(() => {
  renderer.destroy()
})

test("BoxRenderable > Insert before last child", async () => {
  const { box } = await createBoxRenderable({
    id: "box",
  })

  const banana = new TextRenderable(renderer, {
    id: "banana",
    content: "Banana",
  })
  box.add(banana)

  const apple = new TextRenderable(renderer, {
    id: "apple",
    content: "Apple",
  })
  box.add(apple)

  const pear = new TextRenderable(renderer, {
    id: "pear",
    content: "Pear",
  })
  box.add(pear)

  const separator = new BoxRenderable(renderer, {
    id: "separator",
  })
  box.add(separator)

  box.insertBefore(apple, separator)

  expect(box.getChildren().map((c) => c.id)).toEqual(["banana", "pear", "apple", "separator"])
})

test("BoxRenderable > Insert before first child", async () => {
  const { box } = await createBoxRenderable({
    id: "box",
  })

  const banana = new TextRenderable(renderer, {
    id: "banana",
    content: "Banana",
  })
  box.add(banana)

  const apple = new TextRenderable(renderer, {
    id: "apple",
    content: "Apple",
  })
  box.add(apple)

  const pear = new TextRenderable(renderer, {
    id: "pear",
    content: "Pear",
  })
  box.add(pear)

  const separator = new BoxRenderable(renderer, {
    id: "separator",
  })
  box.add(separator)

  box.insertBefore(apple, banana)

  expect(box.getChildren().map((c) => c.id)).toEqual(["apple", "banana", "pear", "separator"])
})
