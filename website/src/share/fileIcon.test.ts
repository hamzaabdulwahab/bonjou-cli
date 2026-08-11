import { describe, expect, it } from "vitest";

import { iconNameFor } from "./FileIcon";

describe("file icon resolution", () => {
  it("picks an icon from the extension", () => {
    expect(iconNameFor("model.py")).toBe("python");
    expect(iconNameFor("invoice.pdf")).toBe("pdf");
    expect(iconNameFor("bundle.js")).toBe("javascript");
    expect(iconNameFor("main.go")).toBe("go");
    expect(iconNameFor("notes.md")).toBe("markdown");
  });

  it("groups by category the way the theme does", () => {
    expect(iconNameFor("holiday.HEIC")).toBe("image");
    expect(iconNameFor("track.mp3")).toBe("audio");
    expect(iconNameFor("clip.mp4")).toBe("video");
    expect(iconNameFor("backup.7z")).toBe("zip");
    expect(iconNameFor("sheet.xlsx")).toBe("table");
  });

  it("is case insensitive", () => {
    expect(iconNameFor("REPORT.PDF")).toBe(iconNameFor("report.pdf"));
  });

  // The whole reason the suffix search runs longest-first: ".gz" alone is
  // still an archive here, but a name like "app.config.js" must not be read
  // as a "config.js" file when only ".js" is mapped.
  it("prefers the longest matching suffix", () => {
    expect(iconNameFor("archive.tar.gz")).toBe("zip");
    expect(iconNameFor("app.config.js")).toBe("javascript");
  });

  it("matches exact filenames before extensions", () => {
    expect(iconNameFor("Dockerfile")).toBe("docker");
    expect(iconNameFor("Makefile")).toBe("makefile");
    expect(iconNameFor(".gitignore")).toBe("git");
    // Not "json": the theme knows what this particular file is.
    expect(iconNameFor("package.json")).toBe("nodejs");
  });

  it("ignores any leading path", () => {
    expect(iconNameFor("pack/img/blob.png")).toBe("image");
  });

  it("falls back to the generic file", () => {
    expect(iconNameFor("payload.bin")).not.toBe("");
    expect(iconNameFor("no-extension")).toBe("file");
    expect(iconNameFor("")).toBe("file");
  });
});
