<!--
{
  "availability" : [
    "iOS: 9.0.0 -",
    "iPadOS: 9.0.0 -",
    "macCatalyst: 13.1.0 -",
    "macOS: 10.11.0 -",
    "visionOS: 1.0.0 -"
  ],
  "documentType" : "symbol",
  "framework" : "WebKit",
  "identifier" : "/documentation/WebKit/WKWebsiteDataStore",
  "metadataVersion" : "0.1.0",
  "role" : "Class",
  "symbol" : {
    "kind" : "Class",
    "modules" : [
      "WebKit"
    ],
    "preciseIdentifier" : "c:objc(cs)WKWebsiteDataStore"
  },
  "title" : "WKWebsiteDataStore"
}
-->

# WKWebsiteDataStore

An object that manages cookies, disk and memory caches, and other types of data for a web view.

```
@MainActor class WKWebsiteDataStore
```

## Overview

Use a [`WKWebsiteDataStore`](/documentation/WebKit/WKWebsiteDataStore) object to configure and manage web site data. Specifically, use this object to:

- Manage cookies that your web site uses
- Learn about the types of data that websites store
- Remove unwanted web site data

Create a data store object and assign it to the [`websiteDataStore`](/documentation/WebKit/WKWebViewConfiguration/websiteDataStore) property of a [`WKWebViewConfiguration`](/documentation/WebKit/WKWebViewConfiguration) object before you create your web view.

By default, `WKWebViewConfiguration` uses the default data store returned by the [`default()`](/documentation/WebKit/WKWebsiteDataStore/default()) method, which saves website data persistently to disk.

To implement private browsing, create a nonpersistent data store using the [`nonPersistent()`](/documentation/WebKit/WKWebsiteDataStore/nonPersistent()) method instead.

To implement profile browsing, create a persistent data store using the [`init(forIdentifier:)`](/documentation/WebKit/WKWebsiteDataStore/init(forIdentifier:)) method, passing an identifier that you use to identify the data store.

## Topics

### Creating a data store object

[`class func `default`() -> WKWebsiteDataStore`](/documentation/WebKit/WKWebsiteDataStore/default())

Returns the default data store, which stores data persistently to disk.

[`class func nonPersistent() -> WKWebsiteDataStore`](/documentation/WebKit/WKWebsiteDataStore/nonPersistent())

Creates a new data store object that stores website data in memory, and doesn’t write that data to disk.

[`init(forIdentifier: UUID)`](/documentation/WebKit/WKWebsiteDataStore/init(forIdentifier:))

Returns the persistent data store with the unique identifier you provide.

### Finding data stores

[`class func fetchAllDataStoreIdentifiers(([UUID]) -> Void)`](/documentation/WebKit/WKWebsiteDataStore/fetchAllDataStoreIdentifiers(_:))

Fetches an array of identifiers from existing data stores that have identifiers.

### Inspecting data store properties

[`var identifier: UUID?`](/documentation/WebKit/WKWebsiteDataStore/identifier)

An identifier that uniquely identifies a data store.

[`var isPersistent: Bool`](/documentation/WebKit/WKWebsiteDataStore/isPersistent)

A Boolean value that indicates whether this object stores data to disk.

### Retrieving a cookie store

[`var httpCookieStore: WKHTTPCookieStore`](/documentation/WebKit/WKWebsiteDataStore/httpCookieStore)

The object that manages the HTTP cookies for your website.

### Retrieving specific types of data

[`func fetchDataRecords(ofTypes: Set<String>, completionHandler: ([WKWebsiteDataRecord]) -> Void)`](/documentation/WebKit/WKWebsiteDataStore/fetchDataRecords(ofTypes:completionHandler:))

Fetches the specified types of records from the data store.

[`class func allWebsiteDataTypes() -> Set<String>`](/documentation/WebKit/WKWebsiteDataStore/allWebsiteDataTypes())

Returns the set of all the available data types.

### Removing specific types of data

[`func removeData(ofTypes: Set<String>, for: [WKWebsiteDataRecord], completionHandler: () -> Void)`](/documentation/WebKit/WKWebsiteDataStore/removeData(ofTypes:for:completionHandler:))

Removes the specified types of website data from one or more data records.

[`func removeData(ofTypes: Set<String>, modifiedSince: Date, completionHandler: () -> Void)`](/documentation/WebKit/WKWebsiteDataStore/removeData(ofTypes:modifiedSince:completionHandler:))

Removes website data that changed after the specified date.

### Removing a data store

[`class func remove(forIdentifier: UUID, completionHandler: ((any Error)?) -> Void)`](/documentation/WebKit/WKWebsiteDataStore/remove(forIdentifier:completionHandler:))

Removes the data store that matches the identifier you provide.

### Initializers

[`init?(coder: NSCoder)`](/documentation/WebKit/WKWebsiteDataStore/init(coder:))

### Instance Properties

[`var proxyConfigurations: [ProxyConfiguration]`](/documentation/WebKit/WKWebsiteDataStore/proxyConfigurations-cdc1)

### Instance Methods

[`func fetchData(of: Set<String>, completionHandler: (Data?, (any Error)?) -> Void)`](/documentation/WebKit/WKWebsiteDataStore/fetchData(of:completionHandler:))

[`func restoreData(Data, completionHandler: ((any Error)?) -> Void)`](/documentation/WebKit/WKWebsiteDataStore/restoreData(_:completionHandler:))

## Relationships

### Conforms To

[`Hashable`](/documentation/Swift/Hashable)

[`CVarArg`](/documentation/Swift/CVarArg)

[`NSObjectProtocol`](/documentation/ObjectiveC/NSObjectProtocol)

[`Equatable`](/documentation/Swift/Equatable)

[`NSSecureCoding`](/documentation/Foundation/NSSecureCoding)

[`NSCoding`](/documentation/Foundation/NSCoding)

[`CustomStringConvertible`](/documentation/Swift/CustomStringConvertible)

[`Sendable`](/documentation/Swift/Sendable)

[`CustomDebugStringConvertible`](/documentation/Swift/CustomDebugStringConvertible)

### Inherits From

[`NSObject-swift.class`](/documentation/ObjectiveC/NSObject-swift.class)

---

Copyright &copy; 2026 Apple Inc. All rights reserved. | [Terms of Use](https://www.apple.com/legal/internet-services/terms/site.html) | [Privacy Policy](https://www.apple.com/privacy/privacy-policy)