import { Renderable } from "./Renderable"

import {
  BorderChars,
  drawBorder,
  getBorderSides,
  type BorderCharacters,
  type BorderSides,
  type BorderStyle,
  type BorderSidesConfig,
  type RenderableOptions,
  Fragment,
} from "."
import type { OptimizedBuffer } from "./buffer"
import { RGBA } from "./types"
import { parseColor } from "./utils"

export interface TextOptions {
  content: string
  x: number
  y: number
  zIndex: number
  fg?: string | RGBA
  bg?: string | RGBA
  attributes?: number
  visible?: boolean
}

export class TextRenderable extends Renderable {
  private _content: string
  private _fg: RGBA
  private _bg: RGBA
  public attributes: number = 0

  constructor(id: string, options: TextOptions) {
    super(id, options)

    const fgRgb = parseColor(options.fg || RGBA.fromInts(255, 255, 255, 255))

    this._content = options.content
    this._fg = fgRgb
    this._bg = options.bg !== undefined ? parseColor(options.bg) : RGBA.fromValues(0, 0, 0, 0)
    this.attributes = options.attributes || 0
  }

  get fg(): RGBA {
    return this._fg
  }

  get bg(): RGBA {
    return this._bg
  }

  set fg(value: RGBA | string | undefined) {
    if (value) {
      this._fg = parseColor(value)
      this.needsUpdate = true
    }
  }

  set bg(value: RGBA | string | undefined) {
    if (value) {
      this._bg = parseColor(value)
      this.needsUpdate = true
    }
  }

  set content(value: string) {
    this._content = value
    this.needsUpdate = true
  }

  get content(): string {
    return this._content
  }

  protected renderSelf(buffer: OptimizedBuffer): void {
    buffer.drawText(this._content, this.x, this.y, this._fg, this._bg, this.attributes)
  }
}

export interface BoxOptions {
  x: number
  y: number
  width: number
  height: number
  bg: string | RGBA
  zIndex: number
  borderStyle?: BorderStyle
  border?: boolean | BorderSides[]
  borderColor?: string | RGBA
  customBorderChars?: BorderCharacters
  shouldFill?: boolean
  visible?: boolean
  title?: string
  titleAlignment?: "left" | "center" | "right"
}

export class BoxRenderable extends Renderable {
  public width: number
  public height: number
  public _bg: RGBA
  public _border: boolean | BorderSides[]
  public _borderStyle: BorderStyle
  public borderColor: RGBA
  public customBorderChars: BorderCharacters
  public borderSides: BorderSidesConfig
  public shouldFill: boolean
  public title?: string
  public titleAlignment: "left" | "center" | "right"

  constructor(id: string, options: BoxOptions) {
    super(id, options)

    const bgRgb = parseColor(options.bg)
    const borderRgb = parseColor(options.borderColor || RGBA.fromValues(255, 255, 255, 255))

    this.width = options.width
    this.height = options.height
    this._bg = bgRgb
    this._border = options.border ?? true
    this._borderStyle = options.borderStyle || "single"
    this.borderColor = borderRgb
    this.customBorderChars = options.customBorderChars || BorderChars[this._borderStyle]
    this.borderSides = getBorderSides(this._border)
    this.shouldFill = options.shouldFill !== false
    this.title = options.title
    this.titleAlignment = options.titleAlignment || "left"
  }

  public get bg(): RGBA {
    return this._bg
  }

  public set bg(value: RGBA | string | undefined) {
    if (value) {
      this._bg = parseColor(value)
    }
  }

  public set border(value: boolean | BorderSides[]) {
    this._border = value
    this.borderSides = getBorderSides(value)
    this.needsUpdate = true
  }

  public set borderStyle(value: BorderStyle) {
    this._borderStyle = value
    this.customBorderChars = BorderChars[this._borderStyle]
    this.needsUpdate = true
  }

  protected renderSelf(buffer: OptimizedBuffer): void {
    if (
      this.x >= buffer.getWidth() ||
      this.y >= buffer.getHeight() ||
      this.x + this.width <= 0 ||
      this.y + this.height <= 0
    ) {
      return
    }

    const startX = Math.max(0, this.x)
    const startY = Math.max(0, this.y)
    const endX = Math.min(buffer.getWidth() - 1, this.x + this.width - 1)
    const endY = Math.min(buffer.getHeight() - 1, this.y + this.height - 1)

    if (this.shouldFill) {
      if (this.border === false) {
        buffer.fillRect(startX, startY, endX - startX + 1, endY - startY + 1, this._bg)
      } else {
        const innerStartX = startX + (this.borderSides.left ? 1 : 0)
        const innerStartY = startY + (this.borderSides.top ? 1 : 0)
        const innerEndX = endX - (this.borderSides.right ? 1 : 0)
        const innerEndY = endY - (this.borderSides.bottom ? 1 : 0)

        if (innerEndX >= innerStartX && innerEndY >= innerStartY) {
          buffer.fillRect(innerStartX, innerStartY, innerEndX - innerStartX + 1, innerEndY - innerStartY + 1, this._bg)
        }
      }
    }

    if (this.border !== false) {
      drawBorder(buffer, {
        x: this.x,
        y: this.y,
        width: this.width,
        height: this.height,
        borderStyle: this._borderStyle,
        border: this._border,
        borderColor: this.borderColor,
        backgroundColor: this._bg,
        customBorderChars: this.customBorderChars,
        title: this.title,
        titleAlignment: this.titleAlignment,
      })
    }
  }
}

export interface FrameBufferOptions {
  width: number
  height: number
  x: number
  y: number
  zIndex: number
  tabStopWidth?: number
  respectAlpha?: boolean
}

export class FrameBufferRenderable extends Renderable {
  public frameBuffer: OptimizedBuffer

  constructor(id: string, buffer: OptimizedBuffer, options: FrameBufferOptions) {
    super(id, options)
    this.frameBuffer = buffer
  }

  protected renderSelf(buffer: OptimizedBuffer): void {
    buffer.drawFrameBuffer(this.x, this.y, this.frameBuffer)
  }

  protected destroySelf(): void {
    this.frameBuffer.destroy()
  }
}

export class GroupRenderable extends Renderable {
  constructor(id: string, options: RenderableOptions) {
    super(id, options)
  }
}

export interface StyledTextOptions {
  fragment: Fragment
  width: number
  height: number
  x: number
  y: number
  zIndex: number
  defaultFg?: string | RGBA
  defaultBg?: string | RGBA
  visible?: boolean
}

export class StyledTextRenderable extends Renderable {
  public frameBuffer: OptimizedBuffer
  private _fragment: Fragment
  private _defaultFg: RGBA
  private _defaultBg: RGBA

  constructor(id: string, buffer: OptimizedBuffer, options: StyledTextOptions) {
    super(id, options)

    this.frameBuffer = buffer
    this._fragment = options.fragment
    this._defaultFg = options.defaultFg ? parseColor(options.defaultFg) : RGBA.fromValues(1, 1, 1, 1)
    this._defaultBg = options.defaultBg ? parseColor(options.defaultBg) : RGBA.fromValues(0, 0, 0, 0)

    this.renderFragmentToBuffer()
  }

  get fragment(): Fragment {
    return this._fragment
  }

  set fragment(value: Fragment) {
    this._fragment = value
    this.renderFragmentToBuffer()
    this.needsUpdate = true
  }

  get defaultFg(): RGBA {
    return this._defaultFg
  }

  set defaultFg(value: RGBA | string | undefined) {
    if (value) {
      this._defaultFg = parseColor(value)
      this.renderFragmentToBuffer()
      this.needsUpdate = true
    }
  }

  get defaultBg(): RGBA {
    return this._defaultBg
  }

  set defaultBg(value: RGBA | string | undefined) {
    if (value) {
      this._defaultBg = parseColor(value)
      this.renderFragmentToBuffer()
      this.needsUpdate = true
    }
  }

  private renderFragmentToBuffer(): void {
    this.frameBuffer.clear(this._defaultBg)
    this.frameBuffer.drawStyledTextFragment(this._fragment, 0, 0, this._defaultFg, this._defaultBg)
  }

  protected renderSelf(buffer: OptimizedBuffer): void {
    buffer.drawFrameBuffer(this.x, this.y, this.frameBuffer)
  }

  protected destroySelf(): void {
    this.frameBuffer.destroy()
  }
}
