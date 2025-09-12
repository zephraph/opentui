#!/usr/bin/env bun

import { BoxRenderable, CliRenderer, createCliRenderer, TextRenderable } from "../index"
import { setupCommonDemoKeys } from "./lib/standalone-keys"

export function run(renderer: CliRenderer): void {
  renderer.start()
  renderer.console.show()

  const container = new BoxRenderable(renderer, {
    id: "container",
  })

  const banana = new TextRenderable(renderer, {
    id: "banana",
    content: "Banana",
  })
  container.add(banana)

  const apple = new TextRenderable(renderer, {
    id: "apple",
    content: "Apple",
  })
  container.add(apple)

  const pear = new TextRenderable(renderer, {
    id: "pear",
    content: "Pear",
  })
  container.add(pear)

  const separator = new BoxRenderable(renderer, {
    id: "separator",
    height: 1,
    backgroundColor: "#fff",
  })
  container.add(separator)

  const footer = new TextRenderable(renderer, {
    id: "footer",
    content: "Footer",
  })
  container.add(footer)

  setTimeout(() => {
    console.log("inserting apple before separator")
    container.insertBefore(apple, separator)

    setTimeout(() => {
      console.log("inserting separator before apple")
      container.insertBefore(separator, apple)

      setTimeout(() => {
        console.log("inserting footer before banana")
        container.insertBefore(footer, banana)
      }, 3000)
    }, 2000)
  }, 2000)

  container.getChildren().forEach((child, index) => {
    console.log(child.id, index)
  })

  renderer.root.add(container)
}

if (import.meta.main) {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    consoleOptions: {
      sizePercent: 50,
    },
  })
  run(renderer)
  setupCommonDemoKeys(renderer)
}
