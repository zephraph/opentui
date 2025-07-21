import { BufferedElement, type ElementOptions } from "../element"
import { parseColor } from "../../utils"
import type { RGBA, ColorInput } from "../../types"
import type { ParsedKey } from "../../parse.keypress"

export interface InputElementOptions extends ElementOptions {
  placeholder?: string
  placeholderColor?: ColorInput
  cursorColor?: ColorInput
  maxLength?: number
  value?: string
}

export enum InputElementEvents {
  INPUT = "input",
  CHANGE = "change",
  FOCUSED = "focused",
  BLURRED = "blurred",
  ENTER = "enter",
}

export class InputElement extends BufferedElement {
  private value: string = ""
  private cursorPosition: number = 0
  private placeholder: string
  private placeholderColor: RGBA
  private cursorColor: RGBA
  private maxLength: number
  private lastCommittedValue: string = ""
  private cursorVisible: boolean = true
  private cursorBlinkTimer: Timer | null = null

  constructor(id: string, options: InputElementOptions) {
    super(id, options)

    this.placeholder = options.placeholder || ""
    this.value = options.value || ""
    this.lastCommittedValue = this.value
    this.cursorPosition = this.value.length
    this.maxLength = options.maxLength || 1000

    this.placeholderColor = parseColor(options.placeholderColor || "#666666")
    this.cursorColor = parseColor(options.cursorColor || "#FFFFFF")
    
    this.startCursorBlink()
  }

  private startCursorBlink(): void {
    if (this.cursorBlinkTimer) {
      clearInterval(this.cursorBlinkTimer)
    }

    this.cursorBlinkTimer = setInterval(() => {
      if (this.focused) {
        this.cursorVisible = !this.cursorVisible
        this.needsRefresh = true
      }
    }, 500)
  }

  public focus(): void {
    super.focus()
    this.cursorVisible = true
    this.startCursorBlink()
    this.needsRefresh = true
  }

  public blur(): void {
    super.blur()
    this.cursorVisible = false
    if (this.cursorBlinkTimer) {
      clearInterval(this.cursorBlinkTimer)
      this.cursorBlinkTimer = null
    }
    
    if (this.value !== this.lastCommittedValue) {
      this.lastCommittedValue = this.value
      this.emit(InputElementEvents.CHANGE, this.value)
    }
    
    this.needsRefresh = true
  }

  protected refreshContent(contentX: number, contentY: number, contentWidth: number, contentHeight: number): void {
    if (!this.frameBuffer) return

    const displayText = this.value || this.placeholder
    const isPlaceholder = !this.value && this.placeholder
    const textColor = isPlaceholder ? this.placeholderColor : this.textColor

    const maxVisibleChars = contentWidth - 1
    let displayStartIndex = 0
    
    if (this.cursorPosition >= maxVisibleChars) {
      displayStartIndex = this.cursorPosition - maxVisibleChars + 1
    }

    const visibleText = displayText.substring(displayStartIndex, displayStartIndex + maxVisibleChars)
    const cursorDisplayX = this.cursorPosition - displayStartIndex

    if (visibleText) {
      this.frameBuffer.drawText(visibleText, contentX, contentY, textColor)
    }

    if (this.focused && this.cursorVisible && cursorDisplayX >= 0 && cursorDisplayX < contentWidth) {
      const cursorX = contentX + cursorDisplayX
      
      if (this.cursorPosition >= this.value.length || this.value.length === 0) {
        this.frameBuffer.drawText("█", cursorX, contentY, this.cursorColor)
      } else {
        const charAtCursor = this.value[this.cursorPosition] || " "
        this.frameBuffer.drawText(charAtCursor, cursorX, contentY, this.backgroundColor, this.cursorColor)
      }
    }
  }

  public setValue(value: string): void {
    const newValue = value.substring(0, this.maxLength)
    if (this.value !== newValue) {
      this.value = newValue
      this.cursorPosition = Math.min(this.cursorPosition, this.value.length)
      this.needsRefresh = true
      this.emit(InputElementEvents.INPUT, this.value)
    }
  }

  public getValue(): string {
    return this.value
  }

  public getPlaceholder(): string {
    return this.placeholder
  }

  public setPlaceholder(placeholder: string): void {
    if (this.placeholder !== placeholder) {
      this.placeholder = placeholder
      this.needsRefresh = true
    }
  }

  public getCursorPosition(): number {
    return this.cursorPosition
  }

  public setCursorPosition(position: number): void {
    const newPosition = Math.max(0, Math.min(position, this.value.length))
    if (this.cursorPosition !== newPosition) {
      this.cursorPosition = newPosition
      this.cursorVisible = true
      this.needsRefresh = true
    }
  }

  private insertText(text: string): void {
    if (this.value.length + text.length > this.maxLength) {
      return
    }

    const beforeCursor = this.value.substring(0, this.cursorPosition)
    const afterCursor = this.value.substring(this.cursorPosition)
    this.value = beforeCursor + text + afterCursor
    this.cursorPosition += text.length
    this.needsRefresh = true
    this.emit(InputElementEvents.INPUT, this.value)
  }

  private deleteCharacter(direction: "backward" | "forward"): void {
    if (direction === "backward" && this.cursorPosition > 0) {
      const beforeCursor = this.value.substring(0, this.cursorPosition - 1)
      const afterCursor = this.value.substring(this.cursorPosition)
      this.value = beforeCursor + afterCursor
      this.cursorPosition--
      this.needsRefresh = true
      this.emit(InputElementEvents.INPUT, this.value)
    } else if (direction === "forward" && this.cursorPosition < this.value.length) {
      const beforeCursor = this.value.substring(0, this.cursorPosition)
      const afterCursor = this.value.substring(this.cursorPosition + 1)
      this.value = beforeCursor + afterCursor
      this.needsRefresh = true
      this.emit(InputElementEvents.INPUT, this.value)
    }
  }

  public handleKeyPress(key: ParsedKey | string): boolean {
    const keyName = typeof key === "string" ? key : key.name
    const keySequence = typeof key === "string" ? key : key.sequence

    switch (keyName) {
      case "left":
        this.setCursorPosition(this.cursorPosition - 1)
        return true
      
      case "right":
        this.setCursorPosition(this.cursorPosition + 1)
        return true
      
      case "home":
        this.setCursorPosition(0)
        return true
      
      case "end":
        this.setCursorPosition(this.value.length)
        return true
      
      case "backspace":
        this.deleteCharacter("backward")
        return true
      
      case "delete":
        this.deleteCharacter("forward")
        return true
      
      case "return":
      case "enter":
        if (this.value !== this.lastCommittedValue) {
          this.lastCommittedValue = this.value
          this.emit(InputElementEvents.CHANGE, this.value)
        }
        this.emit(InputElementEvents.ENTER, this.value)
        return true
      
      default:
        if (keySequence && keySequence.length === 1 && keySequence.charCodeAt(0) >= 32 && keySequence.charCodeAt(0) <= 126) {
          this.insertText(keySequence)
          return true
        }
        break
    }

    return false
  }

  public getMaxLength(): number {
    return this.maxLength
  }

  public setMaxLength(maxLength: number): void {
    this.maxLength = maxLength
    if (this.value.length > maxLength) {
      this.setValue(this.value.substring(0, maxLength))
    }
  }

  protected destroySelf(): void {
    if (this.cursorBlinkTimer) {
      clearInterval(this.cursorBlinkTimer)
      this.cursorBlinkTimer = null
    }
    super.destroySelf()
  }
} 