import { describe, expect, it } from "vitest";
import { lineDiff } from "./line-diff";

describe("lineDiff", () => {
  it("marks added lines", () => {
    expect(lineDiff("a\nb\n", "a\nb\nc\n")).toEqual([
      { type: "ctx", text: "a" },
      { type: "ctx", text: "b" },
      { type: "add", text: "c" },
    ]);
  });

  it("marks removed lines", () => {
    expect(lineDiff("a\nb\nc\n", "a\nc\n")).toEqual([
      { type: "ctx", text: "a" },
      { type: "del", text: "b" },
      { type: "ctx", text: "c" },
    ]);
  });

  it("treats a replacement as del + add", () => {
    expect(lineDiff("a\n", "b\n")).toEqual([
      { type: "del", text: "a" },
      { type: "add", text: "b" },
    ]);
  });

  it("handles a brand-new file (empty old side)", () => {
    expect(lineDiff("", "x\ny\n")).toEqual([
      { type: "add", text: "x" },
      { type: "add", text: "y" },
    ]);
  });
});
