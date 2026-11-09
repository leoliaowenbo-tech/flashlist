import Cocoa
import WebKit
import AVFoundation
import Speech

// 原生 macOS 语音识别管理器
class SpeechManager: NSObject {
    private let speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "zh-CN"))
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let audioEngine = AVAudioEngine()

    var onResult: ((String, Bool) -> Void)?
    var onError: ((String) -> Void)?

    func start() {
        if audioEngine.isRunning {
            stop()
            return
        }

        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            DispatchQueue.main.async {
                guard let self = self else { return }
                switch status {
                case .authorized:
                    AVCaptureDevice.requestAccess(for: .audio) { granted in
                        DispatchQueue.main.async {
                            if granted {
                                self.startAudioEngine()
                            } else {
                                self.onError?("麦克风权限未开启，请在系统设置中允许访问麦克风")
                            }
                        }
                    }
                case .denied, .restricted:
                    self.onError?("语音识别权限未开启，请在系统设置中允许使用语音识别")
                case .notDetermined:
                    self.onError?("正在等待系统语音授权...")
                @unknown default:
                    self.onError?("语音授权状态异常")
                }
            }
        }
    }

    private func startAudioEngine() {
        recognitionTask?.cancel()
        recognitionTask = nil

        let inputNode = audioEngine.inputNode
        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        guard let recognitionRequest = recognitionRequest else {
            onError?("无法创建语音识别缓冲区")
            return
        }

        recognitionRequest.shouldReportPartialResults = true

        recognitionTask = speechRecognizer?.recognitionTask(with: recognitionRequest) { [weak self] result, error in
            guard let self = self else { return }
            var isFinal = false

            if let result = result {
                let text = result.bestTranscription.formattedString
                isFinal = result.isFinal
                self.onResult?(text, isFinal)
            }

            if error != nil || isFinal {
                self.stop()
            }
        }

        let recordingFormat = inputNode.outputFormat(forBus: 0)
        inputNode.removeTap(onBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
            self.recognitionRequest?.append(buffer)
        }

        audioEngine.prepare()
        do {
            try audioEngine.start()
        } catch {
            onError?("麦克风录音引擎启动失败: \(error.localizedDescription)")
        }
    }

    func stop() {
        if audioEngine.isRunning {
            audioEngine.stop()
            audioEngine.inputNode.removeTap(onBus: 0)
            recognitionRequest?.endAudio()
            recognitionTask?.cancel()
            recognitionTask = nil
            recognitionRequest = nil
        }
    }
}

// 自定义离线 Scheme 处理器
class LocalAppSchemeHandler: NSObject, WKURLSchemeHandler {
    private var baseDir: URL {
        if let distURL = Bundle.main.url(forResource: "dist", withExtension: nil) {
            return distURL
        }
        return Bundle.main.bundleURL.appendingPathComponent("Contents/Resources/dist")
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else { return }
        var path = url.path
        if path.isEmpty || path == "/" {
            path = "/index.html"
        }
        let cleanRelative = path.hasPrefix("/") ? String(path.dropFirst()) : path
        let fileURL = baseDir.appendingPathComponent(cleanRelative)

        if let data = try? Data(contentsOf: fileURL) {
            let mimeType: String
            if path.hasSuffix(".html") { mimeType = "text/html; charset=utf-8" }
            else if path.hasSuffix(".js") || path.hasSuffix(".mjs") { mimeType = "text/javascript; charset=utf-8" }
            else if path.hasSuffix(".css") { mimeType = "text/css; charset=utf-8" }
            else if path.hasSuffix(".svg") { mimeType = "image/svg+xml" }
            else if path.hasSuffix(".json") { mimeType = "application/json" }
            else if path.hasSuffix(".png") { mimeType = "image/png" }
            else if path.hasSuffix(".woff2") { mimeType = "font/woff2" }
            else { mimeType = "application/octet-stream" }

            let response = HTTPURLResponse(
                url: url,
                statusCode: 200,
                httpVersion: "HTTP/1.1",
                headerFields: [
                    "Content-Type": mimeType,
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "no-cache"
                ]
            )!
            urlSchemeTask.didReceive(response)
            urlSchemeTask.didReceive(data)
            urlSchemeTask.didFinish()
        } else {
            let response = HTTPURLResponse(
                url: url,
                statusCode: 404,
                httpVersion: "HTTP/1.1",
                headerFields: nil
            )!
            urlSchemeTask.didReceive(response)
            urlSchemeTask.didFinish()
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}
}

// 支持原生窗口拖拽的 WKWebView
class DraggableWKWebView: WKWebView {
    override func mouseDown(with event: NSEvent) {
        let point = self.convert(event.locationInWindow, from: nil)
        // 顶栏高度（HTML 对应 h-10 即 40px，在 flipped 坐标系中 y <= 44 即为顶栏）
        if point.y <= 44.0 {
            // 避开左侧原生红黄绿交通灯区域（关闭、最小化、全屏按钮）
            if let closeBtn = self.window?.standardWindowButton(.closeButton),
               let minBtn = self.window?.standardWindowButton(.miniaturizeButton),
               let zoomBtn = self.window?.standardWindowButton(.zoomButton) {
                let winPt = event.locationInWindow
                let closeFrame = closeBtn.superview?.convert(closeBtn.frame, to: nil) ?? .zero
                let minFrame = minBtn.superview?.convert(minBtn.frame, to: nil) ?? .zero
                let zoomFrame = zoomBtn.superview?.convert(zoomBtn.frame, to: nil) ?? .zero
                
                if closeFrame.insetBy(dx: -4, dy: -4).contains(winPt) ||
                   minFrame.insetBy(dx: -4, dy: -4).contains(winPt) ||
                   zoomFrame.insetBy(dx: -4, dy: -4).contains(winPt) {
                    super.mouseDown(with: event)
                    return
                }
            }
            // 双击顶栏：触发展开/还原缩放
            if event.clickCount == 2 {
                self.window?.zoom(nil)
                return
            }
            // 单击并拖拽：调用系统原生无缝拖拽移动窗口！
            self.window?.performDrag(with: event)
            return
        }
        super.mouseDown(with: event)
    }
}

class AppDelegate: NSObject, NSApplicationDelegate, WKUIDelegate, WKNavigationDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var webView: DraggableWKWebView!
    let schemeHandler = LocalAppSchemeHandler()
    let speechManager = SpeechManager()

    func applicationDidFinishLaunching(_ notification: Notification) {
        if let iconURL = Bundle.main.url(forResource: "AppIcon", withExtension: "icns"),
           let iconImg = NSImage(contentsOf: iconURL) {
            NSApp.applicationIconImage = iconImg
        }

        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")
        config.setURLSchemeHandler(schemeHandler, forURLScheme: "app")
        
        let webpagePrefs = WKWebpagePreferences()
        webpagePrefs.allowsContentJavaScript = true
        config.defaultWebpagePreferences = webpagePrefs

        config.userContentController.add(self, name: "nativeSpeech")

        speechManager.onResult = { [weak self] text, isFinal in
            let escaped = text.replacingOccurrences(of: "\\", with: "\\\\")
                              .replacingOccurrences(of: "'", with: "\\'")
                              .replacingOccurrences(of: "\n", with: "\\n")
            let js = "window.onNativeSpeechResult && window.onNativeSpeechResult('\(escaped)', \(isFinal ? "true" : "false"));"
            self?.webView.evaluateJavaScript(js)
        }

        speechManager.onError = { [weak self] errMsg in
            let escaped = errMsg.replacingOccurrences(of: "'", with: "\\'")
            let js = "window.onNativeSpeechError && window.onNativeSpeechError('\(escaped)');"
            self?.webView.evaluateJavaScript(js)
        }

        let screenRect = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1200, height: 800)
        let windowWidth: CGFloat = 1100
        let windowHeight: CGFloat = 750
        let windowRect = NSRect(
            x: (screenRect.width - windowWidth) / 2 + screenRect.minX,
            y: (screenRect.height - windowHeight) / 2 + screenRect.minY,
            width: windowWidth,
            height: windowHeight
        )

        window = NSWindow(
            contentRect: windowRect,
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )

        window.title = "闪念清单 · 桌面版"
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        window.minSize = NSSize(width: 850, height: 550)
        window.isReleasedWhenClosed = false

        // 核心修复：开启窗口背景可拖动，支持拖拽顶栏随意移动窗口！
        window.isMovableByWindowBackground = true

        webView = DraggableWKWebView(frame: window.contentView!.bounds, configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.uiDelegate = self
        webView.navigationDelegate = self
        webView.setValue(false, forKey: "drawsBackground")

        window.contentView?.addSubview(webView)

        if let appURL = URL(string: "app://localhost/index.html") {
            webView.load(URLRequest(url: appURL))
        }

        setupMainMenu()

        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "nativeSpeech" {
            if let cmd = message.body as? String {
                if cmd == "start" {
                    speechManager.start()
                } else if cmd == "stop" {
                    speechManager.stop()
                }
            }
        }
    }

    @available(macOS 12.0, *)
    func webView(
        _ webView: WKWebView,
        requestMediaCapturePermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        type: WKMediaCaptureType,
        decisionHandler: @escaping (WKPermissionDecision) -> Void
    ) {
        decisionHandler(.grant)
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = NSAlert()
        alert.messageText = "提示"
        alert.informativeText = message
        alert.alertStyle = .informational
        alert.addButton(withTitle: "确定")
        alert.runModal()
        completionHandler()
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert()
        alert.messageText = "确认"
        alert.informativeText = message
        alert.alertStyle = .warning
        alert.addButton(withTitle: "确定")
        alert.addButton(withTitle: "取消")
        let response = alert.runModal()
        completionHandler(response == .alertFirstButtonReturn)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let alert = NSAlert()
        alert.messageText = prompt
        let input = NSTextField(frame: NSRect(x: 0, y: 0, width: 260, height: 24))
        input.stringValue = defaultText ?? ""
        alert.accessoryView = input
        alert.addButton(withTitle: "确定")
        alert.addButton(withTitle: "取消")
        let response = alert.runModal()
        if response == .alertFirstButtonReturn {
            completionHandler(input.stringValue)
        } else {
            completionHandler(nil)
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }

    private func setupMainMenu() {
        let mainMenu = NSMenu()

        let appMenuItem = NSMenuItem()
        mainMenu.addItem(appMenuItem)
        let appMenu = NSMenu()
        appMenuItem.submenu = appMenu
        appMenu.addItem(withTitle: "关于 闪念清单", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "隐藏 闪念清单", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        let hideOthers = NSMenuItem(title: "隐藏其他", action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h")
        hideOthers.keyEquivalentModifierMask = [.command, .option]
        appMenu.addItem(hideOthers)
        appMenu.addItem(withTitle: "显示全部", action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "退出 闪念清单", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        let editMenuItem = NSMenuItem()
        mainMenu.addItem(editMenuItem)
        let editMenu = NSMenu(title: "编辑")
        editMenuItem.submenu = editMenu
        editMenu.addItem(withTitle: "撤销", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "重做", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(NSMenuItem.separator())
        editMenu.addItem(withTitle: "剪切", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "复制", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "粘贴", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "全选", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")

        let windowMenuItem = NSMenuItem()
        mainMenu.addItem(windowMenuItem)
        let windowMenu = NSMenu(title: "窗口")
        windowMenuItem.submenu = windowMenu
        windowMenu.addItem(withTitle: "最小化", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "缩放", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
        windowMenu.addItem(withTitle: "关闭窗口", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")

        NSApp.mainMenu = mainMenu
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
