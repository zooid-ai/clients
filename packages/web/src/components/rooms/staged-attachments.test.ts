import { describe, expect, it } from "vitest";
import {
  MAX_ATTACHMENTS,
  formatBytes,
  nameClipboardFile,
  stageFiles,
  type StagedAttachment,
} from "./staged-attachments";

function png(bytes: number, name = "shot.png"): File {
  return new File([new Uint8Array(bytes)], name, { type: "image/png" });
}

const empty: StagedAttachment[] = [];

describe("stageFiles", () => {
  it("stages files that are within the size cap", () => {
    const { staged, error } = stageFiles(empty, [png(1024, "a.png"), png(2048, "b.png")]);
    expect(staged.map((s) => s.file.name)).toEqual(["a.png", "b.png"]);
    expect(error).toBeNull();
  });

  it("gives every staged file a distinct id", () => {
    const { staged } = stageFiles(empty, [png(1, "a.png"), png(1, "a.png")]);
    expect(new Set(staged.map((s) => s.id)).size).toBe(2);
  });

  it("appends to what is already staged", () => {
    const first = stageFiles(empty, [png(1024, "a.png")]).staged;
    expect(stageFiles(first, [png(1024, "b.png")]).staged.map((s) => s.file.name)).toEqual([
      "a.png",
      "b.png",
    ]);
  });

  it("drops oversized files, keeps the rest, and names the offender", () => {
    const { staged, error } = stageFiles(empty, [png(1024, "ok.png"), png(524_289, "huge.png")]);
    expect(staged.map((s) => s.file.name)).toEqual(["ok.png"]);
    expect(error).toMatch(/\u201Chuge\.png\u201D is over the 0\.5 MB limit\./);
  });

  it("summarises rather than lists when several files are oversized", () => {
    const { error } = stageFiles(empty, [png(524_289, "a.png"), png(600_000, "b.png")]);
    expect(error).toMatch(/2 files are over the 0\.5 MB limit/);
  });

  it("fills the remaining room and reports the overflow", () => {
    const { staged, error } = stageFiles(
      empty,
      Array.from({ length: MAX_ATTACHMENTS + 2 }, (_, i) => png(64, `f${i}.png`)),
    );
    expect(staged).toHaveLength(MAX_ATTACHMENTS);
    expect(error).toMatch(/No more than 8 attachments can be sent at once\./);
  });

  it("reports both problems at once", () => {
    const full = stageFiles(
      empty,
      Array.from({ length: MAX_ATTACHMENTS }, (_, i) => png(64, `f${i}.png`)),
    ).staged;
    const { staged, error } = stageFiles(full, [png(64, "more.png"), png(524_289, "huge.png")]);
    expect(staged).toHaveLength(MAX_ATTACHMENTS);
    expect(error).toMatch(
      /\u201Chuge\.png\u201D is over the 0\.5 MB limit\. No more than 8 attachments/,
    );
  });
});

describe("nameClipboardFile", () => {
  const at = new Date(2026, 7, 30, 9, 5, 3); // 2026-08-30 09:05:03

  it("renames the generic name a browser gives a pasted screenshot", () => {
    const renamed = nameClipboardFile(png(10, "image.png"), at);
    expect(renamed.name).toBe("pasted-20260830-090503.png");
    expect(renamed.type).toBe("image/png");
    expect(renamed.size).toBe(10);
  });

  it("keeps the extension of a pasted jpeg", () => {
    const jpeg = new File([new Uint8Array(4)], "image.jpeg", { type: "image/jpeg" });
    expect(nameClipboardFile(jpeg, at).name).toBe("pasted-20260830-090503.jpeg");
  });

  it("falls back to .png when the clipboard supplies no name at all", () => {
    expect(nameClipboardFile(png(10, ""), at).name).toBe("pasted-20260830-090503.png");
  });

  it("leaves a real filename alone", () => {
    expect(nameClipboardFile(png(10, "architecture-diagram.png"), at).name).toBe(
      "architecture-diagram.png",
    );
  });
});

describe("formatBytes", () => {
  it("scales the unit to the size", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(1_572_864)).toBe("1.5 MB");
  });
});
