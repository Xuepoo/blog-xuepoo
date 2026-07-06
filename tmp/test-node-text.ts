import { Text } from "@vectojs/ui";
const text = new Text("# comment\necho " + "a".repeat(40) + " b\n# next line", { maxWidth: 100, font: "10px sans-serif", lineHeight: 15 });
console.log(text.lines);
console.log("height:", text.height);
