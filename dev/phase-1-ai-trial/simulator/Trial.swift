import UIKit
import WebKit

@main final class TrialDelegate: UIResponder, UIApplicationDelegate, WKScriptMessageHandler {
    var window: UIWindow?
    var webView: WKWebView!
    func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let configuration = WKWebViewConfiguration()
        configuration.userContentController.add(self, name: "trial")
        configuration.allowsInlineMediaPlayback = true
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.isInspectable = true
        let controller = UIViewController()
        controller.view = webView
        window = UIWindow(frame: UIScreen.main.bounds)
        window?.rootViewController = controller
        window?.makeKeyAndVisible()
        webView.load(URLRequest(url: URL(string: "http://127.0.0.1:8132/")!))
        return true
    }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any] else { return }
        if body["ready"] as? Bool == true {
            webView.evaluateJavaScript("window.trial.probe().then(r => window.webkit.messageHandlers.trial.postMessage({probe:r})); true")
        }
        if let probe = body["probe"] {
            let output: [String: Any] = ["kind":"iPhone16ProMax-simulator-WKWebView-probe", "simulatedOS":UIDevice.current.systemVersion, "simulatedModel":"iPhone 16 Pro Max", "environment":probe, "timingHost":"Mac host; not physical iPhone performance"]
            if let data = try? JSONSerialization.data(withJSONObject: output, options: [.prettyPrinted, .sortedKeys]) {
                let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
                try? data.write(to: documents.appendingPathComponent("probe.json"))
                print(String(data: data, encoding: .utf8)!)
            }
        }
    }
}
