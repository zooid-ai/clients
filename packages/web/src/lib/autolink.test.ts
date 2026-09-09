import { describe, expect, it } from "vitest";
import { splitUrls, tokenizeTopic } from "./autolink";

describe("tokenizeTopic", () => {
  it("returns a single text token for plain prose", () => {
    expect(tokenizeTopic("just some words")).toEqual([{ kind: "text", value: "just some words" }]);
  });

  it("extracts an https url as a url token", () => {
    expect(tokenizeTopic("see https://zoon.eco for docs")).toEqual([
      { kind: "text", value: "see " },
      { kind: "url", value: "https://zoon.eco" },
      { kind: "text", value: " for docs" },
    ]);
  });

  it("extracts a #channel reference as a channel token", () => {
    expect(tokenizeTopic("join #general to chat")).toEqual([
      { kind: "text", value: "join " },
      { kind: "channel", value: "#general" },
      { kind: "text", value: " to chat" },
    ]);
  });

  it("handles a full-alias channel token with a server part", () => {
    expect(tokenizeTopic("ping #help:zoon.eco")).toEqual([
      { kind: "text", value: "ping " },
      { kind: "channel", value: "#help:zoon.eco" },
    ]);
  });

  it("tokenizes a mix of url and channel in order", () => {
    expect(tokenizeTopic("docs https://x.io then #general")).toEqual([
      { kind: "text", value: "docs " },
      { kind: "url", value: "https://x.io" },
      { kind: "text", value: " then " },
      { kind: "channel", value: "#general" },
    ]);
  });

  it("does not treat a bare '#' or trailing punctuation as a channel", () => {
    expect(tokenizeTopic("issue #")).toEqual([{ kind: "text", value: "issue #" }]);
    // trailing punctuation is excluded from the token
    expect(tokenizeTopic("see #general.")).toEqual([
      { kind: "text", value: "see " },
      { kind: "channel", value: "#general" },
      { kind: "text", value: "." },
    ]);
  });

  it("returns an empty array for an empty string", () => {
    expect(tokenizeTopic("")).toEqual([]);
  });
});

describe("splitUrls", () => {
  it("returns an empty array for an empty string", () => {
    expect(splitUrls("")).toEqual([]);
  });

  it("returns a single text part for plain prose", () => {
    expect(splitUrls("just some words")).toEqual([{ text: "just some words", url: null }]);
  });

  it("extracts an https url as its own part", () => {
    expect(splitUrls("see https://zoon.eco for docs")).toEqual([
      { text: "see ", url: null },
      { text: "https://zoon.eco", url: "https://zoon.eco" },
      { text: " for docs", url: null },
    ]);
  });

  it("extracts multiple urls in order", () => {
    expect(splitUrls("http://a.io and https://b.io")).toEqual([
      { text: "http://a.io", url: "http://a.io" },
      { text: " and ", url: null },
      { text: "https://b.io", url: "https://b.io" },
    ]);
  });

  it("treats a url spanning the whole string as a single part", () => {
    expect(splitUrls("https://zoon.eco")).toEqual([
      { text: "https://zoon.eco", url: "https://zoon.eco" },
    ]);
  });
});
