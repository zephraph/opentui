import { dlopen, suffix, toArrayBuffer, type Pointer } from "bun:ffi"
import { join } from "path"
import { existsSync } from "fs"
import os from "os"
import type { CursorStyle, DebugOverlayCorner } from "./types"
import { RGBA } from "./types"
import { OptimizedBuffer } from "./buffer"

function getPlatformTarget(): string {
  const platform = os.platform()
  const arch = os.arch()

  const platformMap: Record<string, string> = {
    darwin: "macos",
    win32: "windows",
    linux: "linux",
  }

  const archMap: Record<string, string> = {
    x64: "x86_64",
    arm64: "aarch64",
  }

  const zigPlatform = platformMap[platform] || platform
  const zigArch = archMap[arch] || arch

  return `${zigArch}-${zigPlatform}`
}

function findLibrary(): string {
  const target = getPlatformTarget()
  const libDir = join(__dirname, "zig/lib")

  // First try target-specific directory
  const [arch, os] = target.split("-")
  const isWindows = os === "windows"
  const libraryName = isWindows ? "renderoo" : "librenderoo"
  const targetLibPath = join(libDir, target, `${libraryName}.${suffix}`)
  if (existsSync(targetLibPath)) {
    return targetLibPath
  }

  throw new Error(`Could not find renderoo library for platform: ${target}`)
}

function getRenderooLib(libPath?: string) {
  const resolvedLibPath = libPath || findLibrary()

  return dlopen(resolvedLibPath, {
    // Renderer management
    createRenderer: {
      args: ["u32", "u32"],
      returns: "ptr",
    },
    destroyRenderer: {
      args: ["ptr"],
      returns: "void",
    },
    setUseThread: {
      args: ["ptr", "bool"],
      returns: "void",
    },
    setBackgroundColor: {
      args: ["ptr", "ptr"],
      returns: "void",
    },
    updateStats: {
      args: ["ptr", "f64", "u32", "f64"],
      returns: "void",
    },
    updateMemoryStats: {
      args: ["ptr", "u32", "u32", "u32"],
      returns: "void",
    },
    render: {
      args: ["ptr"],
      returns: "void",
    },
    getNextBuffer: {
      args: ["ptr"],
      returns: "ptr",
    },
    getCurrentBuffer: {
      args: ["ptr"],
      returns: "ptr",
    },

    createOptimizedBuffer: {
      args: ["u32", "u32", "u8", "bool"],
      returns: "ptr",
    },
    destroyOptimizedBuffer: {
      args: ["ptr"],
      returns: "void",
    },

    drawFrameBuffer: {
      args: ["ptr", "i32", "i32", "ptr", "u32", "u32", "u32", "u32"],
      returns: "void",
    },
    getBufferWidth: {
      args: ["ptr"],
      returns: "u32",
    },
    getBufferHeight: {
      args: ["ptr"],
      returns: "u32",
    },
    getBufferTabStopWidth: {
      args: ["ptr"],
      returns: "u32",
    },
    bufferClear: {
      args: ["ptr", "ptr"],
      returns: "void",
    },
    bufferGetCharPtr: {
      args: ["ptr"],
      returns: "ptr",
    },
    bufferGetFgPtr: {
      args: ["ptr"],
      returns: "ptr",
    },
    bufferGetBgPtr: {
      args: ["ptr"],
      returns: "ptr",
    },
    bufferGetAttributesPtr: {
      args: ["ptr"],
      returns: "ptr",
    },
    bufferGetRespectAlpha: {
      args: ["ptr"],
      returns: "bool",
    },
    bufferSetRespectAlpha: {
      args: ["ptr", "bool"],
      returns: "void",
    },

    bufferDrawText: {
      args: ["ptr", "ptr", "u32", "u32", "u32", "ptr", "ptr", "u8"],
      returns: "void",
    },
    bufferSetCellWithAlphaBlending: {
      args: ["ptr", "u32", "u32", "u32", "ptr", "ptr", "u8"],
      returns: "void",
    },
    bufferFillRect: {
      args: ["ptr", "u32", "u32", "u32", "u32", "ptr"],
      returns: "void",
    },
    bufferResize: {
      args: ["ptr", "u32", "u32"],
      returns: "void",
    },

    resizeRenderer: {
      args: ["ptr", "u32", "u32"],
      returns: "void",
    },

    // Cursor and rendering control
    setCursorPosition: {
      args: ["ptr", "i32", "i32", "bool"],
      returns: "void",
    },
    setCursorStyle: {
      args: ["ptr", "ptr", "u32", "bool"],
      returns: "void",
    },
    setCursorColor: {
      args: ["ptr", "ptr"],
      returns: "void",
    },

    // Debug overlay
    setDebugOverlay: {
      args: ["ptr", "bool", "u8"],
      returns: "void",
    },

    // Terminal control
    clearTerminal: {
      args: ["ptr"],
      returns: "void",
    },

    bufferDrawSuperSampleBuffer: {
      args: ["ptr", "u32", "u32", "ptr", "usize", "u8", "u32"],
      returns: "void",
    },
    bufferDrawPackedBuffer: {
      args: ["ptr", "ptr", "usize", "u32", "u32", "u32", "u32"],
      returns: "void",
    },
  })
}

export interface RenderLib {
  createRenderer: (width: number, height: number) => Pointer | null
  destroyRenderer: (renderer: Pointer) => void
  setUseThread: (renderer: Pointer, useThread: boolean) => void
  setBackgroundColor: (renderer: Pointer, color: RGBA) => void
  updateStats: (renderer: Pointer, time: number, fps: number, frameCallbackTime: number) => void
  updateMemoryStats: (renderer: Pointer, heapUsed: number, heapTotal: number, arrayBuffers: number) => void
  render: (renderer: Pointer) => void
  getNextBuffer: (renderer: Pointer) => OptimizedBuffer
  getCurrentBuffer: (renderer: Pointer) => OptimizedBuffer
  createOptimizedBuffer: (
    width: number,
    height: number,
    tabStopWidth: number,
    respectAlpha?: boolean,
  ) => OptimizedBuffer
  destroyOptimizedBuffer: (bufferPtr: Pointer) => void
  drawFrameBuffer: (
    targetBufferPtr: Pointer,
    destX: number,
    destY: number,
    bufferPtr: Pointer,
    sourceX?: number,
    sourceY?: number,
    sourceWidth?: number,
    sourceHeight?: number,
  ) => void
  getBufferWidth: (buffer: Pointer) => number
  getBufferHeight: (buffer: Pointer) => number
  getBufferTabStopWidth: (buffer: Pointer) => number
  bufferClear: (buffer: Pointer, color: RGBA) => void
  bufferGetCharPtr: (buffer: Pointer) => Pointer
  bufferGetFgPtr: (buffer: Pointer) => Pointer
  bufferGetBgPtr: (buffer: Pointer) => Pointer
  bufferGetAttributesPtr: (buffer: Pointer) => Pointer
  bufferGetRespectAlpha: (buffer: Pointer) => boolean
  bufferSetRespectAlpha: (buffer: Pointer, respectAlpha: boolean) => void
  bufferDrawText: (
    buffer: Pointer,
    text: string,
    x: number,
    y: number,
    color: RGBA,
    bgColor?: RGBA,
    attributes?: number,
  ) => void
  bufferSetCellWithAlphaBlending: (
    buffer: Pointer,
    x: number,
    y: number,
    char: string,
    color: RGBA,
    bgColor: RGBA,
    attributes?: number,
  ) => void
  bufferFillRect: (buffer: Pointer, x: number, y: number, width: number, height: number, color: RGBA) => void
  bufferDrawSuperSampleBuffer: (
    buffer: Pointer,
    x: number,
    y: number,
    pixelDataPtr: Pointer,
    pixelDataLength: number,
    format: "bgra8unorm" | "rgba8unorm",
    alignedBytesPerRow: number,
  ) => void
  bufferDrawPackedBuffer: (
    buffer: Pointer,
    dataPtr: Pointer,
    dataLen: number,
    posX: number,
    posY: number,
    terminalWidthCells: number,
    terminalHeightCells: number,
  ) => void
  bufferResize: (
    buffer: Pointer,
    width: number,
    height: number,
  ) => {
    char: Uint32Array
    fg: Float32Array
    bg: Float32Array
    attributes: Uint8Array
  }
  resizeRenderer: (renderer: Pointer, width: number, height: number) => void
  setCursorPosition: (renderer: Pointer, x: number, y: number, visible: boolean) => void
  setCursorStyle: (renderer: Pointer, style: CursorStyle, blinking: boolean) => void
  setCursorColor: (renderer: Pointer, color: RGBA) => void
  setCursorColorF?: (renderer: Pointer, r: number, g: number, b: number) => void
  setDebugOverlay: (renderer: Pointer, enabled: boolean, corner: DebugOverlayCorner) => void
  clearTerminal: (renderer: Pointer) => void
}

class FFIRenderLib implements RenderLib {
  private renderoo: ReturnType<typeof getRenderooLib>
  private encoder: TextEncoder = new TextEncoder()

  constructor(libPath?: string) {
    this.renderoo = getRenderooLib(libPath)
  }

  public createRenderer(width: number, height: number) {
    return this.renderoo.symbols.createRenderer(width, height)
  }

  public destroyRenderer(renderer: Pointer) {
    this.renderoo.symbols.destroyRenderer(renderer)
  }

  public setUseThread(renderer: Pointer, useThread: boolean) {
    this.renderoo.symbols.setUseThread(renderer, useThread)
  }

  public setBackgroundColor(renderer: Pointer, color: RGBA) {
    this.renderoo.symbols.setBackgroundColor(renderer, color.buffer)
  }

  public updateStats(renderer: Pointer, time: number, fps: number, frameCallbackTime: number) {
    this.renderoo.symbols.updateStats(renderer, time, fps, frameCallbackTime)
  }

  public updateMemoryStats(renderer: Pointer, heapUsed: number, heapTotal: number, arrayBuffers: number) {
    this.renderoo.symbols.updateMemoryStats(renderer, heapUsed, heapTotal, arrayBuffers)
  }

  public getNextBuffer(renderer: Pointer): OptimizedBuffer {
    const bufferPtr = this.renderoo.symbols.getNextBuffer(renderer)
    if (!bufferPtr) {
      throw new Error("Failed to get next buffer")
    }

    const width = this.renderoo.symbols.getBufferWidth(bufferPtr)
    const height = this.renderoo.symbols.getBufferHeight(bufferPtr)
    const size = width * height
    const tabStopWidth = this.renderoo.symbols.getBufferTabStopWidth(bufferPtr)
    const buffers = this.getBuffer(bufferPtr, size)

    return new OptimizedBuffer(this, bufferPtr, buffers, width, height, { tabStopWidth })
  }

  public getCurrentBuffer(renderer: Pointer): OptimizedBuffer {
    const bufferPtr = this.renderoo.symbols.getCurrentBuffer(renderer)
    if (!bufferPtr) {
      throw new Error("Failed to get current buffer")
    }

    const width = this.renderoo.symbols.getBufferWidth(bufferPtr)
    const height = this.renderoo.symbols.getBufferHeight(bufferPtr)
    const size = width * height
    const tabStopWidth = this.renderoo.symbols.getBufferTabStopWidth(bufferPtr)
    const buffers = this.getBuffer(bufferPtr, size)

    return new OptimizedBuffer(this, bufferPtr, buffers, width, height, { tabStopWidth })
  }

  private getBuffer(
    bufferPtr: Pointer,
    size: number,
  ): {
    char: Uint32Array
    fg: Float32Array
    bg: Float32Array
    attributes: Uint8Array
  } {
    const charPtr = this.renderoo.symbols.bufferGetCharPtr(bufferPtr)
    const fgPtr = this.renderoo.symbols.bufferGetFgPtr(bufferPtr)
    const bgPtr = this.renderoo.symbols.bufferGetBgPtr(bufferPtr)
    const attributesPtr = this.renderoo.symbols.bufferGetAttributesPtr(bufferPtr)

    if (!charPtr || !fgPtr || !bgPtr || !attributesPtr) {
      throw new Error("Failed to get buffer pointers")
    }

    const buffers = {
      char: new Uint32Array(toArrayBuffer(charPtr, 0, size * 4)),
      fg: new Float32Array(toArrayBuffer(fgPtr, 0, size * 4 * 4)), // 4 floats per RGBA
      bg: new Float32Array(toArrayBuffer(bgPtr, 0, size * 4 * 4)), // 4 floats per RGBA
      attributes: new Uint8Array(toArrayBuffer(attributesPtr, 0, size)),
    }

    return buffers
  }

  public bufferGetCharPtr(buffer: Pointer): Pointer {
    const ptr = this.renderoo.symbols.bufferGetCharPtr(buffer)
    if (!ptr) {
      throw new Error("Failed to get char pointer")
    }
    return ptr
  }

  public bufferGetFgPtr(buffer: Pointer): Pointer {
    const ptr = this.renderoo.symbols.bufferGetFgPtr(buffer)
    if (!ptr) {
      throw new Error("Failed to get fg pointer")
    }
    return ptr
  }

  public bufferGetBgPtr(buffer: Pointer): Pointer {
    const ptr = this.renderoo.symbols.bufferGetBgPtr(buffer)
    if (!ptr) {
      throw new Error("Failed to get bg pointer")
    }
    return ptr
  }

  public bufferGetAttributesPtr(buffer: Pointer): Pointer {
    const ptr = this.renderoo.symbols.bufferGetAttributesPtr(buffer)
    if (!ptr) {
      throw new Error("Failed to get attributes pointer")
    }
    return ptr
  }

  public bufferGetRespectAlpha(buffer: Pointer): boolean {
    return this.renderoo.symbols.bufferGetRespectAlpha(buffer)
  }

  public bufferSetRespectAlpha(buffer: Pointer, respectAlpha: boolean): void {
    this.renderoo.symbols.bufferSetRespectAlpha(buffer, respectAlpha)
  }

  public getBufferWidth(buffer: Pointer): number {
    return this.renderoo.symbols.getBufferWidth(buffer)
  }

  public getBufferHeight(buffer: Pointer): number {
    return this.renderoo.symbols.getBufferHeight(buffer)
  }

  public getBufferTabStopWidth(buffer: Pointer): number {
    return this.renderoo.symbols.getBufferTabStopWidth(buffer)
  }

  public bufferClear(buffer: Pointer, color: RGBA) {
    this.renderoo.symbols.bufferClear(buffer, color.buffer)
  }

  public bufferDrawText(
    buffer: Pointer,
    text: string,
    x: number,
    y: number,
    color: RGBA,
    bgColor?: RGBA,
    attributes?: number,
  ) {
    const textBytes = this.encoder.encode(text)
    const textLength = textBytes.byteLength
    const bg = bgColor ? bgColor.buffer : null
    const fg = color.buffer

    this.renderoo.symbols.bufferDrawText(buffer, textBytes, textLength, x, y, fg, bg, attributes ?? 0)
  }

  public bufferSetCellWithAlphaBlending(
    buffer: Pointer,
    x: number,
    y: number,
    char: string,
    color: RGBA,
    bgColor: RGBA,
    attributes?: number,
  ) {
    const charPtr = char.codePointAt(0) ?? " ".codePointAt(0)!
    const bg = bgColor.buffer
    const fg = color.buffer

    this.renderoo.symbols.bufferSetCellWithAlphaBlending(buffer, x, y, charPtr, fg, bg, attributes ?? 0)
  }

  public bufferFillRect(buffer: Pointer, x: number, y: number, width: number, height: number, color: RGBA) {
    const bg = color.buffer
    this.renderoo.symbols.bufferFillRect(buffer, x, y, width, height, bg)
  }

  public bufferDrawSuperSampleBuffer(
    buffer: Pointer,
    x: number,
    y: number,
    pixelDataPtr: Pointer,
    pixelDataLength: number,
    format: "bgra8unorm" | "rgba8unorm",
    alignedBytesPerRow: number,
  ): void {
    const formatId = format === "bgra8unorm" ? 0 : 1
    this.renderoo.symbols.bufferDrawSuperSampleBuffer(
      buffer,
      x,
      y,
      pixelDataPtr,
      pixelDataLength,
      formatId,
      alignedBytesPerRow,
    )
  }

  public bufferDrawPackedBuffer(
    buffer: Pointer,
    dataPtr: Pointer,
    dataLen: number,
    posX: number,
    posY: number,
    terminalWidthCells: number,
    terminalHeightCells: number,
  ): void {
    this.renderoo.symbols.bufferDrawPackedBuffer(
      buffer,
      dataPtr,
      dataLen,
      posX,
      posY,
      terminalWidthCells,
      terminalHeightCells,
    )
  }

  public bufferResize(
    buffer: Pointer,
    width: number,
    height: number,
  ): {
    char: Uint32Array
    fg: Float32Array
    bg: Float32Array
    attributes: Uint8Array
  } {
    this.renderoo.symbols.bufferResize(buffer, width, height)
    const buffers = this.getBuffer(buffer, width * height)
    return buffers
  }

  public resizeRenderer(renderer: Pointer, width: number, height: number) {
    this.renderoo.symbols.resizeRenderer(renderer, width, height)
  }

  public setCursorPosition(renderer: Pointer, x: number, y: number, visible: boolean) {
    this.renderoo.symbols.setCursorPosition(renderer, x, y, visible)
  }

  public setCursorStyle(renderer: Pointer, style: CursorStyle, blinking: boolean) {
    const stylePtr = this.encoder.encode(style)
    this.renderoo.symbols.setCursorStyle(renderer, stylePtr, style.length, blinking)
  }

  public setCursorColor(renderer: Pointer, color: RGBA) {
    this.renderoo.symbols.setCursorColor(renderer, color.buffer)
  }

  public render(renderer: Pointer) {
    this.renderoo.symbols.render(renderer)
  }

  public createOptimizedBuffer(
    width: number,
    height: number,
    tabStopWidth: number,
    respectAlpha: boolean = false,
  ): OptimizedBuffer {
    const bufferPtr = this.renderoo.symbols.createOptimizedBuffer(width, height, tabStopWidth, respectAlpha)
    if (!bufferPtr) {
      throw new Error("Failed to create optimized buffer")
    }
    const size = width * height
    const buffers = this.getBuffer(bufferPtr, size)

    return new OptimizedBuffer(this, bufferPtr, buffers, width, height, { tabStopWidth, respectAlpha })
  }

  public destroyOptimizedBuffer(bufferPtr: Pointer) {
    this.renderoo.symbols.destroyOptimizedBuffer(bufferPtr)
  }

  public drawFrameBuffer(
    targetBufferPtr: Pointer,
    destX: number,
    destY: number,
    bufferPtr: Pointer,
    sourceX?: number,
    sourceY?: number,
    sourceWidth?: number,
    sourceHeight?: number,
  ) {
    const srcX = sourceX ?? 0
    const srcY = sourceY ?? 0
    const srcWidth = sourceWidth ?? 0
    const srcHeight = sourceHeight ?? 0
    this.renderoo.symbols.drawFrameBuffer(targetBufferPtr, destX, destY, bufferPtr, srcX, srcY, srcWidth, srcHeight)
  }

  public setDebugOverlay(renderer: Pointer, enabled: boolean, corner: DebugOverlayCorner) {
    this.renderoo.symbols.setDebugOverlay(renderer, enabled, corner)
  }

  public clearTerminal(renderer: Pointer) {
    this.renderoo.symbols.clearTerminal(renderer)
  }
}

let renderooLibPath: string | undefined
let renderooLib: RenderLib | undefined

export function setRenderLibPath(libPath: string) {
  renderooLibPath = libPath
}

export function resolveRenderLib(): RenderLib {
  if (!renderooLib) {
    renderooLib = new FFIRenderLib(renderooLibPath)
  }
  return renderooLib
}
