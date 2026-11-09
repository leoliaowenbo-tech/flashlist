#!/usr/bin/env python3
import os
import sys
from PIL import Image

def make_ico(source_png_path, output_ico_path):
    if not os.path.exists(source_png_path):
        print(f"Error: {source_png_path} does not exist")
        return False

    os.makedirs(os.path.dirname(os.path.abspath(output_ico_path)), exist_ok=True)
    img = Image.open(source_png_path).convert("RGBA")
    
    # Windows icon sizes
    sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    
    # Save as multi-resolution ICO file
    img.save(output_ico_path, format="ICO", sizes=sizes)
    print(f"Successfully generated ICO: {output_ico_path} with sizes: {sizes}")
    return True

if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else "public/app-icon.png"
    dest = sys.argv[2] if len(sys.argv) > 2 else "build/icon.ico"
    make_ico(src, dest)
