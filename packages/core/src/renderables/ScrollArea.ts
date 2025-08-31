import { Edge } from "yoga-layout"
import {
  MouseEvent,
  OptimizedBuffer,
  parseColor,
  Renderable,
  RGBA,
  type ParsedKey,
  type RenderableOptions,
  type RenderContext,
} from ".."

export type Size = {
  width: number
  height: number
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max)
}

class ViewportRenderable extends Renderable {
  protected focusable: boolean = true

  constructor(ctx: RenderContext, options: RenderableOptions) {
    super(ctx, options)
  }

  public get size(): Size {
    const node = this.getLayoutNode().yogaNode
    const { width, height } = node.getComputedLayout()
    return {
      width,
      height,
    }
  }
}

export class ScrollBarRenderable extends Renderable {
  private _contentSize: Size = {
    width: 0,
    height: 0,
  }

  private _viewportSize: Size = {
    width: 0,
    height: 0,
  }

  private _trackColor: RGBA
  private _thumbColor: RGBA

  private _thumbPos = 0
  private _thumbSize = 0

  private _defaultOptions = {
    trackColor: RGBA.fromValues(0.15, 0.15, 0.16),
    thumbColor: RGBA.fromValues(0.62, 0.62, 0.66),
    orientation: "vertical",
  }

  constructor(ctx: RenderContext, options: RenderableOptions) {
    super(ctx, options)

    this._trackColor = parseColor(this._defaultOptions.trackColor)
    this._thumbColor = parseColor(this._defaultOptions.thumbColor)
  }

  public get thumbPos() {
    return this._thumbPos
  }

  public set thumbPos(pos: number) {
    this._thumbPos = pos
    this.needsUpdate()
  }

  public get thumbSize() {
    return this._thumbSize
  }

  public set thumbSize(size: number) {
    this._thumbSize = size
    this.needsUpdate()
  }

  public get contentSize() {
    return this._contentSize
  }

  public set contentSize(size: Size) {
    this._contentSize = size
    this.needsUpdate()
  }

  public get viewportSize() {
    return this._viewportSize
  }

  public set viewportSize(size: Size) {
    this._viewportSize = size
    this.needsUpdate()
  }

  protected onMouseEvent(event: MouseEvent): void {}

  protected renderSelf(buffer: OptimizedBuffer, deltaTime: number): void {
    buffer.fillRect(this.x, this.y, this.width, this._viewportSize.height, this._trackColor)

    buffer.fillRect(this.x, this.thumbPos, this.width, this.thumbSize, this._thumbColor)

    console.log(this._viewportSize, this._contentSize)
  }
}

type ScrollBarOptions = RenderableOptions & {
  thickness?: number
}

type ScrollAreaOptions = RenderableOptions & {
  scrollbars?: {
    vertical: ScrollBarOptions
    horizontal: ScrollBarOptions
  }
}

export class ScrollAreaRenderable extends Renderable {
  protected focusable: boolean = true

  protected viewport: ViewportRenderable
  protected vertical: ScrollBarRenderable

  protected _contentSize: Size = {
    width: 0,
    height: 0,
  }
  protected _viewportSize: Size = {
    width: 0,
    height: 0,
  }

  private _offset: number = 0
  private _maxOffset: number = 0
  private _ratio: number = 0

  protected verticalThickness = 2
  protected horizontalThickness = 1

  constructor(ctx: RenderContext, options: ScrollAreaOptions) {
    super(ctx, { ...options, buffered: true })

    this.viewport = new ViewportRenderable(ctx, {
      onKeyDown: (key) => this.onKeyPress(key),
    })

    this.vertical = new ScrollBarRenderable(ctx, {
      position: "absolute",
      top: 0,
      right: 0,
      width: this.verticalThickness,
    })

    super.add(this.viewport)
    super.add(this.vertical)
    this.setChildHostById(this.viewport.id)

    this.viewport.focus()
  }

  private move(delta: number) {
    const newOffset = clamp(this._offset + delta, 0, this._maxOffset)
    const ratio = this._maxOffset ? newOffset / this._maxOffset : 0

    this._ratio = ratio
    this.offset = newOffset
  }

  private set offset(newOffset: number) {
    if (newOffset !== this._offset) {
      this._offset = newOffset
      this.updateThumb()

      this.viewport.getLayoutNode().yogaNode.setPosition(Edge.Top, -this._offset)
    }
  }

  private updateMaxOffset() {
    const maxOffset = Math.max(this._contentSize.height - this.height, 0)

    if (maxOffset !== this._maxOffset) {
      this._maxOffset = maxOffset
    }
  }

  private updateThumb() {
    const size = this._viewportSize.height
    const content = this._contentSize.height

    const thumbSize = Math.max(1, Math.ceil((size / content) * size))

    const pos = clamp((this._maxOffset ? this._offset / this._maxOffset : 0) * (size - thumbSize), 0, size - thumbSize)

    this.vertical.thumbPos = pos
    this.vertical.thumbSize = thumbSize
  }

  private updateContentSize() {
    const newSize = this.viewport.size
    if (!Bun.deepMatch(newSize, this._contentSize)) {
      this._contentSize = newSize
      this.vertical.contentSize = newSize
    }
  }

  private updateViewportSize() {
    const node = this.getLayoutNode().yogaNode
    const { width, height } = node.getComputedLayout()
    const newSize: Size = {
      width: width - this.verticalThickness,
      height: height,
    }

    if (!Bun.deepMatch(newSize, this._viewportSize)) {
      this._viewportSize = newSize
      this.vertical.viewportSize = newSize

      const vertical = this.vertical.getLayoutNode().yogaNode
      vertical.setHeight(newSize.height - this.horizontalThickness)
    }
  }

  protected onResize(): void {
    this.needsUpdate()
  }

  public onKeyPress(key: ParsedKey | string): boolean {
    const keyName = typeof key === "string" ? key : key.name

    switch (keyName) {
      case "up":
        this.move(-1)
        return true
      case "down":
        this.move(1)
        return true
    }

    return false
  }

  protected renderSelf(): void {
    this.updateViewportSize()
    this.updateContentSize()
    this.updateMaxOffset()
    this.updateThumb()
  }
}
