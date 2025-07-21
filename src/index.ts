import { ANSI } from "./ansi"
import { FrameBufferRenderable, StyledTextRenderable, type FrameBufferOptions, type StyledTextOptions } from "./objects"
import { Renderable } from "./Renderable"
import { type ColorInput, type CursorStyle, DebugOverlayCorner, RGBA } from "./types"
import { parseColor } from "./utils"
import type { Pointer } from "bun:ffi"
import { OptimizedBuffer } from "./buffer"
import { resolveRenderLib, type RenderLib } from "./zig"
import { TerminalConsole, type ConsoleOptions } from "./console"

export * from "./objects"
export * from "./Renderable"
export * from "./types"
export * from "./utils"
export * from "./buffer"
export * from "./3d"
export * as THREE from "three"
export * from "./post/filters"
export * from "./animation/Timeline"
export * from "./ui"
export * from "./parse.keypress"
export * from "./styled-text"

export interface CliRendererConfig {
  stdin?: NodeJS.ReadStream
  stdout?: NodeJS.WriteStream
  exitOnCtrlC?: boolean
  debounceDelay?: number
  targetFps?: number
  memorySnapshotInterval?: number
  useThread?: boolean
  gatherStats?: boolean
  maxStatSamples?: number
  consoleOptions?: ConsoleOptions
  resolution?: PixelResolution | null
  postProcessFns?: ((buffer: OptimizedBuffer, deltaTime: number) => void)[]
  parseKeys?: boolean
}

export type PixelResolution = {
  width: number
  height: number
}

async function getTerminalPixelResolution(
  stdin: NodeJS.ReadStream,
  stdout: NodeJS.WriteStream,
): Promise<PixelResolution | null> {
  return new Promise<PixelResolution | null>((resolve) => {
    stdin.setRawMode(true)
    const timeout = setTimeout(() => {
      resolve(null)
    }, 100)
    stdin.once("data", (data) => {
      clearTimeout(timeout)
      const str = data.toString()
      if (/\x1b\[4/.test(str)) {
        // <ESC>[4;<height>;<width>t
        const [, height, width] = str.split(";")
        const resolution: PixelResolution = {
          width: parseInt(width),
          height: parseInt(height),
        }
        resolve(resolution)
      }
    })
    stdout.write("\u001b[14t")
  })
}

export async function createCliRenderer(config: CliRendererConfig = {}): Promise<CliRenderer> {
  if (process.argv.includes("--delay-start")) {
    await new Promise((resolve) => setTimeout(resolve, 5000))
  }
  const stdin = config.stdin || process.stdin
  const stdout = config.stdout || process.stdout

  // Get terminal dimensions
  const width = stdout.columns || 80
  const height = stdout.rows || 24
  const ziglib = resolveRenderLib()
  const rendererPtr = ziglib.createRenderer(width, height)
  if (!rendererPtr) {
    throw new Error("Failed to create renderer")
  }
  if (config.useThread === undefined) {
    config.useThread = true
  }

  const resolution = await getTerminalPixelResolution(stdin, stdout)

  // Disable threading on linux because there currently is a bug in the zig std lib
  // that causes the renderer to crash when trying to start the thread
  if (process.platform === "linux") {
    config.useThread = false
  }
  ziglib.setUseThread(rendererPtr, config.useThread)

  return new CliRenderer(ziglib, rendererPtr, stdin, stdout, width, height, {
    ...config,
    resolution,
  })
}

export enum CliRenderEvents {
  DEBUG_OVERLAY_TOGGLE = "debugOverlay:toggle",
}

let animationFrameId = 0

export class CliRenderer extends Renderable {
  private lib: RenderLib
  public rendererPtr: Pointer
  private width: number
  private height: number
  private stdin: NodeJS.ReadStream
  private stdout: NodeJS.WriteStream
  private exitOnCtrlC: boolean
  public nextRenderBuffer: OptimizedBuffer
  private currentRenderBuffer: OptimizedBuffer
  private _isRunning: boolean = false
  private targetFps: number = 30
  private memorySnapshotInterval: number
  private memorySnapshotTimer: Timer | null = null
  private lastMemorySnapshot: { heapUsed: number; heapTotal: number; arrayBuffers: number } = {
    heapUsed: 0,
    heapTotal: 0,
    arrayBuffers: 0,
  }
  private _useThread: boolean = false
  private gatherStats: boolean = false
  private frameTimes: number[] = []
  private maxStatSamples: number = 300
  private postProcessFns: ((buffer: OptimizedBuffer, deltaTime: number) => void)[] = []

  private rendering: boolean = false
  private renderingNative: boolean = false
  private renderTimeout: Timer | null = null
  private _totalFramesRendered: number = 0
  private lastTime: number = 0
  private frameCount: number = 0
  private lastFpsTime: number = 0
  private currentFps: number = 0
  private targetFrameTime: number = 0
  private immediateRerenderRequested: boolean = false
  private updateScheduled: boolean = false

  private frameCallbacks: ((deltaTime: number) => Promise<void>)[] = []
  private renderStats: {
    frameCount: number
    fps: number
    renderTime?: number
    frameCallbackTime: number
  } = {
    frameCount: 0,
    fps: 0,
    renderTime: 0,
    frameCallbackTime: 0,
  }
  public debugOverlay = {
    enabled: false,
    corner: DebugOverlayCorner.bottomRight,
  }

  private _console: TerminalConsole
  private _resolution: PixelResolution | null = null

  private animationRequest: Map<number, FrameRequestCallback> = new Map()

  private resizeTimeoutId: ReturnType<typeof setTimeout> | null = null
  private resizeDebounceDelay: number = 100 // 100ms debounce delay

  constructor(
    lib: RenderLib,
    rendererPtr: Pointer,
    stdin: NodeJS.ReadStream,
    stdout: NodeJS.WriteStream,
    width: number,
    height: number,
    config: CliRendererConfig = {},
  ) {
    super("__cli_renderer__", { x: 0, y: 0, zIndex: 0, visible: true })

    this.stdin = stdin
    this.stdout = stdout
    this.lib = lib
    this.width = width
    this.height = height
    this._useThread = config.useThread === undefined ? false : config.useThread
    this._resolution = config.resolution || null

    this.rendererPtr = rendererPtr
    this.exitOnCtrlC = config.exitOnCtrlC === undefined ? true : config.exitOnCtrlC
    this.resizeDebounceDelay = config.debounceDelay || 100
    this.targetFps = config.targetFps || 30
    this.memorySnapshotInterval = config.memorySnapshotInterval || 5000
    this.gatherStats = config.gatherStats || false
    this.maxStatSamples = config.maxStatSamples || 300
    this.nextRenderBuffer = this.lib.getNextBuffer(this.rendererPtr)
    this.currentRenderBuffer = this.lib.getCurrentBuffer(this.rendererPtr)
    this.postProcessFns = config.postProcessFns || []

    this.setupTerminal()
    this.takeMemorySnapshot()

    if (this.memorySnapshotInterval > 0) {
      this.startMemorySnapshotTimer()
    }

    // Handle terminal resize
    process.on("SIGWINCH", () => {
      const width = this.stdout.columns || 80
      const height = this.stdout.rows || 24
      this.handleResize(width, height)
    })

    const handleError = (error: Error) => {
      this.console.deactivate()
      this.stop()
      new Promise((resolve) => {
        setTimeout(() => {
          resolve(true)
        }, 100)
      }).then(() => {
        console.log("console cache dump:")
        this.console.dumpCache()
        console.error(error)
        process.exit(1)
      })
    }

    process.on("uncaughtException", handleError)
    process.on("unhandledRejection", handleError)
    process.on("exit", (code: number) => {
      if (!code || code === 0) {
        this.stop()
      }
    })

    this._console = new TerminalConsole(this, config.consoleOptions)

    global.requestAnimationFrame = (callback: FrameRequestCallback) => {
      const id = animationFrameId++
      this.animationRequest.set(id, callback)
      return id
    }
    global.cancelAnimationFrame = (handle: number) => {
      this.animationRequest.delete(handle)
    }

    const window = global.window
    if (!window) {
      global.window = {} as Window & typeof globalThis
    }
    global.window.requestAnimationFrame = requestAnimationFrame
  }

  public get totalFramesRendered(): number {
    return this._totalFramesRendered
  }

  public set needsUpdate(value: boolean) {
    if (!this.updateScheduled && !this._isRunning && value) {
      this.updateScheduled = true
      process.nextTick(() => {
        this.renderOnce()
        this.updateScheduled = false
      })
    }
  }

  public get isRunning(): boolean {
    return this._isRunning
  }

  public get resolution(): PixelResolution | null {
    return this._resolution
  }

  public get console(): TerminalConsole {
    return this._console
  }

  public get terminalWidth(): number {
    return this.width
  }

  public get terminalHeight(): number {
    return this.height
  }

  public get useThread(): boolean {
    return this._useThread
  }

  public set useThread(useThread: boolean) {
    this._useThread = useThread
    this.lib.setUseThread(this.rendererPtr, useThread)
  }

  public setTerminalSize(width: number, height: number): void {
    this.handleResize(width, height)
  }

  private setupTerminal(): void {
    this.stdout.write(ANSI.saveCursorState)
    if (this.exitOnCtrlC) {
      this.stdin.setRawMode(true)
      this.stdin.resume()
      this.stdin.setEncoding("utf8")
    }

    if (this.exitOnCtrlC) {
      this.stdin.on("data", (key: Buffer) => {
        if (key.toString() === "\u0003") {
          this.stop()
          process.nextTick(() => {
            process.exit(0)
          })
        }
      })
    }

    this.stdout.write(ANSI.switchToAlternateScreen)
    this.setCursorPosition(0, 0, false)
  }

  private takeMemorySnapshot(): void {
    const memoryUsage = process.memoryUsage()
    this.lastMemorySnapshot = {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      arrayBuffers: memoryUsage.arrayBuffers,
    }

    this.lib.updateMemoryStats(
      this.rendererPtr,
      this.lastMemorySnapshot.heapUsed,
      this.lastMemorySnapshot.heapTotal,
      this.lastMemorySnapshot.arrayBuffers,
    )

    this.emit("memory:snapshot", this.lastMemorySnapshot)
  }

  private startMemorySnapshotTimer(): void {
    if (this.memorySnapshotTimer) {
      clearInterval(this.memorySnapshotTimer)
    }

    this.memorySnapshotTimer = setInterval(() => {
      this.takeMemorySnapshot()
    }, this.memorySnapshotInterval)
  }

  public setMemorySnapshotInterval(interval: number): void {
    this.memorySnapshotInterval = interval

    if (this._isRunning && interval > 0) {
      this.startMemorySnapshotTimer()
    } else if (interval <= 0 && this.memorySnapshotTimer) {
      clearInterval(this.memorySnapshotTimer)
      this.memorySnapshotTimer = null
    }
  }

  private handleResize(width: number, height: number): void {
    if (this.resizeTimeoutId !== null) {
      clearTimeout(this.resizeTimeoutId)
      this.resizeTimeoutId = null
    }

    this.resizeTimeoutId = setTimeout(() => {
      this.resizeTimeoutId = null
      this.processResize(width, height)
    }, this.resizeDebounceDelay)
  }

  private async processResize(width: number, height: number): Promise<void> {
    if (width === this.width && height === this.height) return

    this.width = width
    this.height = height
    this._resolution = await getTerminalPixelResolution(this.stdin, this.stdout)
    this.lib.resizeRenderer(this.rendererPtr, this.width, this.height)
    this.nextRenderBuffer = this.lib.getNextBuffer(this.rendererPtr)
    this.currentRenderBuffer = this.lib.getCurrentBuffer(this.rendererPtr)
    this._console.resize(width, height)
    this.emit("resize", width, height)
    this.renderOnce()
  }

  public setBackgroundColor(color: ColorInput): void {
    const parsedColor = parseColor(color)
    this.lib.setBackgroundColor(this.rendererPtr, parsedColor as RGBA)
  }

  public toggleDebugOverlay(): void {
    this.debugOverlay.enabled = !this.debugOverlay.enabled
    this.lib.setDebugOverlay(this.rendererPtr, this.debugOverlay.enabled, this.debugOverlay.corner)
    this.emit(CliRenderEvents.DEBUG_OVERLAY_TOGGLE, this.debugOverlay.enabled)
    if (!this._isRunning) {
      this.renderOnce()
    }
  }

  public configureDebugOverlay(options: { enabled?: boolean; corner?: DebugOverlayCorner }): void {
    this.debugOverlay.enabled = options.enabled ?? this.debugOverlay.enabled
    this.debugOverlay.corner = options.corner ?? this.debugOverlay.corner
    this.lib.setDebugOverlay(this.rendererPtr, this.debugOverlay.enabled, this.debugOverlay.corner)
  }

  public clearTerminal(): void {
    this.lib.clearTerminal(this.rendererPtr)
  }

  public createFrameBuffer(id: string, options: Partial<FrameBufferOptions>) {
    if (this.getRenderable(id)) {
      this.remove(id)
    }
    const width = options.width ?? this.width
    const height = options.height ?? this.height
    const buffer = this.lib.createOptimizedBuffer(width, height, options.tabStopWidth ?? 2, options.respectAlpha)
    const fbObj = new FrameBufferRenderable(id, buffer, {
      ...options,
      x: options.x ?? 0,
      y: options.y ?? 0,
      width,
      height,
      zIndex: options.zIndex ?? 1,
    })
    this.add(fbObj)
    return fbObj
  }

  public createStyledText(id: string, options: StyledTextOptions): StyledTextRenderable {
    if (!options.fragment) {
      throw new Error("StyledText requires a fragment")
    }

    const width = options.width ?? this.width
    const height = options.height ?? this.height
    const buffer = this.lib.createOptimizedBuffer(width, height, 2, true)
    const stObj = new StyledTextRenderable(id, buffer, {
      ...options,
      x: options.x ?? 0,
      y: options.y ?? 0,
      width,
      height,
      zIndex: options.zIndex ?? 1,
    })

    return stObj
  }

  public setCursorPosition(x: number, y: number, visible: boolean = true): void {
    this.lib.setCursorPosition(this.rendererPtr, x, y, visible)
  }

  public setCursorStyle(style: CursorStyle, blinking: boolean = false, color?: RGBA): void {
    this.lib.setCursorStyle(this.rendererPtr, style, blinking)
    if (color) {
      this.lib.setCursorColor(this.rendererPtr, color)
    }
  }

  public addPostProcessFn(processFn: (buffer: OptimizedBuffer, deltaTime: number) => void): void {
    this.postProcessFns.push(processFn)
  }

  public removePostProcessFn(processFn: (buffer: OptimizedBuffer, deltaTime: number) => void): void {
    this.postProcessFns = this.postProcessFns.filter((fn) => fn !== processFn)
  }

  public clearPostProcessFns(): void {
    this.postProcessFns = []
  }

  public setFrameCallback(callback: (deltaTime: number) => Promise<void>): void {
    this.frameCallbacks.push(callback)
  }

  public removeFrameCallback(callback: (deltaTime: number) => Promise<void>): void {
    this.frameCallbacks = this.frameCallbacks.filter((cb) => cb !== callback)
  }

  public clearFrameCallbacks(): void {
    this.frameCallbacks = []
  }

  public start(): void {
    if (!this._isRunning) {
      this._isRunning = true

      if (this.memorySnapshotInterval > 0) {
        this.startMemorySnapshotTimer()
      }

      this.startRenderLoop()
    }
  }

  public pause(): void {
    this._isRunning = false
  }

  public stop(): void {
    this._isRunning = false
    this._console.deactivate()

    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout)
      this.renderTimeout = null
    }

    if (this.memorySnapshotTimer) {
      clearInterval(this.memorySnapshotTimer)
      this.memorySnapshotTimer = null
    }

    this.stdout.write(ANSI.switchToMainScreen)
  }

  public async renderOnce(): Promise<void> {
    this.loop()
  }

  private startRenderLoop(): void {
    if (!this._isRunning) return

    this.lastTime = Date.now()
    this.frameCount = 0
    this.lastFpsTime = this.lastTime
    this.currentFps = 0
    this.targetFrameTime = 1000 / this.targetFps

    this.loop()
  }

  private async loop(): Promise<void> {
    if (this.rendering) return
    this.rendering = true
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout)
      this.renderTimeout = null
    }

    const now = Date.now()
    const elapsed = now - this.lastTime

    const deltaTime = elapsed
    this.lastTime = now

    this._totalFramesRendered++
    this.frameCount++
    if (now - this.lastFpsTime >= 1000) {
      this.currentFps = this.frameCount
      this.frameCount = 0
      this.lastFpsTime = now
    }

    this.renderStats.frameCount++
    this.renderStats.fps = this.currentFps
    const overallStart = performance.now()

    const frameRequests = this.animationRequest.values()
    this.animationRequest.clear()
    const animationRequestStart = performance.now()
    frameRequests.forEach((callback) => callback(deltaTime))
    const animationRequestEnd = performance.now()
    const animationRequestTime = animationRequestEnd - animationRequestStart

    const start = performance.now()
    for (const frameCallback of this.frameCallbacks) {
      try {
        await frameCallback(deltaTime)
      } catch (error) {
        console.error("Error in frame callback:", error)
      }
    }
    const end = performance.now()
    this.renderStats.frameCallbackTime = end - start

    this.render(this.nextRenderBuffer)

    for (const postProcessFn of this.postProcessFns) {
      postProcessFn(this.nextRenderBuffer, deltaTime)
    }

    this._console.renderToBuffer(this.nextRenderBuffer)

    this.renderNative()

    const overallFrameTime = performance.now() - overallStart
    // TODO: Add animationRequestTime to stats
    this.lib.updateStats(this.rendererPtr, overallFrameTime, this.renderStats.fps, this.renderStats.frameCallbackTime)

    if (this.gatherStats) {
      this.collectStatSample(overallFrameTime)
    }

    if (this._isRunning) {
      const delay = Math.max(1, this.targetFrameTime - Math.floor(overallFrameTime))
      this.renderTimeout = setTimeout(() => this.loop(), delay)
    }
    this.rendering = false
    if (this.immediateRerenderRequested) {
      this.immediateRerenderRequested = false
      this.loop()
    }
  }

  public intermediateRender(): void {
    if (!this._isRunning) return
    this.immediateRerenderRequested = true
    this.loop()
  }

  private renderNative(): void {
    if (this.renderingNative) {
      console.error("Rendering called concurrently")
      throw new Error("Rendering called concurrently")
    }
    this.renderingNative = true
    this.lib.render(this.rendererPtr)
    this.renderingNative = false
  }

  private collectStatSample(frameTime: number): void {
    this.frameTimes.push(frameTime)
    if (this.frameTimes.length > this.maxStatSamples) {
      this.frameTimes.shift()
    }
  }

  public getStats(): {
    fps: number
    frameCount: number
    frameTimes: number[]
    averageFrameTime: number
    minFrameTime: number
    maxFrameTime: number
  } {
    const frameTimes = [...this.frameTimes]
    const sum = frameTimes.reduce((acc, time) => acc + time, 0)
    const avg = frameTimes.length ? sum / frameTimes.length : 0
    const min = frameTimes.length ? Math.min(...frameTimes) : 0
    const max = frameTimes.length ? Math.max(...frameTimes) : 0

    return {
      fps: this.renderStats.fps,
      frameCount: this.renderStats.frameCount,
      frameTimes,
      averageFrameTime: avg,
      minFrameTime: min,
      maxFrameTime: max,
    }
  }

  public resetStats(): void {
    this.frameTimes = []
    this.renderStats.frameCount = 0
  }

  public setGatherStats(enabled: boolean): void {
    this.gatherStats = enabled
    if (!enabled) {
      this.frameTimes = []
    }
  }
}
