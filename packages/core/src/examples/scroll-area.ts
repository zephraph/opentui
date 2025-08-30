import { createCliRenderer, type CliRenderer } from ".."
import { setupCommonDemoKeys } from "./lib/standalone-keys"
import { BoxRenderable } from ".."
import { ScrollAreaRenderable } from "../renderables/ScrollArea"

let renderer: CliRenderer | null = null
let root: ScrollAreaRenderable | null = null
let box: BoxRenderable | null = null
let box2: BoxRenderable | null = null
let box3: BoxRenderable | null = null

export function run(rendererInstance: CliRenderer): void {
    renderer = rendererInstance
    renderer.setBackgroundColor("#001122")

    root = new ScrollAreaRenderable(renderer, {
        height: 20,
        width: 20,
    })

    box = new BoxRenderable(renderer, {
        width: 1000,
        height: 10,
        backgroundColor: "#f00"
    })

    box2 = new BoxRenderable(renderer, {
        width: 1000,
        height: 10,
        backgroundColor: "#ff0"
    })

    box3 = new BoxRenderable(renderer, {
        width: 1000,
        height: 10,
        backgroundColor: "#f0f"
    })

    renderer.root.add(root)
    root.add(box)
    root.add(box2)
    root.add(box3)
    root.focus()
}

export function destroy(rendererInstance: CliRenderer): void {
    if (root) {
        rendererInstance.root.remove(root.id)
        root.destroy()
        root = null
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
