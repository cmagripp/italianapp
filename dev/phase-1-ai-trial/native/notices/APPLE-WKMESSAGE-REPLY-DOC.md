<!--
{
  "availability" : [
    "iOS: -",
    "iPadOS: -",
    "macCatalyst: -",
    "macOS: -",
    "visionOS: -"
  ],
  "documentType" : "symbol",
  "framework" : "WebKit",
  "identifier" : "/documentation/WebKit/WKScriptMessageHandlerWithReply",
  "metadataVersion" : "0.1.0",
  "role" : "Protocol",
  "symbol" : {
    "kind" : "Protocol",
    "modules" : [
      "WebKit"
    ],
    "preciseIdentifier" : "c:objc(pl)WKScriptMessageHandlerWithReply"
  },
  "title" : "WKScriptMessageHandlerWithReply"
}
-->

# WKScriptMessageHandlerWithReply

An interface for responding to messages from JavaScript code running in a webpage.

```
@MainActor protocol WKScriptMessageHandlerWithReply : NSObjectProtocol
```

## Overview

Adopt the [`WKScriptMessageHandlerWithReply`](/documentation/WebKit/WKScriptMessageHandlerWithReply) protocol when your app needs to receive JavaScript messages from a web view and provide an appropriate response. When JavaScript code sends a message that specifically targets your message handler, WebKit calls your handler’s [`userContentController(_:didReceive:replyHandler:)`](/documentation/WebKit/WKScriptMessageHandlerWithReply/userContentController(_:didReceive:replyHandler:)) method. Use that method to process the message and provide your response.

To call your message handler from JavaScript, send a message to `window.webkit.messageHandlers.<messageHandlerName>.postMessage(<messageBody>)` in your code. You specify the name of your message handler when you add it to a [`WKUserContentController`](/documentation/WebKit/WKUserContentController) object.

> Note:
> If you don’t need to provide a response back to JavaScript, implement your message handler using the ``doc://com.apple.webkit/documentation/WebKit/WKScriptMessageHandler`` protocol instead.

## Topics

### Receiving Messages

[`func userContentController(WKUserContentController, didReceive: WKScriptMessage, replyHandler: (Any?, String?) -> Void)`](/documentation/WebKit/WKScriptMessageHandlerWithReply/userContentController(_:didReceive:replyHandler:))

Tells the handler that a webpage sent a script message that included a reply.

[`class WKScriptMessage`](/documentation/WebKit/WKScriptMessage)

An object that encapsulates a message sent by JavaScript code from a webpage.

## Relationships

### Inherits From

[`NSObjectProtocol`](/documentation/ObjectiveC/NSObjectProtocol)

---

Copyright &copy; 2026 Apple Inc. All rights reserved. | [Terms of Use](https://www.apple.com/legal/internet-services/terms/site.html) | [Privacy Policy](https://www.apple.com/privacy/privacy-policy)