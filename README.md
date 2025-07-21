# Renderoo

A Bun module with Zig integration for terminal rendering.

## Features

- Fast buffer-based terminal rendering
- Support for Unicode text, colors, and styles
- Alpha blending for transparent UI elements
- Optimized rendering of only modified cells
- Text, Box, and FrameBuffer rendering components
- Custom border styles

## Usage

```typescript
import { Renderer } from "renderoo";

// Create a renderer with terminal dimensions
const renderer = new Renderer(
  process.stdout.columns || 80,
  process.stdout.rows || 24
);

// Set background color
renderer.setBackground(0, 0, 40); // Dark blue
```