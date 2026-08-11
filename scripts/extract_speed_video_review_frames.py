#!/usr/bin/env python3
"""Render evenly sampled source frames into a contact sheet for qualitative review.

This helper deliberately does not calculate running times, distances, or speed.
It preserves source-frame order and is used only to determine whether a clip is
normal-speed, edited, identifiable, and relevant to physical running ability.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import cv2
from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--samples", type=int, default=24)
    parser.add_argument("--columns", type=int, default=6)
    parser.add_argument("--width", type=int, default=320)
    parser.add_argument("--start-frac", type=float, default=0.0)
    parser.add_argument("--end-frac", type=float, default=1.0)
    args = parser.parse_args()

    if args.samples < 1 or args.columns < 1 or args.width < 1:
        raise SystemExit("samples, columns, and width must be positive")
    if not 0.0 <= args.start_frac < args.end_frac <= 1.0:
        raise SystemExit("start-frac and end-frac must satisfy 0 <= start < end <= 1")

    cap = cv2.VideoCapture(str(args.input))
    if not cap.isOpened():
        raise SystemExit(f"Cannot open source video: {args.input}")
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total_frames < 1:
        raise SystemExit(f"Source video has no readable frames: {args.input}")

    first_frame = round((total_frames - 1) * args.start_frac)
    last_frame = round((total_frames - 1) * args.end_frac)
    positions = [
        round(first_frame + (last_frame - first_frame) * i / max(args.samples - 1, 1))
        for i in range(args.samples)
    ]
    frames: list[Image.Image] = []
    for position in positions:
        cap.set(cv2.CAP_PROP_POS_FRAMES, position)
        ok, frame = cap.read()
        if not ok:
            continue
        height, width = frame.shape[:2]
        scaled_height = max(1, round(height * args.width / width))
        frame = cv2.resize(frame, (args.width, scaled_height), interpolation=cv2.INTER_AREA)
        frames.append(Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)))
    cap.release()

    if not frames:
        raise SystemExit(f"No frames could be read: {args.input}")

    cell_width = max(frame.width for frame in frames)
    cell_height = max(frame.height for frame in frames)
    rows = (len(frames) + args.columns - 1) // args.columns
    sheet = Image.new("RGB", (cell_width * args.columns, cell_height * rows), "black")
    for index, frame in enumerate(frames):
        x = (index % args.columns) * cell_width
        y = (index // args.columns) * cell_height
        sheet.paste(frame, (x, y))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(args.output, quality=92)


if __name__ == "__main__":
    main()
