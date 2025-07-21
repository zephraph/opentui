@thdxr

TL;DR: It's still a playground very much, I hope you get it to run. 

The core from TS perspective is:
- [CLIRenderer](./src/index.ts) (via [createCliRenderer](./src/index.ts#L71)) 
- +[OptimizedBuffer](./src/buffer.ts) 
- +[Renderable](./src/Renderable.ts)
- +[Console](./src/console.ts#L213)

The renderer has a buffer that can be drawn to, more buffers can be created and drawn to other buffers. Renderables can be nested and act as containers. The console captures console.*, caches and displays them. Try pressing backtick in the demos, some demos log stuff. That's the basics. I had everything pure TS in the beginning and I would provide a pure TS fallback again.

I am quite confident about that part.

The whole ui part is a clunky mess and the interface goes towards React, so I want to try a react reconciler next. Should be at least 50x faster than inkjs and with more features for rendering backgrounds, text, transparency, etc. I use quite some composition patterns, but for the ui I went with inheritance, I dunno, it just happened. Would need some serious refactoring and simplification.

element = component. basically. 

My plan was to build out a component/element library supporting the basics needed for something like opencode, get the interface right with some iterations, then refactor the hell out of the elements to be more efficient behind the scenes. But then again, it would very likely reflect react somehow.

Currently elements re-render when their state changes, by setting `this.needsRefresh = true`, which is propagated up the tree and triggers a re-render. Not very efficient yet, I know, I have plans though.

The whole Threejs rendering works well, but is more a gimmick and the core works independently. I have been thinking about putting some of the rendering into compute shaders, but that's a whole other story.

I know it's a long way to go, but I'm excited to see where it goes. Let me know your thoughts, even if it may not be what you expect, I'd be happy about feedback that I can incorporate.
