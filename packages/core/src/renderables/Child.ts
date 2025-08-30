// Simpler example of how to clip, draw the scrollbar on top of the children, and get the content and viewport sizes

import { OptimizedBuffer, Renderable, type RenderableOptions, type RenderContext } from ".."

export type Size = {
    width: number,
    height: number
}

class ViewportRenderable extends Renderable {
    protected focusable: boolean = true

    constructor(ctx: RenderContext, options: RenderableOptions) {
        super(ctx, options)
    }

    public get size(): Size {
        const node = this.getLayoutNode().yogaNode
        node.calculateLayout(undefined, undefined)
        return {
            width: node.getComputedWidth(),
            height: node.getComputedHeight()
        }
    }
}


export class ScrollBarRenderable extends Renderable {
    private _contentSize: Size = {
        width: 0,
        height: 0
    }

    private _viewportSize: Size = {
        width: 0,
        height: 0
    }

    constructor(ctx: RenderContext, options: RenderableOptions) {
        super(ctx, options)
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

    protected renderSelf(buffer: OptimizedBuffer, deltaTime: number): void {
        // Render the scrollbar
    }
}

export class ScrollAreaRenderable extends Renderable {
    protected viewport: ViewportRenderable
    protected vertical: ScrollBarRenderable;

    protected _contentSize: Size = {
        width: 0,
        height: 0
    }
    protected _viewportSize: Size = {
        width: 0,
        height: 0
    }

    constructor(ctx: RenderContext, options: RenderableOptions) {
        super(ctx, { ...options, buffered: true })

        this.viewport = new ViewportRenderable(ctx, {
        })

        this.vertical = new ScrollBarRenderable(ctx, {
            position: "absolute",
        })

        super.add(this.viewport)
        super.add(this.vertical)
        this.setChildHostById(this.viewport.id)
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
        const newSize: Size = {
            width: node.getComputedWidth(),
            height: node.getComputedHeight()
        }

        if (!Bun.deepMatch(newSize, this._viewportSize)) {
            this._viewportSize = newSize
            this.vertical.viewportSize = newSize
        }
    }

    protected onResize(): void {
        this.needsUpdate()
    }

    protected renderSelf(): void {
        this.updateViewportSize()
        this.updateContentSize()
    }
}
