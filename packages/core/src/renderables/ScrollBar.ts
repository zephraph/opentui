// Old ScrollBar Renderable

import { Renderable, type RenderableOptions } from "../Renderable"
import { OptimizedBuffer } from "../buffer"
import type { ParsedKey } from "../lib/parse.keypress"
import { RGBA, parseColor } from "../lib/RGBA"
import { MouseEvent } from ".."
import type { RenderContext } from ".."

export interface ScrollBarOptions extends RenderableOptions {
  trackColor?: string | RGBA,
  thumbColor?: string | RGBA,
  orientation?: "horizontal" | "vertical"
}

export enum ScrollSource {
  WHEEL = "wheel",
  KEY = "key",
  DRAG = "drag",
  TRACK = "track"
}

export enum ScrollBarEvents {
  USER_SCROLL = "userScroll",
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max)
}

function isVertical(orientation: "horizontal" | "vertical"): orientation is "vertical" {
  return orientation === "vertical"
}

export class ScrollBarRenderable extends Renderable {
  protected focusable: boolean = true
  private _trackColor: RGBA
  private _thumbColor: RGBA
  private _orientation: "horizontal" | "vertical"
  protected _contentSize: { width: number, height: number } = {
    width: 0,
    height: 0
  }

  private offset: number = 0
  private maxOffset: number = 0
  private ratio: number = 0

  private thumbSize: { width: number, height: number } = {
    height: 0,
    width: 0,
  }
  private pathSize: { width: number, height: number } = {
    height: 0,
    width: 0,
  }
  private thumbPos: number = 0

  private _defaultOptions = {
    trackColor: RGBA.fromValues(0.15, 0.15, 0.16),
    thumbColor: RGBA.fromValues(0.62, 0.62, 0.66),
    orientation: "vertical"
  } satisfies Partial<ScrollBarOptions>

  constructor(ctx: RenderContext, options: ScrollBarOptions) {
    super(ctx, { ...options, buffered: true })

    this._orientation = options.orientation || this._defaultOptions.orientation
    this._trackColor = parseColor(options.trackColor || this._defaultOptions.trackColor)
    this._thumbColor = parseColor(options.thumbColor || this._defaultOptions.thumbColor)

    this.needsUpdate()
  }

  public get trackColor(): RGBA {
    return this._trackColor
  }

  public set trackColor(value: RGBA | string | undefined) {
    const newColor = parseColor(value ?? this._defaultOptions.trackColor)
    if (this._trackColor !== newColor) {
      this._trackColor = newColor
      this.needsUpdate()
    }
  }

  public get thumbColor(): RGBA {
    return this._thumbColor
  }

  public set thumbColor(value: RGBA | string | undefined) {
    const newColor = parseColor(value ?? this._defaultOptions.thumbColor)
    if (this._thumbColor !== newColor) {
      this._thumbColor = newColor
      this.needsUpdate()
    }
  }

  private move(delta: number, type: ScrollSource) {
    const newOffset = clamp(this.offset + delta, 0, this.maxOffset)
    const size = isVertical(this._orientation) ? this.height : this.width;
    const ratio = this.maxOffset ? newOffset / this.maxOffset : 0
    this.ratio = ratio
    this.emit(ScrollBarEvents.USER_SCROLL, {
      type: type,
      position: (ratio * size).toFixed(),
      ratio: ratio.toFixed(2)
    })
    this.updateOffset(newOffset);
  }

  private updateOffset(newOffset: number): void {
    if (newOffset !== this.offset) {
      this.offset = newOffset
      this.needsUpdate()
    }
  }

  private updateThumb() {
    const vertical = isVertical(this._orientation)
    const size = vertical ? this.height : this.width
    const content = vertical ? this._contentSize.height : this._contentSize.width

    const thumbSize = Math.max(1, Math.ceil((size / content) * size))

    const pos = clamp(
      (this.maxOffset ? this.offset / this.maxOffset : 0) * (size - thumbSize),
      0,
      size - thumbSize,
    )

    const newThumbSize = {
      width: vertical ? 2 : thumbSize,
      height: vertical ? thumbSize : 1,
    }

    if (!Bun.deepMatch(newThumbSize, this.thumbSize)) {
      this.thumbSize = newThumbSize
      this.needsUpdate()
    }

    const newPathSize = {
      width: vertical ? 2 : this.width,
      height: vertical ? this.height : 1,
    }

    if (!Bun.deepMatch(newPathSize, this.pathSize)) {
      this.pathSize = newPathSize
      this.needsUpdate()
    }

    if (pos !== this.thumbPos) {
      this.thumbPos = pos
      this.needsUpdate()
    }
  }

  protected onResize(width: number, height: number): void {
    const vertical = isVertical(this._orientation)

    this.width = width
    this.height = height

    const newMaxOffset = vertical
      ? Math.max(this._contentSize.height - height, 0)
      : Math.max(this._contentSize.width - width, 0)

    this.maxOffset = newMaxOffset

    const newOffset = clamp(this.ratio * newMaxOffset, 0, newMaxOffset)
    this.updateOffset(newOffset)

    this.needsUpdate()
  }

  public handleKeyPress(key: ParsedKey | string): boolean {
    const keyName = typeof key === "string" ? key : key.name

    switch (keyName) {
      case "up":
        if (this._orientation === "vertical") {
          this.move(-1, ScrollSource.KEY)
          return true
        }
        return false
      case "down":
        if (this._orientation === "vertical") {
          this.move(1, ScrollSource.KEY)
          return true
        }
        return false
      case "left":
        if (this._orientation === "horizontal") {
          this.move(-1, ScrollSource.KEY)
          return true
        }
        return false
      case "right":
        if (this._orientation === "horizontal") {
          this.move(1, ScrollSource.KEY)
          return true
        }
        return false
    }

    return false
  }

  protected onMouseEvent(event: MouseEvent): void {
    // No touchpad event
    if (event.type === "scroll" && event.scroll && isVertical(this._orientation)) {
      const delta = event.scroll.delta * (event.scroll.direction === "up" ? -1 : 1);

      this.move(delta, ScrollSource.WHEEL);
    }
    if (["down", "drag", "drag-end"].includes(event.type)) {
      const size = isVertical(this._orientation) ? this.height : this.width;
      const ratio = clamp((isVertical(this._orientation) ? event.y : event.x) / (size - 1), 0, 1);

      this.ratio = ratio

      const newOffset = Math.floor(ratio * this.maxOffset)

      this.emit(ScrollBarEvents.USER_SCROLL, {
        type: event.type === "down" ? ScrollSource.TRACK : ScrollSource.DRAG,
        position: isVertical(this._orientation) ? event.y : event.x,
        ratio: ratio.toFixed(2)
      })

      this.updateOffset(newOffset)
    }
  }

  protected updateContentSize() {
    const node = this.getLayoutNode().yogaNode
    node.setHeightAuto()
    node.setWidthAuto()
    node.calculateLayout(undefined, undefined)
    this._contentSize = { width: node.getComputedWidth(), height: node.getComputedHeight() }
  }

  protected updateMaxOffset() {
    this.maxOffset = this._orientation === "vertical"
      ? Math.max(this._contentSize.height - this.height, 0)
      : Math.max(this._contentSize.width - this.width, 0)
  }

  protected afterRender(buffer: OptimizedBuffer, deltaTime: number): void {
    this.updateContentSize()
    this.updateMaxOffset()
    this.updateThumb()

    console.log(this.x, this.y);

    buffer.fillRect(0, 0, 10, 10, parseColor("#f00"))

    // Thumb
    // buffer.fillRect(
    //   isVertical(this._orientation) ? this.x : this.thumbPos,
    //   isVertical(this._orientation) ? this.thumbPos : this.y,
    //   this.thumbSize.width,
    //   this.thumbSize.height,
    //   this._thumbColor,
    // )
  }

  protected renderSelf(buffer: OptimizedBuffer, deltaTime: number): void {
    this.renderAfter = (buffer, deltaTime) => this.afterRender(buffer, deltaTime)
  }
}
