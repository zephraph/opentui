# OpenTUI

A Bun exclusively module for terminal rendering.

## Build

```bash
bun build:prod
```

This creates platform-specific libraries in `src/zig/lib/` that are automatically loaded by the TypeScript layer.

## Examples

```bash
bun run src/examples/index.ts
```

## CLI Renderer

### Renderables

Renderables are hierarchical objects that can be positioned and rendered to buffers:

```typescript
import { Renderable } from "opentui"

class MyRenderable extends Renderable {
  protected renderSelf(buffer: OptimizedBuffer): void {
    buffer.drawText("Custom content", this.x, this.y, RGBA.fromValues(1, 1, 1, 1))
  }
}

const obj = new MyRenderable("my-obj", { x: 10, y: 5, zIndex: 1 })

renderer.add(obj)
```
