// TODO: Use ncurses for this
export const ANSI = {
  switchToAlternateScreen: "\x1b[?1049h",
  switchToMainScreen: "\x1b[?1049l",
  reset: "\x1b[0m",
  hideCursor: "\x1b[?25l",
  showCursor: "\x1b[?25h",

  resetCursorColor: "\x1b]12;default\x07",
  saveCursorState: "\x1b[s",
  restoreCursorState: "\x1b[u",
}
