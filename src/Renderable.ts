import type { OptimizedBuffer } from "."
import { EventEmitter } from "events"

export interface RenderableOptions {
  x: number
  y: number
  zIndex: number
  visible?: boolean
}

export abstract class Renderable extends EventEmitter {
  public id: string
  private _x: number
  private _y: number
  private _zIndex: number
  public visible: boolean

  private renderableMap: Map<string, Renderable> = new Map()
  private renderableArray: Renderable[] = []
  private needsZIndexSort: boolean = false
  public parent: Renderable | null = null

  constructor(id: string, options: RenderableOptions) {
    super()
    this.id = id
    this._x = options.x
    this._y = options.y
    this._zIndex = options.zIndex
    this.visible = options.visible !== false
  }

  public set needsUpdate(value: boolean) {
    if (this.parent) {
      this.parent.needsUpdate = value
    }
  }

  public get x(): number {
    if (this.parent) {
      return this.parent.x + this._x
    }
    return this._x
  }

  public set x(value: number) {
    this._x = value
  }

  public get y(): number {
    if (this.parent) {
      return this.parent.y + this._y
    }
    return this._y
  }

  public set y(value: number) {
    this._y = value
  }

  public get zIndex(): number {
    return this._zIndex
  }

  public set zIndex(value: number) {
    if (this._zIndex !== value) {
      this._zIndex = value
      this.parent?.requestZIndexSort()
    }
  }

  public requestZIndexSort(): void {
    this.needsZIndexSort = true
  }

  private ensureZIndexSorted(): void {
    if (this.needsZIndexSort) {
      this.renderableArray.sort((a, b) => (a.zIndex > b.zIndex ? 1 : a.zIndex < b.zIndex ? -1 : 0))
      this.needsZIndexSort = false
    }
  }

  public add(obj: Renderable): void {
    if (this.renderableMap.has(obj.id)) {
      this.remove(obj.id)
    }

    if (obj.parent) {
      obj.parent.remove(obj.id)
    }

    obj.parent = this
    this.renderableArray.push(obj)
    this.needsZIndexSort = true
    this.renderableMap.set(obj.id, obj)
    this.emit("child:added", obj)
  }

  public getRenderable(id: string): Renderable | undefined {
    return this.renderableMap.get(id)
  }

  public remove(id: string): void {
    if (!id) {
      return
    }
    if (this.renderableMap.has(id)) {
      const obj = this.renderableMap.get(id)
      if (obj) {
        obj.parent = null
      }
      this.renderableMap.delete(id)

      const index = this.renderableArray.findIndex((obj) => obj.id === id)
      if (index !== -1) {
        this.renderableArray.splice(index, 1)
      }
      this.emit("child:removed", id)
    }
  }

  public getAllElementIds(): string[] {
    return Array.from(this.renderableMap.keys())
  }

  public getChildren(): Renderable[] {
    return [...this.renderableArray]
  }

  public render(buffer: OptimizedBuffer): void {
    if (!this.visible) return

    this.renderSelf(buffer)
    this.ensureZIndexSorted()

    for (const child of this.renderableArray) {
      if (child.visible) {
        child.render(buffer)
      }
    }
  }

  protected renderSelf(buffer: OptimizedBuffer): void {
    // Default implementation: do nothing
    // Override this method to provide custom rendering
  }

  public destroy(): void {
    if (this.parent) {
      throw new Error(
        `Cannot destroy ${this.id} while it still has a parent (${this.parent.id}). Remove from parent first.`,
      )
    }

    for (const child of this.renderableArray) {
      child.parent = null
      child.destroy()
    }
    this.renderableArray = []
    this.renderableMap.clear()

    this.destroySelf()
  }

  protected destroySelf(): void {
    // Default implementation: do nothing
    // Override this method to provide custom cleanup
  }
}
