#!/usr/bin/env python3
"""Generate the themed Bonjou hero demo GIF.

The animation intentionally uses only documented Bonjou commands and product
facts so the marketing page does not drift into placeholder content.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "bonjou-demo.gif"

W, H = 960, 720
BG = (0, 9, 4)
SURFACE = (0, 18, 8)
SURFACE_2 = (3, 28, 13)
LINE = (18, 72, 30)
LINE_HI = (36, 172, 58)
TEXT = (181, 230, 184)
MUTED = (94, 139, 96)
DIM = (55, 91, 58)
ACCENT = (37, 232, 26)
ACCENT_HOT = (118, 255, 100)
BLACK = (0, 0, 0)


FONT_CANDIDATES = {
    "body": [
        "/System/Library/Fonts/SFNS.ttf",
        "/System/Library/Fonts/HelveticaNeue.ttc",
        "/System/Library/Fonts/Helvetica.ttc",
    ],
    "mono": [
        "/System/Library/Fonts/SFNSMono.ttf",
        "/System/Library/Fonts/Supplemental/Menlo.ttc",
        "/System/Library/Fonts/Monaco.ttf",
        "/System/Library/Fonts/Supplemental/Andale Mono.ttf",
    ],
}


def load_font(kind: str, size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for candidate in FONT_CANDIDATES[kind]:
        path = Path(candidate)
        if not path.exists():
            continue
        try:
            return ImageFont.truetype(str(path), size=size)
        except OSError:
            continue
    return ImageFont.load_default()


FONT_TITLE = load_font("body", 42)
FONT_LABEL = load_font("mono", 18)
FONT_LABEL_SM = load_font("mono", 14)
FONT_MONO = load_font("mono", 25)
FONT_MONO_SM = load_font("mono", 20)
FONT_BODY = load_font("body", 24)
FONT_BODY_SM = load_font("body", 18)


STEPS = [
    {
        "command": "bonjou",
        "note": "Start Bonjou on machines connected to the same Wi-Fi or LAN.",
        "phase": "START",
    },
    {
        "command": "@users",
        "note": "Same-subnet discovery uses UDP 46320.",
        "phase": "DISCOVER",
    },
    {
        "command": "@send alex Hey, are you in the meeting?",
        "note": "Send a direct message from the terminal.",
        "phase": "MESSAGE",
    },
    {
        "command": "@file alex ~/report.pdf",
        "note": "File offers are metadata first.",
        "phase": "OFFER",
    },
    {
        "command": "@folder alex ./my-project",
        "note": "Offer a folder as one pending item.",
        "phase": "FOLDER",
    },
    {
        "command": "@queue",
        "note": "Incoming files and folders wait in an approval queue.",
        "phase": "QUEUE",
    },
    {
        "command": "@view <id>",
        "note": "Inspect sender-provided metadata before writing data.",
        "phase": "INSPECT",
    },
    {
        "command": "@approve <id>",
        "note": "Approved files land under ~/.bonjou/received/files/.",
        "phase": "APPROVE",
    },
]

PILLS = [
    ("UDP 46320", "DISCOVER"),
    ("TCP 46321", "OFFER"),
    ("metadata first", "QUEUE"),
    ("v1.2.0", "START"),
    ("MIT licensed", "APPROVE"),
]


def rounded_box(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], radius: int, fill, outline=None, width=1) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_grid(draw: ImageDraw.ImageDraw) -> None:
    for x in range(0, W, 48):
        draw.line((x, 0, x, H), fill=(6, 31, 12), width=1)
    for y in range(0, H, 48):
        draw.line((0, y, W, y), fill=(5, 27, 11), width=1)


def draw_text(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, font, fill, anchor=None) -> None:
    draw.text(xy, text, font=font, fill=fill, anchor=anchor)


def command_lines(completed: list[str], partial: str | None) -> list[str]:
    lines = [*completed]
    if partial is not None:
        lines.append(partial)
    return lines[-8:]


def draw_frame(completed: list[str], partial: str | None, note: str, phase: str, cursor_on: bool) -> Image.Image:
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    draw_grid(draw)

    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((20, -70, 620, 360), fill=(28, 224, 30, 22))
    glow_draw.ellipse((560, 250, 1100, 850), fill=(28, 224, 30, 14))
    img = Image.alpha_composite(img.convert("RGBA"), glow.filter(ImageFilter.GaussianBlur(54))).convert("RGB")
    draw = ImageDraw.Draw(img)

    rounded_box(draw, (28, 28, W - 28, H - 28), 20, (0, 13, 6), LINE, 2)
    rounded_box(draw, (52, 52, W - 52, 122), 14, SURFACE, LINE, 1)

    for index, color in enumerate(((246, 84, 86), (246, 190, 68), (72, 203, 82))):
        draw.ellipse((80 + index * 25, 79, 93 + index * 25, 92), fill=color)

    draw_text(draw, (174, 72), "bonjou demo", FONT_LABEL, ACCENT_HOT)
    draw_text(draw, (174, 96), "serverless LAN chat and file transfer", FONT_BODY_SM, TEXT)
    rounded_box(draw, (764, 72, 876, 102), 15, (0, 29, 12), LINE_HI if phase == "START" else LINE, 1)
    draw_text(draw, (820, 87), "LOCAL", FONT_LABEL_SM, ACCENT, anchor="mm")

    rounded_box(draw, (52, 146, W - 52, 514), 16, BLACK, LINE, 1)
    draw_text(draw, (78, 176), "$ bonjou", FONT_LABEL, DIM)
    draw_text(draw, (798, 176), phase, FONT_LABEL, ACCENT, anchor="mm")

    y = 226
    for line in command_lines(completed, partial):
        text = line
        if partial is not None and line == partial and cursor_on:
            text = f"{line}_"
        draw_text(draw, (82, y), "$", FONT_MONO_SM, MUTED)
        draw_text(draw, (116, y - 2), text, FONT_MONO, ACCENT_HOT)
        y += 39

    if not completed and partial is None:
        draw_text(draw, (82, y), "$", FONT_MONO_SM, MUTED)
        draw_text(draw, (116, y - 2), "_", FONT_MONO, ACCENT_HOT)

    rounded_box(draw, (74, 426, W - 74, 486), 12, SURFACE, LINE, 1)
    draw_text(draw, (102, 445), "STATUS", FONT_LABEL_SM, MUTED)
    draw_text(draw, (102, 466), note, FONT_BODY_SM, TEXT)

    card_y = 544
    draw_text(draw, (66, card_y), "DOCUMENTED FACTS", FONT_LABEL_SM, MUTED)
    x = 66
    for label, active_phase in PILLS:
        text_w = int(draw.textlength(label, font=FONT_LABEL_SM))
        width = text_w + 28
        active = phase == active_phase
        rounded_box(
            draw,
            (x, card_y + 28, x + width, card_y + 60),
            16,
            (2, 39, 15) if active else SURFACE,
            LINE_HI if active else LINE,
            1,
        )
        draw_text(draw, (x + width // 2, card_y + 44), label, FONT_LABEL_SM, ACCENT_HOT if active else TEXT, anchor="mm")
        x += width + 12

    draw_text(draw, (66, 642), "No server account. No cloud relay. Same local network.", FONT_BODY_SM, TEXT)
    draw_text(draw, (W - 66, 642), "generated asset", FONT_LABEL_SM, DIM, anchor="ra")

    return img


def build_frames() -> tuple[list[Image.Image], list[int]]:
    frames: list[Image.Image] = []
    durations: list[int] = []
    completed: list[str] = []

    def append(frame: Image.Image, duration: int) -> None:
        frames.append(frame)
        durations.append(duration)

    append(draw_frame([], None, "Start Bonjou on machines connected to the same Wi-Fi or LAN.", "START", True), 700)

    for step in STEPS:
        command = step["command"]
        note = step["note"]
        phase = step["phase"]
        for i in range(1, len(command) + 1, 2):
            append(draw_frame(completed, command[:i], note, phase, i % 4 != 0), 46)
        append(draw_frame(completed, command, note, phase, True), 120)
        completed.append(command)
        append(draw_frame(completed, None, note, phase, False), 780)

    for _ in range(5):
        append(draw_frame(completed, None, STEPS[-1]["note"], "APPROVE", True), 560)

    return frames, durations


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    frames, durations = build_frames()
    frames[0].save(
        OUT,
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=0,
        optimize=True,
        disposal=2,
    )
    print(f"Wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024 / 1024:.2f} MiB)")


if __name__ == "__main__":
    main()
