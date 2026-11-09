#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

APP_NAME="闪念清单"
EXE_NAME="FlashList"
BUILD_DIR="$PROJECT_DIR/build"
APP_BUNDLE="$BUILD_DIR/$APP_NAME.app"
DMG_STAGE="$BUILD_DIR/dmg_stage"
OUTPUT_DMG="$PROJECT_DIR/闪念清单-1.0.0.dmg"

echo "=== 1. 构建前端生产资源 ==="
npm run build

echo "=== 2. 创建 macOS App 结构 ==="
rm -rf "$BUILD_DIR" "$OUTPUT_DMG"
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources"

echo "=== 3. 编译原生 Swift 启动器 (兼容 macOS 14+) ==="
swiftc -O -target arm64-apple-macos14.0 src-mac/main.swift -o "$APP_BUNDLE/Contents/MacOS/$EXE_NAME"

echo "=== 4. 拷贝资源与配置 ==="
cp "src-mac/Info.plist" "$APP_BUNDLE/Contents/Info.plist"
if [ -f "src-mac/AppIcon.icns" ]; then
    cp "src-mac/AppIcon.icns" "$APP_BUNDLE/Contents/Resources/AppIcon.icns"
fi
cp -R "dist" "$APP_BUNDLE/Contents/Resources/dist"

echo "=== 5. 对 App 进行本地自签名 ==="
codesign --force --deep --sign - "$APP_BUNDLE"

echo "=== 6. 构建 DMG 安装映像 ==="
mkdir -p "$DMG_STAGE"
cp -R "$APP_BUNDLE" "$DMG_STAGE/"
ln -s /Applications "$DMG_STAGE/Applications"

hdiutil create -volname "$APP_NAME" \
  -srcfolder "$DMG_STAGE" \
  -ov -format UDZO \
  "$OUTPUT_DMG"

rm -rf "$DMG_STAGE"

echo "=== DMG 打包完成: $OUTPUT_DMG ==="
