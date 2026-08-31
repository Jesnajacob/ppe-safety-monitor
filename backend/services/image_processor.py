"""
Image processor — draws bounding boxes and labels on detected images using Pillow.
"""
from PIL import Image, ImageDraw, ImageFont
import os
import math
from typing import Optional


# ─────────────────────────────────────────────
# Color definitions
# ─────────────────────────────────────────────

COLOR_SAFE = (34, 197, 94)          # green
COLOR_PPE_VIOLATION = (239, 68, 68) # red
COLOR_ZONE_VIOLATION = (245, 158, 11) # amber/orange
COLOR_PPE_ITEM = (96, 165, 250)     # blue (detected PPE)
COLOR_TEXT_BG_SAFE = (16, 85, 46)
COLOR_TEXT_BG_DANGER = (127, 29, 29)
COLOR_TEXT_BG_ZONE = (120, 53, 15)
COLOR_WHITE = (255, 255, 255)
COLOR_BLACK = (0, 0, 0)


def _get_font(size: int = 14) -> ImageFont.ImageFont:
    """Load a font, falling back to default if not available."""
    try:
        # Try common system fonts
        font_paths = [
            "C:/Windows/Fonts/arialbd.ttf",
            "C:/Windows/Fonts/arial.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        ]
        for path in font_paths:
            if os.path.exists(path):
                return ImageFont.truetype(path, size)
    except Exception:
        pass
    return ImageFont.load_default()


def _denorm(box: dict, img_w: int, img_h: int) -> tuple:
    """Convert normalized box {x,y,w,h} to pixel coordinates (x1,y1,x2,y2)."""
    x1 = int(box["x"] * img_w)
    y1 = int(box["y"] * img_h)
    x2 = int((box["x"] + box["w"]) * img_w)
    y2 = int((box["y"] + box["h"]) * img_h)
    return (x1, y1, x2, y2)


def _draw_box(draw: ImageDraw.Draw, coords: tuple, color: tuple, width: int = 3):
    """Draw a rectangle with given color and line width."""
    x1, y1, x2, y2 = coords
    for i in range(width):
        draw.rectangle(
            [x1 - i, y1 - i, x2 + i, y2 + i],
            outline=color
        )


def _draw_label(
    draw: ImageDraw.Draw,
    text: str,
    x: int,
    y: int,
    text_color: tuple,
    bg_color: tuple,
    font: ImageFont.ImageFont
):
    """Draw a filled label rectangle with text."""
    try:
        bbox = font.getbbox(text)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
    except AttributeError:
        tw, th = len(text) * 7, 12

    pad = 4
    rx1, ry1 = x, y - th - pad * 2
    rx2, ry2 = x + tw + pad * 2, y

    draw.rectangle([rx1, ry1, rx2, ry2], fill=bg_color)
    draw.text((rx1 + pad, ry1 + pad), text, fill=text_color, font=font)


def annotate_image(
    image_path: str,
    detection_result: dict,
    output_path: str,
    draw_ppe_boxes: bool = True,
) -> str:
    """
    Draw detection bounding boxes on the image and save the annotated version.

    Args:
        image_path: Path to the original image.
        detection_result: Output from ai_detection.demo_detect().
        output_path: Where to save the annotated image.
        draw_ppe_boxes: Whether to draw individual PPE item boxes.

    Returns:
        Path to the annotated image.
    """
    try:
        img = Image.open(image_path).convert("RGB")
    except Exception as e:
        # If image can't be opened (e.g., video), create a placeholder
        img = _create_placeholder_image()

    img_w, img_h = img.size
    draw = ImageDraw.Draw(img)

    font_large = _get_font(16)
    font_small = _get_font(12)
    font_tiny = _get_font(10)

    workers = detection_result.get("workers", [])

    for worker in workers:
        pbox = worker["bounding_box"]
        coords = _denorm(pbox, img_w, img_h)
        x1, y1, x2, y2 = coords

        # Choose color based on status
        if worker["zone"]["is_restricted"]:
            box_color = COLOR_ZONE_VIOLATION
            bg_color = COLOR_TEXT_BG_ZONE
            status_text = "⚠ ZONE VIOLATION"
        elif worker["is_safe"]:
            box_color = COLOR_SAFE
            bg_color = COLOR_TEXT_BG_SAFE
            status_text = "✓ SAFE"
        else:
            box_color = COLOR_PPE_VIOLATION
            bg_color = COLOR_TEXT_BG_DANGER
            status_text = "✗ PPE VIOLATION"

        # Draw person bounding box (thick)
        _draw_box(draw, coords, box_color, width=3)

        # Draw worker label
        label = f" {worker['worker_label']} | {status_text} "
        _draw_label(draw, label, x1, y1, COLOR_WHITE, bg_color, font_large)

        # Draw confidence
        conf_text = f" Conf: {worker['confidence']:.0%} "
        _draw_label(draw, conf_text, x1, y2, COLOR_WHITE, (30, 30, 30), font_tiny)

        # Draw PPE item boxes
        if draw_ppe_boxes:
            ppe_items = worker.get("ppe", {})
            for ppe_name, ppe_info in ppe_items.items():
                if ppe_info.get("detected") and ppe_info.get("box"):
                    ppe_coords = _denorm(ppe_info["box"], img_w, img_h)
                    # Dashed-like thin box for PPE
                    _draw_box(draw, ppe_coords, COLOR_PPE_ITEM, width=2)
                    ppe_label = f" {ppe_info['display_name']} ✓ "
                    _draw_label(
                        draw, ppe_label,
                        ppe_coords[0], ppe_coords[1],
                        COLOR_WHITE, (30, 58, 138), font_tiny
                    )
                elif not ppe_info.get("detected"):
                    # Draw a small "missing" indicator near where PPE should be
                    missing_box = _get_missing_ppe_location(pbox, ppe_name, img_w, img_h)
                    if missing_box:
                        _draw_box(draw, missing_box, (239, 68, 68), width=1)
                        missing_label = f" {ppe_info['display_name']} ✗ "
                        _draw_label(
                            draw, missing_label,
                            missing_box[0], missing_box[1],
                            COLOR_WHITE, (127, 29, 29), font_tiny
                        )

    # ── Overlay: Demo watermark and summary
    _draw_overlay_summary(draw, detection_result, img_w, img_h, font_small, font_large)

    # Save
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    img.save(output_path, "JPEG", quality=92)
    return output_path


def _get_missing_ppe_location(person_box: dict, ppe_name: str, img_w: int, img_h: int):
    """Estimate where missing PPE should be for visual indicator."""
    offsets = {
        "helmet": (0.15, 0.02, 0.70, 0.22),
        "vest":   (0.10, 0.25, 0.80, 0.35),
        "gloves": (0.05, 0.55, 0.30, 0.20),
        "shoes":  (0.10, 0.78, 0.80, 0.18),
    }
    if ppe_name not in offsets:
        return None

    px, py, pw, ph = person_box["x"], person_box["y"], person_box["w"], person_box["h"]
    ox, oy, ow, oh = offsets[ppe_name]

    x1 = int((px + ox * pw) * img_w)
    y1 = int((py + oy * ph) * img_h)
    x2 = int((px + (ox + ow) * pw) * img_w)
    y2 = int((py + (oy + oh) * ph) * img_h)

    return (x1, y1, x2, y2)


def _draw_overlay_summary(
    draw: ImageDraw.Draw,
    result: dict,
    img_w: int,
    img_h: int,
    font_small,
    font_large
):
    """Draw a semi-transparent summary overlay in the top-right corner."""
    summary = result.get("summary", {})
    lines = [
        "◈ DEMO AI ANALYSIS",
        f"Workers: {summary.get('total_workers', 0)}",
        f"Safe: {summary.get('safe_workers', 0)}",
        f"Violations: {summary.get('ppe_violations', 0)}",
        f"Zone Alerts: {summary.get('zone_violations', 0)}",
        f"Score: {summary.get('safety_score', 0):.1f}%",
    ]

    pad = 10
    line_h = 22
    box_w = 200
    box_h = len(lines) * line_h + pad * 2

    x1 = img_w - box_w - pad
    y1 = pad
    x2 = img_w - pad
    y2 = y1 + box_h

    # Semi-transparent background (draw multiple times to simulate opacity)
    draw.rectangle([x1, y1, x2, y2], fill=(10, 15, 40))

    for j, line in enumerate(lines):
        color = (96, 165, 250) if j == 0 else COLOR_WHITE
        draw.text((x1 + pad, y1 + pad + j * line_h), line, fill=color, font=font_small)


def _create_placeholder_image(width: int = 1280, height: int = 720) -> Image.Image:
    """Create a placeholder image for video files or unreadable images."""
    img = Image.new("RGB", (width, height), color=(15, 23, 42))
    draw = ImageDraw.Draw(img)

    # Draw grid lines
    for x in range(0, width, 80):
        draw.line([(x, 0), (x, height)], fill=(30, 41, 59), width=1)
    for y in range(0, height, 80):
        draw.line([(0, y), (width, y)], fill=(30, 41, 59), width=1)

    # Center text
    font = _get_font(24)
    text = "Video Frame — AI Analysis Applied"
    try:
        bbox = font.getbbox(text)
        tw = bbox[2] - bbox[0]
    except Exception:
        tw = len(text) * 14
    draw.text(((width - tw) // 2, height // 2 - 20), text, fill=(96, 165, 250), font=font)

    return img
