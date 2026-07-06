import { LayoutEngine } from "/mnt/data/Workspace/Projects/vectojs/vectojs/packages/core/src/layout/LayoutEngine.ts";
const engine = new LayoutEngine(100, 100, { measure: (char) => 10 });
const prepared = engine.prepare("a".repeat(20), {}, 10);
const layout = engine.layoutPrepared(prepared);
console.log(layout.nodes.map(n => n.y));
