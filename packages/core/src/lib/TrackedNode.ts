import Yoga, { type Config, type Node as YogaNode } from "yoga-layout"
import { EventEmitter } from "events"

// TrackedNode
// A TypeScript wrapper for Yoga nodes that tracks indices and maintains parent-child relationships.

interface NodeMetadata {
  [key: string]: any
}

class TrackedNode<T extends NodeMetadata = NodeMetadata> extends EventEmitter {
  private static idCounter = 0
  id: number
  yogaNode: YogaNode
  metadata: T
  parent: TrackedNode<any> | null

  // Linked list pointers for child relationships
  nextSibling: TrackedNode<any> | null = null
  prevSibling: TrackedNode<any> | null = null
  firstChild: TrackedNode<any> | null = null
  lastChild: TrackedNode<any> | null = null
  childCount: number = 0

  protected _destroyed: boolean = false

  // Yoga calculates subpixels and the setMeasureFunc throws all over the place when trying to use it,
  // so we make up for rounding errors by calculating the percentual manually.
  protected _width: number | "auto" | `${number}%` = "auto"
  protected _height: number | "auto" | `${number}%` = "auto"

  constructor(yogaNode: YogaNode, metadata: T = {} as T) {
    super()
    this.id = TrackedNode.idCounter++
    this.yogaNode = yogaNode
    this.metadata = metadata
    this.parent = null
  }

  parseWidth(width: number | "auto" | `${number}%`): number | "auto" {
    if (this._destroyed) {
      // Fatal: Something is very wrong (debug why we are trying to parse width after destruction)
      throw new Error("Node is destroyed")
    }
    if (typeof width === "number" || width === "auto") {
      return width
    }
    if (!this.parent) {
      return this.yogaNode.getComputedWidth()
    }
    if (this.parent._destroyed) {
      // Fatal: Something is very wrong (debug why we are trying to parse width after destruction)
      throw new Error("Parent node is destroyed")
    }
    return Math.floor((this.parent.yogaNode.getComputedWidth() * parseInt(width)) / 100)
  }

  parseHeight(height: number | "auto" | `${number}%`): number | "auto" {
    if (this._destroyed) {
      // Fatal: Something is very wrong (debug why we are trying to parse height after destruction)
      throw new Error("Node is destroyed")
    }
    if (typeof height === "number" || height === "auto") {
      return height
    }
    if (!this.parent) {
      return this.yogaNode.getComputedHeight()
    }
    if (this.parent._destroyed) {
      // Fatal: Something is very wrong (debug why we are trying to parse height after destruction)
      throw new Error("Parent node is destroyed")
    }
    return Math.floor((this.parent.yogaNode.getComputedHeight() * parseInt(height)) / 100)
  }

  setWidth(width: number | "auto" | `${number}%`): void {
    this._width = width
    const parsedWidth = this.parseWidth(width)
    if (parsedWidth === "auto") {
      this.yogaNode.setWidthAuto()
    } else {
      this.yogaNode.setWidth(parsedWidth)
    }
  }

  setHeight(height: number | "auto" | `${number}%`): void {
    this._height = height
    const parsedHeight = this.parseHeight(height)
    if (parsedHeight === "auto") {
      this.yogaNode.setHeightAuto()
    } else {
      this.yogaNode.setHeight(parsedHeight)
    }
  }

  // Linked list utility methods
  private unlinkFromParent<U extends NodeMetadata>(childNode: TrackedNode<U>): void {
    if (childNode.prevSibling) {
      childNode.prevSibling.nextSibling = childNode.nextSibling
    } else {
      // This was the first child
      this.firstChild = childNode.nextSibling
    }

    if (childNode.nextSibling) {
      childNode.nextSibling.prevSibling = childNode.prevSibling
    } else {
      // This was the last child
      this.lastChild = childNode.prevSibling
    }

    childNode.nextSibling = null
    childNode.prevSibling = null
    this.childCount--
  }

  private linkAsLastChild<U extends NodeMetadata>(childNode: TrackedNode<U>): void {
    if (this.lastChild) {
      this.lastChild.nextSibling = childNode
      childNode.prevSibling = this.lastChild
    } else {
      this.firstChild = childNode
    }
    this.lastChild = childNode
    this.childCount++
  }

  private linkBefore<U extends NodeMetadata>(childNode: TrackedNode<U>, anchor: TrackedNode<any>): void {
    childNode.nextSibling = anchor
    childNode.prevSibling = anchor.prevSibling

    if (anchor.prevSibling) {
      anchor.prevSibling.nextSibling = childNode
    } else {
      // Anchor was the first child
      this.firstChild = childNode
    }

    anchor.prevSibling = childNode
    this.childCount++
  }

  // Convert to array for compatibility (temporary during migration)
  private toChildArray(): TrackedNode<any>[] {
    const result: TrackedNode<any>[] = []
    let current = this.firstChild
    while (current) {
      result.push(current)
      current = current.nextSibling
    }
    return result
  }

  addChild<U extends NodeMetadata>(childNode: TrackedNode<U>): number {
    if (childNode.parent) {
      childNode.parent.removeChild(childNode)
    }

    childNode.parent = this
    this.linkAsLastChild(childNode)

    // Insert at end in yoga
    const yogaIndex = this.childCount - 1
    this.yogaNode.insertChild(childNode.yogaNode, yogaIndex)

    try {
      childNode.yogaNode.setWidth(childNode.parseWidth(childNode._width))
      childNode.yogaNode.setHeight(childNode.parseHeight(childNode._height))
    } catch (e) {
      console.error("Error setting width and height", e)
    }

    return yogaIndex
  }

  getChildIndex<U extends NodeMetadata>(childNode: TrackedNode<U>): number {
    let index = 0
    let current = this.firstChild
    while (current) {
      if (current === childNode) {
        return index
      }
      current = current.nextSibling
      index++
    }
    return -1
  }

  removeChild<U extends NodeMetadata>(childNode: TrackedNode<U>): boolean {
    if (childNode.parent !== this) {
      return false
    }

    this.unlinkFromParent(childNode)
    this.yogaNode.removeChild(childNode.yogaNode)
    childNode.parent = null

    return true
  }

  removeChildAtIndex(index: number): TrackedNode<any> | null {
    if (index < 0 || index >= this.childCount) {
      return null
    }

    const childNode = this.getChildAtIndex(index)
    if (!childNode) {
      return null
    }

    this.removeChild(childNode)
    return childNode
  }

  moveChild<U extends NodeMetadata>(childNode: TrackedNode<U>, newIndex: number): number {
    if (childNode.parent !== this) {
      throw new Error("Node is not a child of this parent")
    }

    const boundedNewIndex = Math.max(0, Math.min(newIndex, this.childCount - 1))
    const currentIndex = this.getChildIndex(childNode)

    if (currentIndex === boundedNewIndex) {
      return currentIndex
    }

    // Remove from current position
    this.unlinkFromParent(childNode)
    this.yogaNode.removeChild(childNode.yogaNode)

    // Insert at new position
    if (boundedNewIndex === this.childCount) {
      // Insert at end
      this.linkAsLastChild(childNode)
      this.yogaNode.insertChild(childNode.yogaNode, boundedNewIndex)
    } else {
      // Insert before the node currently at boundedNewIndex
      const anchorNode = this.getChildAtIndex(boundedNewIndex)
      if (anchorNode) {
        this.linkBefore(childNode, anchorNode)
        this.yogaNode.insertChild(childNode.yogaNode, boundedNewIndex)
      }
    }

    return boundedNewIndex
  }

  insertChild<U extends NodeMetadata>(childNode: TrackedNode<U>, index: number): number {
    if (childNode.parent) {
      childNode.parent.removeChild(childNode)
    }

    childNode.parent = this
    const boundedIndex = Math.max(0, Math.min(index, this.childCount))

    if (boundedIndex === this.childCount) {
      // Insert at end
      this.linkAsLastChild(childNode)
    } else {
      // Insert before the node currently at boundedIndex
      const anchorNode = this.getChildAtIndex(boundedIndex)
      if (anchorNode) {
        this.linkBefore(childNode, anchorNode)
      } else {
        // Fallback to end if anchor not found
        this.linkAsLastChild(childNode)
      }
    }

    this.yogaNode.insertChild(childNode.yogaNode, boundedIndex)

    try {
      childNode.yogaNode.setWidth(childNode.parseWidth(childNode._width))
      childNode.yogaNode.setHeight(childNode.parseHeight(childNode._height))
    } catch (e) {
      console.error("Error setting width and height", e)
    }

    return boundedIndex
  }

  getChildCount(): number {
    return this.childCount
  }

  getChildAtIndex(index: number): TrackedNode<any> | null {
    if (index < 0 || index >= this.childCount) {
      return null
    }

    let current = this.firstChild
    let currentIndex = 0
    while (current && currentIndex < index) {
      current = current.nextSibling
      currentIndex++
    }
    return current
  }

  setMetadata(key: keyof T, value: T[keyof T]): void {
    this.metadata[key] = value
  }

  getMetadata<K extends keyof T>(key: K): T[K] {
    return this.metadata[key]
  }

  removeMetadata<K extends keyof T>(key: K): void {
    delete this.metadata[key]
  }

  hasChild<U extends NodeMetadata>(childNode: TrackedNode<U>): boolean {
    return childNode.parent === this
  }

  insertBefore<U extends NodeMetadata>(childNode: TrackedNode<U>, anchor: TrackedNode<any>): number {
    if (anchor.parent !== this) {
      throw new Error("Anchor node is not a child of this parent")
    }

    if (childNode.parent) {
      childNode.parent.removeChild(childNode)
    }

    childNode.parent = this
    this.linkBefore(childNode, anchor)

    const insertIndex = this.getChildIndex(anchor)
    this.yogaNode.insertChild(childNode.yogaNode, insertIndex)

    try {
      childNode.yogaNode.setWidth(childNode.parseWidth(childNode._width))
      childNode.yogaNode.setHeight(childNode.parseHeight(childNode._height))
    } catch (e) {
      console.error("Error setting width and height", e)
    }

    return insertIndex
  }

  // Backward compatibility getter for children array
  get children(): TrackedNode<any>[] {
    return this.toChildArray()
  }

  destroy(): void {
    if (this._destroyed) {
      return
    }
    if (this.parent) {
      this.parent.removeChild(this)
    }
    try {
      this.yogaNode.free()
    } catch (e) {
      // Might be already freed and will throw an error if we try to free it again
    }
    this._destroyed = true
  }
}

function createTrackedNode<T extends NodeMetadata>(metadata: T = {} as T, yogaConfig?: Config): TrackedNode<T> {
  const yogaNode = Yoga.Node.create(yogaConfig)
  return new TrackedNode<T>(yogaNode, metadata)
}

export { TrackedNode, createTrackedNode }
