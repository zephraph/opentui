import { EventEmitter } from "events"
import Yoga, { Direction, Display, Edge, FlexDirection, type Config } from "yoga-layout"
import { OptimizedBuffer } from "./buffer"
import { getKeyHandler, type KeyHandler } from "./lib/KeyHandler"
import { TrackedNode, createTrackedNode } from "./lib/TrackedNode"
import type { ParsedKey } from "./lib/parse.keypress"
import type { MouseEventType } from "./lib/parse.mouse"
import {
  parseAlign,
  parseFlexDirection,
  parseJustify,
  parseOverflow,
  parsePositionType,
  parseWrap,
  type AlignString,
  type FlexDirectionString,
  type JustifyString,
  type OverflowString,
  type PositionTypeString,
  type WrapString,
} from "./lib/yoga.options"
import type { MouseEvent } from "./renderer"
import type { RenderContext, ViewportBounds } from "./types"
import { maybeMakeRenderable, type VNode } from "./renderables/composition/vnode"
import type { Selection } from "./lib/selection"

const BrandedRenderable: unique symbol = Symbol.for("@opentui/core/Renderable")

export enum LayoutEvents {
  LAYOUT_CHANGED = "layout-changed",
  ADDED = "added",
  REMOVED = "removed",
  RESIZED = "resized",
}

export enum RenderableEvents {
  FOCUSED = "focused",
  BLURRED = "blurred",
}

export interface Position {
  top?: number | "auto" | `${number}%`
  right?: number | "auto" | `${number}%`
  bottom?: number | "auto" | `${number}%`
  left?: number | "auto" | `${number}%`
}

export interface BaseRenderableOptions {
  id?: string
}

export interface LayoutOptions extends BaseRenderableOptions {
  flexGrow?: number
  flexShrink?: number
  flexDirection?: FlexDirectionString
  flexWrap?: WrapString
  alignItems?: AlignString
  justifyContent?: JustifyString
  alignSelf?: AlignString
  flexBasis?: number | "auto" | undefined
  position?: PositionTypeString
  overflow?: OverflowString
  top?: number | "auto" | `${number}%`
  right?: number | "auto" | `${number}%`
  bottom?: number | "auto" | `${number}%`
  left?: number | "auto" | `${number}%`
  minWidth?: number | "auto" | `${number}%`
  minHeight?: number | "auto" | `${number}%`
  maxWidth?: number | "auto" | `${number}%`
  maxHeight?: number | "auto" | `${number}%`
  margin?: number | "auto" | `${number}%`
  marginTop?: number | "auto" | `${number}%`
  marginRight?: number | "auto" | `${number}%`
  marginBottom?: number | "auto" | `${number}%`
  marginLeft?: number | "auto" | `${number}%`
  padding?: number | `${number}%`
  paddingTop?: number | `${number}%`
  paddingRight?: number | `${number}%`
  paddingBottom?: number | `${number}%`
  paddingLeft?: number | `${number}%`
  enableLayout?: boolean
}

export interface RenderableOptions<T extends BaseRenderable = BaseRenderable> extends Partial<LayoutOptions> {
  width?: number | "auto" | `${number}%`
  height?: number | "auto" | `${number}%`
  zIndex?: number
  visible?: boolean
  buffered?: boolean
  live?: boolean

  // hooks for custom render logic
  renderBefore?: (this: T, buffer: OptimizedBuffer, deltaTime: number) => void
  renderAfter?: (this: T, buffer: OptimizedBuffer, deltaTime: number) => void

  // catch all
  onMouse?: (this: T, event: MouseEvent) => void

  onMouseDown?: (this: T, event: MouseEvent) => void
  onMouseUp?: (this: T, event: MouseEvent) => void
  onMouseMove?: (this: T, event: MouseEvent) => void
  onMouseDrag?: (this: T, event: MouseEvent) => void
  onMouseDragEnd?: (this: T, event: MouseEvent) => void
  onMouseDrop?: (this: T, event: MouseEvent) => void
  onMouseOver?: (this: T, event: MouseEvent) => void
  onMouseOut?: (this: T, event: MouseEvent) => void
  onMouseScroll?: (this: T, event: MouseEvent) => void

  onKeyDown?: (key: ParsedKey) => void

  onSizeChange?: (this: T) => void
}

function validateOptions(id: string, options: RenderableOptions<Renderable>): void {
  if (typeof options.width === "number") {
    if (options.width < 0) {
      throw new TypeError(`Invalid width for Renderable ${id}: ${options.width}`)
    }
  }
  if (typeof options.height === "number") {
    if (options.height < 0) {
      throw new TypeError(`Invalid height for Renderable ${id}: ${options.height}`)
    }
  }
}

export function isValidPercentage(value: any): value is `${number}%` {
  if (typeof value === "string" && value.endsWith("%")) {
    const numPart = value.slice(0, -1)
    const num = parseFloat(numPart)
    return !Number.isNaN(num)
  }
  return false
}

export function isMarginType(value: any): value is number | "auto" | `${number}%` {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return true
  }
  if (value === "auto") {
    return true
  }
  return isValidPercentage(value)
}

export function isPaddingType(value: any): value is number | `${number}%` {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return true
  }
  return isValidPercentage(value)
}

export function isPositionType(value: any): value is number | "auto" | `${number}%` {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return true
  }
  if (value === "auto") {
    return true
  }
  return isValidPercentage(value)
}

export function isPositionTypeType(value: any): value is PositionTypeString {
  return value === "relative" || value === "absolute"
}

export function isOverflowType(value: any): value is OverflowString {
  return value === "visible" || value === "hidden" || value === "scroll"
}

export function isDimensionType(value: any): value is number | "auto" | `${number}%` {
  return isPositionType(value)
}

export function isFlexBasisType(value: any): value is number | "auto" | undefined {
  if (value === undefined || value === "auto") {
    return true
  }
  if (typeof value === "number" && !Number.isNaN(value)) {
    return true
  }
  return false
}

export function isSizeType(value: any): value is number | `${number}%` | undefined {
  if (value === undefined) {
    return true
  }
  if (typeof value === "number" && !Number.isNaN(value)) {
    return true
  }
  return isValidPercentage(value)
}

export function isRenderable(obj: any): obj is Renderable {
  return !!obj?.[BrandedRenderable]
}

export abstract class BaseRenderable extends EventEmitter {
  [BrandedRenderable] = true

  private static renderableNumber = 1
  public readonly id: string
  public readonly num: number
  protected _dirty: boolean = false
  public parent: BaseRenderable | null = null

  constructor(options: BaseRenderableOptions) {
    super()
    this.num = BaseRenderable.renderableNumber++
    this.id = options.id ?? `renderable-${this.num}`
  }

  public abstract add(obj: BaseRenderable | unknown, index?: number): number
  public abstract remove(id: string): void
  public abstract getChildren(): BaseRenderable[]
  public abstract getChildrenCount(): number
  public abstract getRenderable(id: string): BaseRenderable | undefined
  public abstract requestRender(): void

  public get isDirty(): boolean {
    return this._dirty
  }

  protected markClean(): void {
    this._dirty = false
  }

  protected markDirty(): void {
    this._dirty = true
  }
}

export abstract class Renderable extends BaseRenderable {
  static renderablesByNumber: Map<number, Renderable> = new Map()

  private _isDestroyed: boolean = false
  protected _ctx: RenderContext
  protected _translateX: number = 0
  protected _translateY: number = 0
  protected _x: number = 0
  protected _y: number = 0
  protected _width: number | "auto" | `${number}%`
  protected _height: number | "auto" | `${number}%`
  protected _widthValue: number = 0
  protected _heightValue: number = 0
  private _zIndex: number
  protected _visible: boolean
  public selectable: boolean = false
  protected buffered: boolean
  protected frameBuffer: OptimizedBuffer | null = null

  protected _focusable: boolean = false
  protected _focused: boolean = false
  protected keyHandler: KeyHandler = getKeyHandler()
  protected keypressHandler: ((key: ParsedKey) => void) | null = null
  private _live: boolean = false
  protected _liveCount: number = 0

  private _sizeChangeListener: (() => void) | undefined = undefined
  private _mouseListener: ((event: MouseEvent) => void) | null = null
  private _mouseListeners: Partial<Record<MouseEventType, (event: MouseEvent) => void>> = {}
  private _keyListeners: Partial<Record<"down", (key: ParsedKey) => void>> = {}

  protected layoutNode: TrackedNode
  protected _positionType: PositionTypeString = "relative"
  protected _overflow: OverflowString = "visible"
  protected _position: Position = {}

  private renderableMap: Map<string, Renderable> = new Map()
  private needsZIndexSort: boolean = false
  public parent: Renderable | null = null

  private childrenPrimarySortDirty: boolean = true
  private childrenSortedByPrimaryAxis: Renderable[] = []
  private _newChildren: Renderable[] = []

  public renderBefore?: (this: Renderable, buffer: OptimizedBuffer, deltaTime: number) => void
  public renderAfter?: (this: Renderable, buffer: OptimizedBuffer, deltaTime: number) => void

  constructor(ctx: RenderContext, options: RenderableOptions<any>) {
    super(options)

    this._ctx = ctx
    Renderable.renderablesByNumber.set(this.num, this)

    validateOptions(this.id, options)

    this.renderBefore = options.renderBefore
    this.renderAfter = options.renderAfter

    this._width = options.width ?? "auto"
    this._height = options.height ?? "auto"

    if (typeof this._width === "number") {
      this._widthValue = this._width
    }
    if (typeof this._height === "number") {
      this._heightValue = this._height
    }

    this._zIndex = options.zIndex ?? 0
    this._visible = options.visible !== false
    this.buffered = options.buffered ?? false
    this._live = options.live ?? false
    this._liveCount = this._live && this._visible ? 1 : 0

    this.layoutNode = createTrackedNode({ renderable: this } as any)
    this.layoutNode.yogaNode.setDisplay(this._visible ? Display.Flex : Display.None)
    this.setupYogaProperties(options)

    this.applyEventOptions(options)

    if (this.buffered) {
      this.createFrameBuffer()
    }
  }

  public get focusable(): boolean {
    return this._focusable
  }

  public get ctx(): RenderContext {
    return this._ctx
  }

  public get visible(): boolean {
    return this._visible
  }

  public get primaryAxis(): "row" | "column" {
    const dir = this.layoutNode.yogaNode.getFlexDirection()
    return dir === 2 || dir === 3 ? "row" : "column"
  }

  public set visible(value: boolean) {
    if (this._visible === value) return

    const wasVisible = this._visible
    this._visible = value
    this.layoutNode.yogaNode.setDisplay(value ? Display.Flex : Display.None)

    if (this._live) {
      if (!wasVisible && value) {
        this.propagateLiveCount(1)
      } else if (wasVisible && !value) {
        this.propagateLiveCount(-1)
      }
    }

    if (this._focused) {
      this.blur()
    }
    this.requestRender()
  }

  public hasSelection(): boolean {
    return false
  }

  public onSelectionChanged(selection: Selection | null): boolean {
    // Default implementation: do nothing
    // Override this method to provide custom selection handling
    return false
  }

  public getSelectedText(): string {
    return ""
  }

  public shouldStartSelection(x: number, y: number): boolean {
    return false
  }

  public focus(): void {
    if (this._focused || !this._focusable) return

    this._ctx.focusRenderable(this)
    this._focused = true
    this.requestRender()

    this.keypressHandler = (key: ParsedKey) => {
      this._keyListeners["down"]?.(key)
      if (this.handleKeyPress) {
        this.handleKeyPress(key)
      }
    }

    this.keyHandler.on("keypress", this.keypressHandler)
    this.emit(RenderableEvents.FOCUSED)
  }

  public blur(): void {
    if (!this._focused || !this._focusable) return

    this._focused = false
    this.requestRender()

    if (this.keypressHandler) {
      this.keyHandler.off("keypress", this.keypressHandler)
      this.keypressHandler = null
    }

    this.emit(RenderableEvents.BLURRED)
  }

  public get focused(): boolean {
    return this._focused
  }

  public get live(): boolean {
    return this._live
  }

  public get liveCount(): number {
    return this._liveCount
  }

  public set live(value: boolean) {
    if (this._live === value) return

    this._live = value

    if (this._visible) {
      const delta = value ? 1 : -1
      this.propagateLiveCount(delta)
    }
  }

  protected propagateLiveCount(delta: number): void {
    this._liveCount += delta
    this.parent?.propagateLiveCount(delta)
  }

  public handleKeyPress?(key: ParsedKey | string): boolean

  public findDescendantById(id: string): Renderable | undefined {
    let current = this.layoutNode.firstChild
    while (current) {
      const childRenderable = current.metadata.renderable as Renderable
      if (childRenderable.id === id) return childRenderable
      const found = childRenderable.findDescendantById(id)
      if (found) return found
      current = current.nextSibling
    }
    return undefined
  }

  public requestRender() {
    this.markDirty()
    this._ctx.requestRender()
  }

  public get translateX(): number {
    return this._translateX
  }

  public set translateX(value: number) {
    if (this._translateX === value) return
    this._translateX = value
    this.requestRender()
    if (this.parent) this.parent.childrenPrimarySortDirty = true
  }

  public get translateY(): number {
    return this._translateY
  }

  public set translateY(value: number) {
    if (this._translateY === value) return
    this._translateY = value
    this.requestRender()
    if (this.parent) this.parent.childrenPrimarySortDirty = true
  }

  public get x(): number {
    if (this.parent && this._positionType === "relative") {
      return this.parent.x + this._x + this._translateX
    }
    return this._x + this._translateX
  }

  public set x(value: number) {
    this.left = value
  }

  public get top(): number | "auto" | `${number}%` | undefined {
    return this._position.top
  }

  public set top(value: number | "auto" | `${number}%` | undefined) {
    if (isPositionType(value) || value === undefined) {
      this.setPosition({ top: value })
    }
  }

  public get right(): number | "auto" | `${number}%` | undefined {
    return this._position.right
  }

  public set right(value: number | "auto" | `${number}%` | undefined) {
    if (isPositionType(value) || value === undefined) {
      this.setPosition({ right: value })
    }
  }

  public get bottom(): number | "auto" | `${number}%` | undefined {
    return this._position.bottom
  }

  public set bottom(value: number | "auto" | `${number}%` | undefined) {
    if (isPositionType(value) || value === undefined) {
      this.setPosition({ bottom: value })
    }
  }

  public get left(): number | "auto" | `${number}%` | undefined {
    return this._position.left
  }

  public set left(value: number | "auto" | `${number}%` | undefined) {
    if (isPositionType(value) || value === undefined) {
      this.setPosition({ left: value })
    }
  }

  public get y(): number {
    if (this.parent && this._positionType === "relative") {
      return this.parent.y + this._y + this._translateY
    }
    return this._y + this._translateY
  }

  public set y(value: number) {
    this.top = value
  }

  public get width(): number {
    return this._widthValue
  }

  public set width(value: number | "auto" | `${number}%`) {
    if (isDimensionType(value)) {
      this._width = value
      this.layoutNode.setWidth(value)
      this.requestRender()
    }
  }

  public get height(): number {
    return this._heightValue
  }

  public set height(value: number | "auto" | `${number}%`) {
    if (isDimensionType(value)) {
      this._height = value
      this.layoutNode.setHeight(value)
      this.requestRender()
    }
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

  private requestZIndexSort(): void {
    this.needsZIndexSort = true
  }

  private ensureZIndexSorted(): void {
    if (this.needsZIndexSort) {
      // Get all children as array and sort by zIndex
      const children = this.getChildren()
      children.sort((a, b) => (a.zIndex > b.zIndex ? 1 : a.zIndex < b.zIndex ? -1 : 0))

      // Rebuild the linked list in sorted order
      // First, unlink all children from layout
      let current = this.layoutNode.firstChild
      while (current) {
        const next = current.nextSibling
        this.layoutNode.removeChild(current)
        current = next
      }

      // Re-add children in sorted order
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        this.layoutNode.addChild(child.layoutNode)
      }

      this.needsZIndexSort = false
    }
  }

  public getChildrenSortedByPrimaryAxis(): Renderable[] {
    const children = this.getChildren()
    if (!this.childrenPrimarySortDirty && this.childrenSortedByPrimaryAxis.length === children.length) {
      return this.childrenSortedByPrimaryAxis
    }

    const dir = this.layoutNode.yogaNode.getFlexDirection()
    const axis: "x" | "y" = dir === 2 || dir === 3 ? "x" : "y"

    const sorted = [...children]
    sorted.sort((a, b) => {
      const va = axis === "y" ? a.y : a.x
      const vb = axis === "y" ? b.y : b.x
      return va - vb
    })

    this.childrenSortedByPrimaryAxis = sorted
    this.childrenPrimarySortDirty = false
    return this.childrenSortedByPrimaryAxis
  }

  private setupYogaProperties(options: RenderableOptions<Renderable>): void {
    const node = this.layoutNode.yogaNode

    if (isFlexBasisType(options.flexBasis)) {
      node.setFlexBasis(options.flexBasis)
    }

    if (isSizeType(options.minWidth)) {
      node.setMinWidth(options.minWidth)
    }
    if (isSizeType(options.minHeight)) {
      node.setMinHeight(options.minHeight)
    }

    if (options.flexGrow !== undefined) {
      node.setFlexGrow(options.flexGrow)
    } else {
      node.setFlexGrow(0)
    }

    if (options.flexShrink !== undefined) {
      node.setFlexShrink(options.flexShrink)
    } else {
      const shrinkValue = options.flexGrow && options.flexGrow > 0 ? 1 : 0
      node.setFlexShrink(shrinkValue)
    }

    if (options.flexDirection !== undefined) {
      node.setFlexDirection(parseFlexDirection(options.flexDirection))
    }
    if (options.flexWrap !== undefined) {
      node.setFlexWrap(parseWrap(options.flexWrap))
    }
    if (options.alignItems !== undefined) {
      node.setAlignItems(parseAlign(options.alignItems))
    }
    if (options.justifyContent !== undefined) {
      node.setJustifyContent(parseJustify(options.justifyContent))
    }
    if (options.alignSelf !== undefined) {
      node.setAlignSelf(parseAlign(options.alignSelf))
    }

    if (isDimensionType(options.width)) {
      this._width = options.width
      this.layoutNode.setWidth(options.width)
    }
    if (isDimensionType(options.height)) {
      this._height = options.height
      this.layoutNode.setHeight(options.height)
    }

    this._positionType = options.position === "absolute" ? "absolute" : "relative"
    if (this._positionType !== "relative") {
      node.setPositionType(parsePositionType(this._positionType))
    }

    this._overflow = options.overflow === "hidden" ? "hidden" : options.overflow === "scroll" ? "scroll" : "visible"
    if (this._overflow !== "visible") {
      node.setOverflow(parseOverflow(this._overflow))
    }

    // TODO: flatten position properties internally as well
    const hasPositionProps =
      options.top !== undefined ||
      options.right !== undefined ||
      options.bottom !== undefined ||
      options.left !== undefined
    if (hasPositionProps) {
      this._position = {
        top: options.top,
        right: options.right,
        bottom: options.bottom,
        left: options.left,
      }
      this.updateYogaPosition(this._position)
    }

    if (isSizeType(options.maxWidth)) {
      node.setMaxWidth(options.maxWidth)
    }
    if (isSizeType(options.maxHeight)) {
      node.setMaxHeight(options.maxHeight)
    }

    this.setupMarginAndPadding(options)
  }

  private setupMarginAndPadding(options: RenderableOptions<Renderable>): void {
    const node = this.layoutNode.yogaNode

    if (isMarginType(options.margin)) {
      node.setMargin(Edge.Top, options.margin)
      node.setMargin(Edge.Right, options.margin)
      node.setMargin(Edge.Bottom, options.margin)
      node.setMargin(Edge.Left, options.margin)
    }

    if (isMarginType(options.marginTop)) {
      node.setMargin(Edge.Top, options.marginTop)
    }
    if (isMarginType(options.marginRight)) {
      node.setMargin(Edge.Right, options.marginRight)
    }
    if (isMarginType(options.marginBottom)) {
      node.setMargin(Edge.Bottom, options.marginBottom)
    }
    if (isMarginType(options.marginLeft)) {
      node.setMargin(Edge.Left, options.marginLeft)
    }

    if (isPaddingType(options.padding)) {
      node.setPadding(Edge.Top, options.padding)
      node.setPadding(Edge.Right, options.padding)
      node.setPadding(Edge.Bottom, options.padding)
      node.setPadding(Edge.Left, options.padding)
    }

    if (isPaddingType(options.paddingTop)) {
      node.setPadding(Edge.Top, options.paddingTop)
    }
    if (isPaddingType(options.paddingRight)) {
      node.setPadding(Edge.Right, options.paddingRight)
    }
    if (isPaddingType(options.paddingBottom)) {
      node.setPadding(Edge.Bottom, options.paddingBottom)
    }
    if (isPaddingType(options.paddingLeft)) {
      node.setPadding(Edge.Left, options.paddingLeft)
    }
  }

  set position(positionType: PositionTypeString) {
    if (!isPositionTypeType(positionType) || this._positionType === positionType) return

    this._positionType = positionType
    this.layoutNode.yogaNode.setPositionType(parsePositionType(positionType))
    this.requestRender()
  }

  get overflow(): OverflowString {
    return this._overflow
  }

  set overflow(overflow: OverflowString) {
    if (!isOverflowType(overflow) || this._overflow === overflow) return

    this._overflow = overflow
    this.layoutNode.yogaNode.setOverflow(parseOverflow(overflow))
    this.requestRender()
  }

  public setPosition(position: Position): void {
    this._position = { ...this._position, ...position }
    this.updateYogaPosition(position)
  }

  private updateYogaPosition(position: Position): void {
    const node = this.layoutNode.yogaNode
    const { top, right, bottom, left } = position

    if (isPositionType(top)) {
      if (top === "auto") {
        node.setPositionAuto(Edge.Top)
      } else {
        node.setPosition(Edge.Top, top)
      }
    }
    if (isPositionType(right)) {
      if (right === "auto") {
        node.setPositionAuto(Edge.Right)
      } else {
        node.setPosition(Edge.Right, right)
      }
    }
    if (isPositionType(bottom)) {
      if (bottom === "auto") {
        node.setPositionAuto(Edge.Bottom)
      } else {
        node.setPosition(Edge.Bottom, bottom)
      }
    }
    if (isPositionType(left)) {
      if (left === "auto") {
        node.setPositionAuto(Edge.Left)
      } else {
        node.setPosition(Edge.Left, left)
      }
    }
    this.requestRender()
  }

  public set flexGrow(grow: number) {
    this.layoutNode.yogaNode.setFlexGrow(grow)
    this.requestRender()
  }

  public set flexShrink(shrink: number) {
    this.layoutNode.yogaNode.setFlexShrink(shrink)
    this.requestRender()
  }

  public set flexDirection(direction: FlexDirectionString) {
    this.layoutNode.yogaNode.setFlexDirection(parseFlexDirection(direction))
    this.requestRender()
  }

  public set flexWrap(wrap: WrapString) {
    this.layoutNode.yogaNode.setFlexWrap(parseWrap(wrap))
    this.requestRender()
  }

  public set alignItems(alignItems: AlignString) {
    this.layoutNode.yogaNode.setAlignItems(parseAlign(alignItems))
    this.requestRender()
  }

  public set justifyContent(justifyContent: JustifyString) {
    this.layoutNode.yogaNode.setJustifyContent(parseJustify(justifyContent))
    this.requestRender()
  }

  public set alignSelf(alignSelf: AlignString) {
    this.layoutNode.yogaNode.setAlignSelf(parseAlign(alignSelf))
    this.requestRender()
  }

  public set flexBasis(basis: number | "auto" | undefined) {
    if (isFlexBasisType(basis)) {
      this.layoutNode.yogaNode.setFlexBasis(basis)
      this.requestRender()
    }
  }

  public set minWidth(minWidth: number | `${number}%` | undefined) {
    if (isSizeType(minWidth)) {
      this.layoutNode.yogaNode.setMinWidth(minWidth)
      this.requestRender()
    }
  }

  public set maxWidth(maxWidth: number | `${number}%` | undefined) {
    if (isSizeType(maxWidth)) {
      this.layoutNode.yogaNode.setMaxWidth(maxWidth)
      this.requestRender()
    }
  }

  public set minHeight(minHeight: number | `${number}%` | undefined) {
    if (isSizeType(minHeight)) {
      this.layoutNode.yogaNode.setMinHeight(minHeight)
      this.requestRender()
    }
  }

  public set maxHeight(maxHeight: number | `${number}%` | undefined) {
    if (isSizeType(maxHeight)) {
      this.layoutNode.yogaNode.setMaxHeight(maxHeight)
      this.requestRender()
    }
  }

  public set margin(margin: number | "auto" | `${number}%` | undefined) {
    if (isMarginType(margin)) {
      const node = this.layoutNode.yogaNode
      node.setMargin(Edge.Top, margin)
      node.setMargin(Edge.Right, margin)
      node.setMargin(Edge.Bottom, margin)
      node.setMargin(Edge.Left, margin)
      this.requestRender()
    }
  }

  public set marginTop(margin: number | "auto" | `${number}%` | undefined) {
    if (isMarginType(margin)) {
      this.layoutNode.yogaNode.setMargin(Edge.Top, margin)
      this.requestRender()
    }
  }

  public set marginRight(margin: number | "auto" | `${number}%` | undefined) {
    if (isMarginType(margin)) {
      this.layoutNode.yogaNode.setMargin(Edge.Right, margin)
      this.requestRender()
    }
  }

  public set marginBottom(margin: number | "auto" | `${number}%` | undefined) {
    if (isMarginType(margin)) {
      this.layoutNode.yogaNode.setMargin(Edge.Bottom, margin)
      this.requestRender()
    }
  }

  public set marginLeft(margin: number | "auto" | `${number}%` | undefined) {
    if (isMarginType(margin)) {
      this.layoutNode.yogaNode.setMargin(Edge.Left, margin)
      this.requestRender()
    }
  }

  public set padding(padding: number | `${number}%` | undefined) {
    if (isPaddingType(padding)) {
      const node = this.layoutNode.yogaNode
      node.setPadding(Edge.Top, padding)
      node.setPadding(Edge.Right, padding)
      node.setPadding(Edge.Bottom, padding)
      node.setPadding(Edge.Left, padding)
      this.requestRender()
    }
  }

  public set paddingTop(padding: number | `${number}%` | undefined) {
    if (isPaddingType(padding)) {
      this.layoutNode.yogaNode.setPadding(Edge.Top, padding)
      this.requestRender()
    }
  }

  public set paddingRight(padding: number | `${number}%` | undefined) {
    if (isPaddingType(padding)) {
      this.layoutNode.yogaNode.setPadding(Edge.Right, padding)
      this.requestRender()
    }
  }

  public set paddingBottom(padding: number | `${number}%` | undefined) {
    if (isPaddingType(padding)) {
      this.layoutNode.yogaNode.setPadding(Edge.Bottom, padding)
      this.requestRender()
    }
  }

  public set paddingLeft(padding: number | `${number}%` | undefined) {
    if (isPaddingType(padding)) {
      this.layoutNode.yogaNode.setPadding(Edge.Left, padding)
      this.requestRender()
    }
  }

  public getLayoutNode(): TrackedNode {
    return this.layoutNode
  }

  public updateFromLayout(): void {
    const layout = this.layoutNode.yogaNode.getComputedLayout()

    const oldX = this._x
    const oldY = this._y

    this._x = layout.left
    this._y = layout.top

    const newWidth = Math.max(layout.width, 1)
    const newHeight = Math.max(layout.height, 1)
    const sizeChanged = this.width !== newWidth || this.height !== newHeight

    this._widthValue = newWidth
    this._heightValue = newHeight

    if (sizeChanged) {
      this.onLayoutResize(newWidth, newHeight)
    }

    if (oldX !== this._x || oldY !== this._y) {
      if (this.parent) this.parent.childrenPrimarySortDirty = true
    }
  }

  protected onLayoutResize(width: number, height: number): void {
    if (this._visible) {
      this.handleFrameBufferResize(width, height)
      this.onResize(width, height)
      this.requestRender()
    }
  }

  protected handleFrameBufferResize(width: number, height: number): void {
    if (!this.buffered) return

    if (width <= 0 || height <= 0) {
      return
    }

    if (this.frameBuffer) {
      this.frameBuffer.resize(width, height)
    } else {
      this.createFrameBuffer()
    }
  }

  protected createFrameBuffer(): void {
    const w = this.width
    const h = this.height

    if (w <= 0 || h <= 0) {
      return
    }

    try {
      const widthMethod = this._ctx.widthMethod
      this.frameBuffer = OptimizedBuffer.create(w, h, widthMethod, { respectAlpha: true })
    } catch (error) {
      console.error(`Failed to create frame buffer for ${this.id}:`, error)
      this.frameBuffer = null
    }
  }

  protected onResize(width: number, height: number): void {
    this.onSizeChange?.()
    this.emit("resize")
    // Override in subclasses for additional resize logic
  }

  private replaceParent(obj: Renderable) {
    if (obj.parent) {
      obj.parent.remove(obj.id)
    }
    obj.parent = this
  }

  private _forceLayoutUpdateFor: Renderable[] | null = null
  public add(obj: Renderable | VNode<any, any[]> | unknown, index?: number): number {
    if (!obj) {
      return -1
    }

    const renderable = maybeMakeRenderable(this._ctx, obj)
    if (!renderable) {
      return -1
    }

    if (renderable.isDestroyed) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`Renderable with id ${renderable.id} was already destroyed, skipping add`)
      }
      return -1
    }

    if (this.renderableMap.has(renderable.id)) {
      console.warn(`A renderable with id ${renderable.id} already exists in ${this.id}, removing it`)
      this.remove(renderable.id)
    }

    this.replaceParent(renderable)

    const childLayoutNode = renderable.getLayoutNode()
    let insertedIndex: number
    if (index !== undefined) {
      insertedIndex = this.layoutNode.insertChild(childLayoutNode, index)
      // Track children that need layout updates after insertion
      const childrenFromIndex = this.getChildrenFromIndex(index)
      this._forceLayoutUpdateFor = childrenFromIndex
    } else {
      insertedIndex = this.layoutNode.addChild(childLayoutNode)
    }
    this.needsZIndexSort = true
    this.childrenPrimarySortDirty = true
    this.renderableMap.set(renderable.id, renderable)
    this._newChildren.push(renderable)

    if (renderable._liveCount > 0) {
      this.propagateLiveCount(renderable._liveCount)
    }

    this.requestRender()

    return insertedIndex
  }

  private getChildrenFromIndex(index: number): Renderable[] {
    const result: Renderable[] = []
    let current = this.layoutNode.getChildAtIndex(index)
    while (current) {
      const renderable = current.metadata.renderable as Renderable
      result.push(renderable)
      current = current.nextSibling
    }
    return result
  }

  insertBefore(obj: Renderable | VNode<any, any[]> | unknown, anchor?: Renderable | unknown): number {
    if (!obj) {
      return -1
    }

    const renderable = maybeMakeRenderable(this._ctx, obj)
    if (!renderable) {
      return -1
    }

    if (!anchor) {
      return this.add(renderable)
    }

    if (!isRenderable(anchor)) {
      throw new Error("Anchor must be a Renderable")
    }

    // Should we really throw for this? Maybe just log a warning in dev.
    if (!this.renderableMap.has(anchor.id)) {
      throw new Error("Anchor does not exist")
    }

    if (renderable.isDestroyed) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`Renderable with id ${renderable.id} was already destroyed, skipping insertBefore`)
      }
      return -1
    }

    if (this.renderableMap.has(renderable.id)) {
      console.warn(`A renderable with id ${renderable.id} already exists in ${this.id}, removing it`)
      this.remove(renderable.id)
    }

    this.replaceParent(renderable)

    // Use TrackedNode's insertBefore method directly
    const insertedIndex = this.layoutNode.insertBefore(renderable.getLayoutNode(), anchor.getLayoutNode())

    this.needsZIndexSort = true
    this.childrenPrimarySortDirty = true
    this.renderableMap.set(renderable.id, renderable)
    this._newChildren.push(renderable)

    if (renderable._liveCount > 0) {
      this.propagateLiveCount(renderable._liveCount)
    }

    this.requestRender()

    return insertedIndex
  }

  // TODO: that naming is meh
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
        if (obj._liveCount > 0) {
          this.propagateLiveCount(-obj._liveCount)
        }

        const childLayoutNode = obj.getLayoutNode()
        this.layoutNode.removeChild(childLayoutNode)
        this.requestRender()

        obj.onRemove()
        obj.parent = null
      }
      this.renderableMap.delete(id)
      this.childrenPrimarySortDirty = true
    }
  }

  protected onRemove(): void {
    // Default implementation: do nothing
    // Override this method to provide custom removal logic
  }

  public getChildren(): Renderable[] {
    const result: Renderable[] = []
    let current = this.layoutNode.firstChild
    while (current) {
      const renderable = current.metadata.renderable as Renderable
      result.push(renderable)
      current = current.nextSibling
    }
    return result
  }

  public getChildrenCount(): number {
    return this.layoutNode.getChildCount()
  }

  public updateLayout(deltaTime: number, renderList: RenderCommand[] = []): void {
    if (!this.visible) return

    // NOTE: worst case updateFromLayout is called throughout the whole tree,
    // which currently still has yoga performance issues.
    // This can be mitigated at some point when the layout tree moved to native,
    // as in the native yoga tree we can use events during the calculateLayout phase,
    // and anctually know if a child has changed or not.
    // That would allow us to to generate optimised render commands,
    // including the layout updates, in one pass.
    this.updateFromLayout()

    this.onUpdate(deltaTime)
    renderList.push({ action: "render", renderable: this })

    // Note: This will update newly added children, but not their children.
    // It is meant to make sure children update the layout, even though they may not be in the viewport
    // and filtered out for updates like for the ScrollBox for example.
    if (this._newChildren.length > 0) {
      for (const child of this._newChildren) {
        child.updateFromLayout()
      }
      this._newChildren = []
    }

    // NOTE: This is a hack to force layout updates for children that were after the anchor index,
    // related to the the layout constraints described above and elsewhere.
    // Simpler would be to just update all children in that case, but also expensive for a long list of children.
    if (this._forceLayoutUpdateFor) {
      for (const child of this._forceLayoutUpdateFor) {
        child.updateFromLayout()
      }
      this._forceLayoutUpdateFor = null
    }

    this.ensureZIndexSorted()

    const shouldPushScissor = this._overflow !== "visible" && this.width > 0 && this.height > 0
    if (shouldPushScissor) {
      const scissorRect = this.getScissorRect()
      renderList.push({
        action: "pushScissorRect",
        x: scissorRect.x,
        y: scissorRect.y,
        width: scissorRect.width,
        height: scissorRect.height,
      })
    }

    for (const child of this._getChildren()) {
      child.updateLayout(deltaTime, renderList)
    }

    if (shouldPushScissor) {
      renderList.push({ action: "popScissorRect" })
    }
  }

  public render(buffer: OptimizedBuffer, deltaTime: number): void {
    let renderBuffer = buffer
    if (this.buffered && this.frameBuffer) {
      renderBuffer = this.frameBuffer
    }

    if (this.renderBefore) {
      this.renderBefore.call(this, renderBuffer, deltaTime)
    }

    this.renderSelf(renderBuffer, deltaTime)

    if (this.renderAfter) {
      this.renderAfter.call(this, renderBuffer, deltaTime)
    }

    this.markClean()
    this._ctx.addToHitGrid(this.x, this.y, this.width, this.height, this.num)

    if (this.buffered && this.frameBuffer) {
      buffer.drawFrameBuffer(this.x, this.y, this.frameBuffer)
    }
  }

  protected _getChildren(): Renderable[] {
    return this.getChildren()
  }

  protected onUpdate(deltaTime: number): void {
    // Default implementation: do nothing
    // Override this method to provide custom rendering
  }

  protected getScissorRect(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.buffered ? 0 : this.x,
      y: this.buffered ? 0 : this.y,
      width: this.width,
      height: this.height,
    }
  }

  protected renderSelf(buffer: OptimizedBuffer, deltaTime: number): void {
    // Default implementation: do nothing
    // Override this method to provide custom rendering
  }

  public get isDestroyed(): boolean {
    return this._isDestroyed
  }

  public destroy(): void {
    if (this._isDestroyed) {
      return
    }

    this._isDestroyed = true

    if (this.parent) {
      this.parent.remove(this.id)
    }

    if (this.frameBuffer) {
      this.frameBuffer.destroy()
      this.frameBuffer = null
    }

    const children = this.getChildren()
    for (const child of children) {
      this.remove(child.id)
    }

    this.renderableMap.clear()
    Renderable.renderablesByNumber.delete(this.num)

    this.blur()
    this.removeAllListeners()

    this.destroySelf()
    this.layoutNode.destroy()
  }

  public destroyRecursively(): void {
    // Destroy children first to ensure removal as destroy clears child list
    const children = this.getChildren()
    for (const child of children) {
      child.destroyRecursively()
    }
    this.destroy()
  }

  protected destroySelf(): void {
    // Default implementation: do nothing else
    // Override this method to provide custom cleanup
  }

  public processMouseEvent(event: MouseEvent): void {
    this._mouseListener?.call(this, event)
    this._mouseListeners[event.type]?.call(this, event)
    this.onMouseEvent(event)

    if (this.parent && !event.propagationStopped) {
      this.parent.processMouseEvent(event)
    }
  }

  protected onMouseEvent(event: MouseEvent): void {
    // Default implementation: do nothing
    // Override this method to provide custom event handling
  }

  public set onMouse(handler: ((event: MouseEvent) => void) | undefined) {
    if (handler) this._mouseListener = handler
    else this._mouseListener = null
  }

  public set onMouseDown(handler: ((event: MouseEvent) => void) | undefined) {
    if (handler) this._mouseListeners["down"] = handler
    else delete this._mouseListeners["down"]
  }

  public set onMouseUp(handler: ((event: MouseEvent) => void) | undefined) {
    if (handler) this._mouseListeners["up"] = handler
    else delete this._mouseListeners["up"]
  }

  public set onMouseMove(handler: ((event: MouseEvent) => void) | undefined) {
    if (handler) this._mouseListeners["move"] = handler
    else delete this._mouseListeners["move"]
  }

  public set onMouseDrag(handler: ((event: MouseEvent) => void) | undefined) {
    if (handler) this._mouseListeners["drag"] = handler
    else delete this._mouseListeners["drag"]
  }

  public set onMouseDragEnd(handler: ((event: MouseEvent) => void) | undefined) {
    if (handler) this._mouseListeners["drag-end"] = handler
    else delete this._mouseListeners["drag-end"]
  }

  public set onMouseDrop(handler: ((event: MouseEvent) => void) | undefined) {
    if (handler) this._mouseListeners["drop"] = handler
    else delete this._mouseListeners["drop"]
  }

  public set onMouseOver(handler: ((event: MouseEvent) => void) | undefined) {
    if (handler) this._mouseListeners["over"] = handler
    else delete this._mouseListeners["over"]
  }

  public set onMouseOut(handler: ((event: MouseEvent) => void) | undefined) {
    if (handler) this._mouseListeners["out"] = handler
    else delete this._mouseListeners["out"]
  }

  public set onMouseScroll(handler: ((event: MouseEvent) => void) | undefined) {
    if (handler) this._mouseListeners["scroll"] = handler
    else delete this._mouseListeners["scroll"]
  }

  public set onKeyDown(handler: ((key: ParsedKey) => void) | undefined) {
    if (handler) this._keyListeners["down"] = handler
    else delete this._keyListeners["down"]
  }
  public get onKeyDown(): ((key: ParsedKey) => void) | undefined {
    return this._keyListeners["down"]
  }

  public set onSizeChange(handler: (() => void) | undefined) {
    this._sizeChangeListener = handler
  }
  public get onSizeChange(): (() => void) | undefined {
    return this._sizeChangeListener
  }

  private applyEventOptions(options: RenderableOptions<Renderable>): void {
    this.onMouse = options.onMouse
    this.onMouseDown = options.onMouseDown
    this.onMouseUp = options.onMouseUp
    this.onMouseMove = options.onMouseMove
    this.onMouseDrag = options.onMouseDrag
    this.onMouseDragEnd = options.onMouseDragEnd
    this.onMouseDrop = options.onMouseDrop
    this.onMouseOver = options.onMouseOver
    this.onMouseOut = options.onMouseOut
    this.onMouseScroll = options.onMouseScroll
    this.onKeyDown = options.onKeyDown
    this.onSizeChange = options.onSizeChange
  }
}

interface RenderCommandBase {
  action: "render" | "pushScissorRect" | "popScissorRect"
}

interface RenderCommandPushScissorRect extends RenderCommandBase {
  action: "pushScissorRect"
  x: number
  y: number
  width: number
  height: number
}

interface RenderCommandPopScissorRect extends RenderCommandBase {
  action: "popScissorRect"
}

interface RenderCommandRender extends RenderCommandBase {
  action: "render"
  renderable: Renderable
}

export type RenderCommand = RenderCommandPushScissorRect | RenderCommandPopScissorRect | RenderCommandRender

export class RootRenderable extends Renderable {
  private yogaConfig: Config
  private renderList: RenderCommand[] = []

  constructor(ctx: RenderContext) {
    super(ctx, { id: "__root__", zIndex: 0, visible: true, width: ctx.width, height: ctx.height, enableLayout: true })

    this.yogaConfig = Yoga.Config.create()
    this.yogaConfig.setUseWebDefaults(false)
    this.yogaConfig.setPointScaleFactor(1)

    if (this.layoutNode) {
      this.layoutNode.destroy()
    }

    this.layoutNode = createTrackedNode({}, this.yogaConfig)
    this.layoutNode.setWidth(ctx.width)
    this.layoutNode.setHeight(ctx.height)
    this.layoutNode.yogaNode.setFlexDirection(FlexDirection.Column)

    this.calculateLayout()
  }

  public render(buffer: OptimizedBuffer, deltaTime: number): void {
    if (!this.visible) return

    // NOTE: Strictly speaking, this is a 3-pass rendering process:
    // 1. Calculate layout from root
    // 2. Update layout throughout the tree and collect render list
    // 3. Render all collected renderables
    // Should be 2-pass by hooking into the calculateLayout phase,
    // but that's only possible if we move the layout tree to native.

    // 1. Calculate layout from root
    if (this.layoutNode.yogaNode.isDirty()) {
      this.calculateLayout()
    }

    // 2. Update layout throughout the tree and collect render list
    this.renderList.length = 0
    this.updateLayout(deltaTime, this.renderList)

    // 3. Render all collected renderables
    for (let i = 1; i < this.renderList.length; i++) {
      const command = this.renderList[i]
      switch (command.action) {
        case "render":
          command.renderable.render(buffer, deltaTime)
          break
        case "pushScissorRect":
          buffer.pushScissorRect(command.x, command.y, command.width, command.height)
          break
        case "popScissorRect":
          buffer.popScissorRect()
          break
      }
    }
  }

  protected propagateLiveCount(delta: number): void {
    const oldCount = this._liveCount
    this._liveCount += delta

    if (oldCount === 0 && this._liveCount > 0) {
      this._ctx.requestLive()
    } else if (oldCount > 0 && this._liveCount === 0) {
      this._ctx.dropLive()
    }
  }

  public calculateLayout(): void {
    this.layoutNode.yogaNode.calculateLayout(this.width, this.height, Direction.LTR)
    this.emit(LayoutEvents.LAYOUT_CHANGED)
  }

  public resize(width: number, height: number): void {
    this.width = width
    this.height = height

    this.emit(LayoutEvents.RESIZED, { width, height })
  }

  protected onUpdate(deltaTime: number): void {
    // Layout calculation is now handled in render() method
    // This method can be used for other update logic if needed
  }

  protected destroySelf(): void {
    if (this.layoutNode) {
      this.layoutNode.destroy()
    }

    try {
      this.yogaConfig.free()
    } catch (error) {
      // Config might already be freed
    }
  }
}
