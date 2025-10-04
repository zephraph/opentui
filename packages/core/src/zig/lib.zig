const std = @import("std");
const Allocator = std.mem.Allocator;

const ansi = @import("ansi.zig");
const buffer = @import("buffer.zig");
const renderer = @import("renderer.zig");
const gp = @import("grapheme.zig");
const text_buffer = @import("text-buffer.zig");
const terminal = @import("terminal.zig");
const gwidth = @import("gwidth.zig");
const logger = @import("logger.zig");

pub const OptimizedBuffer = buffer.OptimizedBuffer;
pub const CliRenderer = renderer.CliRenderer;
pub const Terminal = terminal.Terminal;
pub const RGBA = buffer.RGBA;

export fn setLogCallback(callback: ?*const fn (level: u8, msgPtr: [*]const u8, msgLen: usize) callconv(.C) void) void {
    logger.setLogCallback(callback);
}

fn f32PtrToRGBA(ptr: [*]const f32) RGBA {
    return .{ ptr[0], ptr[1], ptr[2], ptr[3] };
}

var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
const globalArena = arena.allocator();

export fn getArenaAllocatedBytes() usize {
    return arena.queryCapacity();
}

export fn createRenderer(width: u32, height: u32, testing: bool) ?*renderer.CliRenderer {
    if (width == 0 or height == 0) {
        logger.warn("Invalid renderer dimensions: {}x{}", .{ width, height });
        return null;
    }

    const pool = gp.initGlobalPool(globalArena);
    const unicode_data = gp.initGlobalUnicodeData(globalArena);

    const graphemes_ptr, const display_width_ptr = unicode_data;
    return renderer.CliRenderer.create(std.heap.page_allocator, width, height, pool, graphemes_ptr, display_width_ptr, testing) catch |err| {
        logger.err("Failed to create renderer: {}", .{err});
        return null;
    };
}

export fn setUseThread(rendererPtr: *renderer.CliRenderer, useThread: bool) void {
    rendererPtr.setUseThread(useThread);
}

export fn destroyRenderer(rendererPtr: *renderer.CliRenderer) void {
    rendererPtr.destroy();
}

export fn setBackgroundColor(rendererPtr: *renderer.CliRenderer, color: [*]const f32) void {
    rendererPtr.setBackgroundColor(f32PtrToRGBA(color));
}

export fn setRenderOffset(rendererPtr: *renderer.CliRenderer, offset: u32) void {
    rendererPtr.setRenderOffset(offset);
}

export fn updateStats(rendererPtr: *renderer.CliRenderer, time: f64, fps: u32, frameCallbackTime: f64) void {
    rendererPtr.updateStats(time, fps, frameCallbackTime);
}

export fn updateMemoryStats(rendererPtr: *renderer.CliRenderer, heapUsed: u32, heapTotal: u32, arrayBuffers: u32) void {
    rendererPtr.updateMemoryStats(heapUsed, heapTotal, arrayBuffers);
}

export fn getNextBuffer(rendererPtr: *renderer.CliRenderer) *buffer.OptimizedBuffer {
    return rendererPtr.getNextBuffer();
}

export fn getCurrentBuffer(rendererPtr: *renderer.CliRenderer) *buffer.OptimizedBuffer {
    return rendererPtr.getCurrentBuffer();
}

export fn getBufferWidth(bufferPtr: *buffer.OptimizedBuffer) u32 {
    return bufferPtr.width;
}

export fn getBufferHeight(bufferPtr: *buffer.OptimizedBuffer) u32 {
    return bufferPtr.height;
}

export fn render(rendererPtr: *renderer.CliRenderer, force: bool) void {
    rendererPtr.render(force);
}

export fn createOptimizedBuffer(width: u32, height: u32, respectAlpha: bool, widthMethod: u8, idPtr: [*]const u8, idLen: usize) ?*buffer.OptimizedBuffer {
    if (width == 0 or height == 0) {
        logger.warn("Invalid buffer dimensions: {}x{}", .{ width, height });
        return null;
    }

    const pool = gp.initGlobalPool(globalArena);
    const wMethod: gwidth.WidthMethod = if (widthMethod == 0) .wcwidth else .unicode;
    const id = idPtr[0..idLen];

    const unicode_data = gp.initGlobalUnicodeData(globalArena);
    const graphemes_ptr, const display_width_ptr = unicode_data;

    return buffer.OptimizedBuffer.init(std.heap.page_allocator, width, height, .{
        .respectAlpha = respectAlpha,
        .pool = pool,
        .width_method = wMethod,
        .id = id,
    }, graphemes_ptr, display_width_ptr) catch |err| {
        logger.err("Failed to create optimized buffer: {}", .{err});
        return null;
    };
}

export fn destroyOptimizedBuffer(bufferPtr: *buffer.OptimizedBuffer) void {
    bufferPtr.deinit();
}

export fn destroyFrameBuffer(frameBufferPtr: *buffer.OptimizedBuffer) void {
    destroyOptimizedBuffer(frameBufferPtr);
}

export fn drawFrameBuffer(targetPtr: *buffer.OptimizedBuffer, destX: i32, destY: i32, frameBuffer: *buffer.OptimizedBuffer, sourceX: u32, sourceY: u32, sourceWidth: u32, sourceHeight: u32) void {
    const srcX = if (sourceX == 0) null else sourceX;
    const srcY = if (sourceY == 0) null else sourceY;
    const srcWidth = if (sourceWidth == 0) null else sourceWidth;
    const srcHeight = if (sourceHeight == 0) null else sourceHeight;

    targetPtr.drawFrameBuffer(destX, destY, frameBuffer, srcX, srcY, srcWidth, srcHeight);
}

export fn setCursorPosition(rendererPtr: *renderer.CliRenderer, x: i32, y: i32, visible: bool) void {
    rendererPtr.terminal.setCursorPosition(@intCast(@max(1, x)), @intCast(@max(1, y)), visible);
}

export fn getTerminalCapabilities(rendererPtr: *renderer.CliRenderer, capsPtr: *terminal.Capabilities) void {
    capsPtr.* = rendererPtr.getTerminalCapabilities();
}

export fn processCapabilityResponse(rendererPtr: *renderer.CliRenderer, responsePtr: [*]const u8, responseLen: usize) void {
    const response = responsePtr[0..responseLen];
    rendererPtr.processCapabilityResponse(response);
}

export fn setCursorStyle(rendererPtr: *renderer.CliRenderer, stylePtr: [*]const u8, styleLen: usize, blinking: bool) void {
    const style = stylePtr[0..styleLen];
    const cursorStyle = std.meta.stringToEnum(terminal.CursorStyle, style) orelse .block;
    rendererPtr.terminal.setCursorStyle(cursorStyle, blinking);
}

export fn setCursorColor(rendererPtr: *renderer.CliRenderer, color: [*]const f32) void {
    rendererPtr.terminal.setCursorColor(f32PtrToRGBA(color));
}

export fn setDebugOverlay(rendererPtr: *renderer.CliRenderer, enabled: bool, corner: u8) void {
    const cornerEnum: renderer.DebugOverlayCorner = switch (corner) {
        0 => .topLeft,
        1 => .topRight,
        2 => .bottomLeft,
        else => .bottomRight,
    };

    rendererPtr.setDebugOverlay(enabled, cornerEnum);
}

export fn clearTerminal(rendererPtr: *renderer.CliRenderer) void {
    rendererPtr.clearTerminal();
}

export fn setTerminalTitle(rendererPtr: *renderer.CliRenderer, titlePtr: [*]const u8, titleLen: usize) void {
    const title = titlePtr[0..titleLen];
    var bufferedWriter = &rendererPtr.stdoutWriter;
    const writer = bufferedWriter.writer();
    rendererPtr.terminal.setTerminalTitle(writer.any(), title);
}

// Buffer functions
export fn bufferClear(bufferPtr: *buffer.OptimizedBuffer, bg: [*]const f32) void {
    bufferPtr.clear(f32PtrToRGBA(bg), null) catch {};
}

export fn bufferGetCharPtr(bufferPtr: *buffer.OptimizedBuffer) [*]u32 {
    return bufferPtr.getCharPtr();
}

export fn bufferGetFgPtr(bufferPtr: *buffer.OptimizedBuffer) [*]RGBA {
    return bufferPtr.getFgPtr();
}

export fn bufferGetBgPtr(bufferPtr: *buffer.OptimizedBuffer) [*]RGBA {
    return bufferPtr.getBgPtr();
}

export fn bufferGetAttributesPtr(bufferPtr: *buffer.OptimizedBuffer) [*]u8 {
    return bufferPtr.getAttributesPtr();
}

export fn bufferGetRespectAlpha(bufferPtr: *buffer.OptimizedBuffer) bool {
    return bufferPtr.getRespectAlpha();
}

export fn bufferSetRespectAlpha(bufferPtr: *buffer.OptimizedBuffer, respectAlpha: bool) void {
    bufferPtr.setRespectAlpha(respectAlpha);
}

export fn bufferGetId(bufferPtr: *buffer.OptimizedBuffer, outPtr: [*]u8, maxLen: usize) usize {
    const id = bufferPtr.getId();
    const copyLen = @min(id.len, maxLen);
    @memcpy(outPtr[0..copyLen], id[0..copyLen]);
    return copyLen;
}

export fn bufferGetRealCharSize(bufferPtr: *buffer.OptimizedBuffer) u32 {
    return bufferPtr.getRealCharSize();
}

export fn bufferWriteResolvedChars(bufferPtr: *buffer.OptimizedBuffer, outputPtr: [*]u8, outputLen: usize, addLineBreaks: bool) u32 {
    const output_slice = outputPtr[0..outputLen];
    return bufferPtr.writeResolvedChars(output_slice, addLineBreaks) catch 0;
}

export fn bufferDrawText(bufferPtr: *buffer.OptimizedBuffer, text: [*]const u8, textLen: usize, x: u32, y: u32, fg: [*]const f32, bg: ?[*]const f32, attributes: u8) void {
    const rgbaFg = f32PtrToRGBA(fg);
    const rgbaBg = if (bg) |bgPtr| f32PtrToRGBA(bgPtr) else null;
    bufferPtr.drawText(text[0..textLen], x, y, rgbaFg, rgbaBg, attributes) catch {};
}

export fn bufferSetCellWithAlphaBlending(bufferPtr: *buffer.OptimizedBuffer, x: u32, y: u32, char: u32, fg: [*]const f32, bg: [*]const f32, attributes: u8) void {
    const rgbaFg = f32PtrToRGBA(fg);
    const rgbaBg = f32PtrToRGBA(bg);
    bufferPtr.setCellWithAlphaBlending(x, y, char, rgbaFg, rgbaBg, attributes) catch {};
}

export fn bufferSetCell(bufferPtr: *buffer.OptimizedBuffer, x: u32, y: u32, char: u32, fg: [*]const f32, bg: [*]const f32, attributes: u8) void {
    const rgbaFg = f32PtrToRGBA(fg);
    const rgbaBg = f32PtrToRGBA(bg);
    const cell = buffer.Cell{
        .char = char,
        .fg = rgbaFg,
        .bg = rgbaBg,
        .attributes = attributes,
    };
    bufferPtr.set(x, y, cell);
}

export fn bufferFillRect(bufferPtr: *buffer.OptimizedBuffer, x: u32, y: u32, width: u32, height: u32, bg: [*]const f32) void {
    const rgbaBg = f32PtrToRGBA(bg);
    bufferPtr.fillRect(x, y, width, height, rgbaBg) catch {};
}

export fn bufferDrawPackedBuffer(bufferPtr: *buffer.OptimizedBuffer, data: [*]const u8, dataLen: usize, posX: u32, posY: u32, terminalWidthCells: u32, terminalHeightCells: u32) void {
    bufferPtr.drawPackedBuffer(data, dataLen, posX, posY, terminalWidthCells, terminalHeightCells);
}

export fn bufferPushScissorRect(bufferPtr: *buffer.OptimizedBuffer, x: i32, y: i32, width: u32, height: u32) void {
    bufferPtr.pushScissorRect(x, y, width, height) catch {};
}

export fn bufferPopScissorRect(bufferPtr: *buffer.OptimizedBuffer) void {
    bufferPtr.popScissorRect();
}

export fn bufferClearScissorRects(bufferPtr: *buffer.OptimizedBuffer) void {
    bufferPtr.clearScissorRects();
}

export fn bufferDrawSuperSampleBuffer(bufferPtr: *buffer.OptimizedBuffer, x: u32, y: u32, pixelData: [*]const u8, len: usize, format: u8, alignedBytesPerRow: u32) void {
    bufferPtr.drawSuperSampleBuffer(x, y, pixelData, len, format, alignedBytesPerRow) catch {};
}

export fn bufferDrawBox(
    bufferPtr: *buffer.OptimizedBuffer,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    borderChars: [*]const u32,
    packedOptions: u32,
    borderColor: [*]const f32,
    backgroundColor: [*]const f32,
    title: ?[*]const u8,
    titleLen: u32,
) void {
    const borderSides = buffer.BorderSides{
        .top = (packedOptions & 0b1000) != 0,
        .right = (packedOptions & 0b0100) != 0,
        .bottom = (packedOptions & 0b0010) != 0,
        .left = (packedOptions & 0b0001) != 0,
    };

    const shouldFill = ((packedOptions >> 4) & 1) != 0;
    const titleAlignment = @as(u8, @intCast((packedOptions >> 5) & 0b11));

    const titleSlice = if (title) |t| t[0..titleLen] else null;

    bufferPtr.drawBox(
        x,
        y,
        width,
        height,
        borderChars,
        borderSides,
        f32PtrToRGBA(borderColor),
        f32PtrToRGBA(backgroundColor),
        shouldFill,
        titleSlice,
        titleAlignment,
    ) catch {};
}

export fn bufferResize(bufferPtr: *buffer.OptimizedBuffer, width: u32, height: u32) void {
    bufferPtr.resize(width, height) catch {};
}

export fn resizeRenderer(rendererPtr: *renderer.CliRenderer, width: u32, height: u32) void {
    rendererPtr.resize(width, height) catch {};
}

export fn addToHitGrid(rendererPtr: *renderer.CliRenderer, x: i32, y: i32, width: u32, height: u32, id: u32) void {
    rendererPtr.addToHitGrid(x, y, width, height, id);
}

export fn checkHit(rendererPtr: *renderer.CliRenderer, x: u32, y: u32) u32 {
    return rendererPtr.checkHit(x, y);
}

export fn dumpHitGrid(rendererPtr: *renderer.CliRenderer) void {
    rendererPtr.dumpHitGrid();
}

export fn dumpBuffers(rendererPtr: *renderer.CliRenderer, timestamp: i64) void {
    rendererPtr.dumpBuffers(timestamp);
}

export fn dumpStdoutBuffer(rendererPtr: *renderer.CliRenderer, timestamp: i64) void {
    rendererPtr.dumpStdoutBuffer(timestamp);
}

export fn enableMouse(rendererPtr: *renderer.CliRenderer, enableMovement: bool) void {
    rendererPtr.enableMouse(enableMovement);
}

export fn disableMouse(rendererPtr: *renderer.CliRenderer) void {
    rendererPtr.disableMouse();
}

export fn queryPixelResolution(rendererPtr: *renderer.CliRenderer) void {
    rendererPtr.queryPixelResolution();
}

export fn enableKittyKeyboard(rendererPtr: *renderer.CliRenderer, flags: u8) void {
    rendererPtr.enableKittyKeyboard(flags);
}

export fn disableKittyKeyboard(rendererPtr: *renderer.CliRenderer) void {
    rendererPtr.disableKittyKeyboard();
}

export fn setupTerminal(rendererPtr: *renderer.CliRenderer, useAlternateScreen: bool) void {
    rendererPtr.setupTerminal(useAlternateScreen);
}

export fn createTextBuffer(widthMethod: u8) ?*text_buffer.TextBuffer {
    const pool = gp.initGlobalPool(globalArena);
    const wMethod: gwidth.WidthMethod = if (widthMethod == 0) .wcwidth else .unicode;

    const unicode_data = gp.initGlobalUnicodeData(globalArena);
    const graphemes_ptr, const display_width_ptr = unicode_data;

    const tb = text_buffer.TextBuffer.init(std.heap.page_allocator, pool, wMethod, graphemes_ptr, display_width_ptr) catch {
        return null;
    };

    return tb;
}

export fn destroyTextBuffer(tb: *text_buffer.TextBuffer) void {
    tb.deinit();
}

export fn textBufferGetLength(tb: *text_buffer.TextBuffer) u32 {
    return tb.getLength();
}

export fn textBufferReset(tb: *text_buffer.TextBuffer) void {
    tb.reset();
}

export fn textBufferSetSelection(tb: *text_buffer.TextBuffer, start: u32, end: u32, bgColor: ?[*]const f32, fgColor: ?[*]const f32) void {
    const bg = if (bgColor) |bgPtr| f32PtrToRGBA(bgPtr) else null;
    const fg = if (fgColor) |fgPtr| f32PtrToRGBA(fgPtr) else null;
    tb.setSelection(start, end, bg, fg);
}

export fn textBufferResetSelection(tb: *text_buffer.TextBuffer) void {
    tb.resetSelection();
}

export fn textBufferSetDefaultFg(tb: *text_buffer.TextBuffer, fg: ?[*]const f32) void {
    const fgColor = if (fg) |fgPtr| f32PtrToRGBA(fgPtr) else null;
    tb.setDefaultFg(fgColor);
}

export fn textBufferSetDefaultBg(tb: *text_buffer.TextBuffer, bg: ?[*]const f32) void {
    const bgColor = if (bg) |bgPtr| f32PtrToRGBA(bgPtr) else null;
    tb.setDefaultBg(bgColor);
}

export fn textBufferSetDefaultAttributes(tb: *text_buffer.TextBuffer, attr: ?[*]const u8) void {
    const attrValue = if (attr) |a| a[0] else null;
    tb.setDefaultAttributes(attrValue);
}

export fn textBufferResetDefaults(tb: *text_buffer.TextBuffer) void {
    tb.resetDefaults();
}

export fn textBufferWriteChunk(tb: *text_buffer.TextBuffer, textBytes: [*]const u8, textLen: u32, fg: ?[*]const f32, bg: ?[*]const f32, attr: ?[*]const u8) u32 {
    const textSlice = textBytes[0..textLen];
    const fgColor = if (fg) |fgPtr| f32PtrToRGBA(fgPtr) else null;
    const bgColor = if (bg) |bgPtr| f32PtrToRGBA(bgPtr) else null;
    const attrValue = if (attr) |a| a[0] else null;

    return tb.writeChunk(textSlice, fgColor, bgColor, attrValue) catch 0;
}

export fn textBufferFinalizeLineInfo(tb: *text_buffer.TextBuffer) void {
    tb.finalizeLineInfo();
}

export fn textBufferGetLineCount(tb: *text_buffer.TextBuffer) u32 {
    return tb.getLineCount();
}

export fn textBufferGetLineInfoDirect(tb: *text_buffer.TextBuffer, lineStartsPtr: [*]u32, lineWidthsPtr: [*]u32) u32 {
    const line_info = tb.getCachedLineInfo();

    @memcpy(lineStartsPtr[0..line_info.starts.len], line_info.starts);
    @memcpy(lineWidthsPtr[0..line_info.widths.len], line_info.widths);

    return line_info.max_width;
}

export fn bufferDrawTextBuffer(
    bufferPtr: *buffer.OptimizedBuffer,
    textBufferPtr: *text_buffer.TextBuffer,
    x: i32,
    y: i32,
    clipX: i32,
    clipY: i32,
    clipWidth: u32,
    clipHeight: u32,
    hasClipRect: bool,
) void {
    const clip_rect = if (hasClipRect) buffer.ClipRect{
        .x = clipX,
        .y = clipY,
        .width = clipWidth,
        .height = clipHeight,
    } else null;

    bufferPtr.drawTextBuffer(textBufferPtr, x, y, clip_rect) catch {};
}

// Get selection info as packed u64: [start:u32][end:u32]
// Returns 0xFFFFFFFF_FFFFFFFF if no selection
export fn textBufferGetSelectionInfo(tb: *text_buffer.TextBuffer) u64 {
    return tb.packSelectionInfo();
}

export fn textBufferGetSelectedText(tb: *text_buffer.TextBuffer, outPtr: [*]u8, maxLen: usize) usize {
    const outBuffer = outPtr[0..maxLen];
    return tb.getSelectedTextIntoBuffer(outBuffer);
}

export fn textBufferGetPlainText(tb: *text_buffer.TextBuffer, outPtr: [*]u8, maxLen: usize) usize {
    const outBuffer = outPtr[0..maxLen];
    return tb.getPlainTextIntoBuffer(outBuffer);
}

export fn textBufferSetLocalSelection(tb: *text_buffer.TextBuffer, anchorX: i32, anchorY: i32, focusX: i32, focusY: i32, bgColor: ?[*]const f32, fgColor: ?[*]const f32) bool {
    const bg = if (bgColor) |bgPtr| f32PtrToRGBA(bgPtr) else null;
    const fg = if (fgColor) |fgPtr| f32PtrToRGBA(fgPtr) else null;
    return tb.setLocalSelection(anchorX, anchorY, focusX, focusY, bg, fg);
}

export fn textBufferResetLocalSelection(tb: *text_buffer.TextBuffer) void {
    tb.resetLocalSelection();
}

export fn textBufferInsertChunkGroup(tb: *text_buffer.TextBuffer, index: usize, textBytes: [*]const u8, textLen: u32, fg: ?[*]const f32, bg: ?[*]const f32, attr: u8) u32 {
    const textSlice = textBytes[0..textLen];
    const fgColor = if (fg) |fgPtr| f32PtrToRGBA(fgPtr) else null;
    const bgColor = if (bg) |bgPtr| f32PtrToRGBA(bgPtr) else null;
    const attrValue = if (attr == 255) null else attr;
    return tb.insertChunkGroup(index, textSlice, fgColor, bgColor, attrValue) catch 0;
}

export fn textBufferRemoveChunkGroup(tb: *text_buffer.TextBuffer, index: usize) u32 {
    return tb.removeChunkGroup(index) catch tb.char_count;
}

export fn textBufferReplaceChunkGroup(tb: *text_buffer.TextBuffer, index: usize, textBytes: [*]const u8, textLen: u32, fg: ?[*]const f32, bg: ?[*]const f32, attr: u8) u32 {
    const textSlice = textBytes[0..textLen];
    const fgColor = if (fg) |fgPtr| f32PtrToRGBA(fgPtr) else null;
    const bgColor = if (bg) |bgPtr| f32PtrToRGBA(bgPtr) else null;
    const attrValue = if (attr == 255) null else attr;
    return tb.replaceChunkGroup(index, textSlice, fgColor, bgColor, attrValue) catch tb.char_count;
}

export fn textBufferGetChunkGroupCount(tb: *const text_buffer.TextBuffer) usize {
    return tb.getChunkGroupCount();
}

export fn textBufferSetWrapWidth(tb: *text_buffer.TextBuffer, width: u32) void {
    tb.setWrapWidth(if (width == 0) null else width);
}

export fn textBufferSetWrapMode(tb: *text_buffer.TextBuffer, mode: u8) void {
    const wrapMode: text_buffer.WrapMode = switch (mode) {
        0 => .char,
        1 => .word,
        else => .char,
    };
    tb.setWrapMode(wrapMode);
}

// Virtual terminal testing functions
export fn vtWrite(rendererPtr: *renderer.CliRenderer, dataPtr: [*]const u8, dataLen: usize) void {
    if (rendererPtr.virtual_terminal) |vt| {
        const data = dataPtr[0..dataLen];
        renderer.vtWrite(vt, data) catch {};
    }
}

export fn vtGetScreenContent(rendererPtr: *renderer.CliRenderer, outputPtr: [*]u8, maxLen: usize) usize {
    if (rendererPtr.virtual_terminal) |vt| {
        const output = outputPtr[0..maxLen];
        return renderer.vtGetScreenContent(vt, output) catch 0;
    }
    return 0;
}

export fn vtGetCursorPosition(rendererPtr: *renderer.CliRenderer, xPtr: *u32, yPtr: *u32) void {
    if (rendererPtr.virtual_terminal) |vt| {
        const pos = renderer.vtGetCursorPosition(vt);
        xPtr.* = pos.x;
        yPtr.* = pos.y;
    } else {
        xPtr.* = 0;
        yPtr.* = 0;
    }
}

export fn vtResize(rendererPtr: *renderer.CliRenderer, width: u32, height: u32) void {
    if (rendererPtr.virtual_terminal) |vt| {
        renderer.vtResize(vt, width, height) catch {};
    }
}
