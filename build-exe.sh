#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo "=== 1. 检查并生成 Windows 图标 (.ico) ==="
if [ ! -f "build/icon.ico" ]; then
    python3 scripts/generate_ico.py public/app-icon.png build/icon.ico
fi

echo "=== 2. 构建前端生产资源与打包 Windows 安装包 ==="
npm run build:win

echo "=== 3. 同步安装包到项目根目录 ==="
cp release/闪念清单-Setup-1.0.0.exe ./

echo "=== Windows 安装包构建完成: $PROJECT_DIR/闪念清单-Setup-1.0.0.exe ==="
