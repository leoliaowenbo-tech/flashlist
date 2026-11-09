#!/usr/bin/env python3
import os
import sys
import subprocess
import shutil
from PIL import Image

def make_icns(source_png_path, output_icns_path):
    if not os.path.exists(source_png_path):
        print(f"Error: {source_png_path} does not exist")
        return False

    base_dir = os.path.dirname(os.path.abspath(output_icns_path))
    iconset_dir = os.path.join(base_dir, "AppIcon.iconset")
    if os.path.exists(iconset_dir):
        shutil.rmtree(iconset_dir)
    os.makedirs(iconset_dir, exist_ok=True)

    img = Image.open(source_png_path).convert("RGBA")
    
    sizes = [
        (16, "icon_16x16.png"),
        (32, "icon_16x16@2x.png"),
        (32, "icon_32x32.png"),
        (64, "icon_32x32@2x.png"),
        (128, "icon_128x128.png"),
        (256, "icon_128x128@2x.png"),
        (256, "icon_256x256.png"),
        (512, "icon_256x256@2x.png"),
        (512, "icon_512x512.png"),
        (1024, "icon_512x512@2x.png"),
    ]

    for size, filename in sizes:
        resized = img.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(os.path.join(iconset_dir, filename), "PNG")

    cmd = ["iconutil", "-c", "icns", iconset_dir, "-o", output_icns_path]
    res = subprocess.run(cmd, capture_output=True, text=True)
    shutil.rmtree(iconset_dir)

    if res.returncode == 0 and os.path.exists(output_icns_path):
        print(f"Successfully generated ICNS: {output_icns_path}")
        return True
    else:
        print(f"iconutil failed: {res.stderr}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 generate_icns.py <source.png> <output.icns>")
        sys.exit(1)
    make_icns(sys.argv[1], sys.argv[2])
