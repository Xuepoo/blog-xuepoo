import { Text } from "/mnt/data/Workspace/Projects/vectojs/vectojs/packages/ui/src/Text.ts";
const text = new Text("# comment\necho " + "a".repeat(40) + " b\n# next line", { maxWidth: 100, font: "10px sans-serif", lineHeight: 15 });
console.log(text.lines);
console.log("height:", text.height);
