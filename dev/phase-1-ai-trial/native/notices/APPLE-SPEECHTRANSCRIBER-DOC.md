<!--
{
  "availability" : [
    "iOS: 26.0.0 -",
    "iPadOS: 26.0.0 -",
    "macCatalyst: 26.0.0 -",
    "macOS: 26.0.0 -",
    "tvOS: 26.0.0 -",
    "visionOS: 26.0.0 -"
  ],
  "documentType" : "symbol",
  "framework" : "Speech",
  "identifier" : "/documentation/Speech/SpeechTranscriber",
  "metadataVersion" : "0.1.0",
  "role" : "Class",
  "symbol" : {
    "kind" : "Class",
    "modules" : [
      "Speech"
    ],
    "preciseIdentifier" : "s:6Speech0A11TranscriberC"
  },
  "title" : "SpeechTranscriber"
}
-->

# SpeechTranscriber

A speech-to-text transcription module that’s appropriate for normal conversation and general purposes.

```
final class SpeechTranscriber
```

## Overview

Several transcriber instances can share the same backing engine instances and models, so long as the transcribers are configured similarly in certain respects.

### Check device support

Use the [`isAvailable`](/documentation/Speech/SpeechTranscriber/isAvailable) or [`supportedLocales`](/documentation/Speech/SpeechTranscriber/supportedLocales) properties to see if the current device supports the speech-to-text models used by `SpeechTranscriber`. If it does not, consider disabling the feature or using [`DictationTranscriber`](/documentation/Speech/DictationTranscriber) instead.

## Topics

### Creating a transcriber

[`convenience init(locale: Locale, preset: SpeechTranscriber.Preset)`](/documentation/Speech/SpeechTranscriber/init(locale:preset:))

Creates a general-purpose transcriber according to a preset.

[`convenience init(locale: Locale, transcriptionOptions: Set<SpeechTranscriber.TranscriptionOption>, reportingOptions: Set<SpeechTranscriber.ReportingOption>, attributeOptions: Set<SpeechTranscriber.ResultAttributeOption>)`](/documentation/Speech/SpeechTranscriber/init(locale:transcriptionOptions:reportingOptions:attributeOptions:))

Creates a general-purpose transcriber.

[`struct Preset`](/documentation/Speech/SpeechTranscriber/Preset)

Predefined transcriber configurations.

### Configuring transcription

[`enum ReportingOption`](/documentation/Speech/SpeechTranscriber/ReportingOption)

Options relating to the transcriber’s result delivery.

[`enum ResultAttributeOption`](/documentation/Speech/SpeechTranscriber/ResultAttributeOption)

Options relating to the attributes of the transcription.

[`enum TranscriptionOption`](/documentation/Speech/SpeechTranscriber/TranscriptionOption)

Options relating to the text of the transcription.

### Checking device support

[`static var isAvailable: Bool`](/documentation/Speech/SpeechTranscriber/isAvailable)

A Boolean value that indicates whether this module is available given the device’s hardware and capabilities.

### Checking locale support

[`static var installedLocales: [Locale]`](/documentation/Speech/SpeechTranscriber/installedLocales)

The locales that the transcriber can transcribe into, considering only locales that are installed on the device.

[`static var supportedLocales: [Locale]`](/documentation/Speech/SpeechTranscriber/supportedLocales)

The locales that the transcriber can transcribe into, including locales that may not be installed but are downloadable.

[`static func supportedLocale(equivalentTo: Locale) async -> Locale?`](/documentation/Speech/SpeechTranscriber/supportedLocale(equivalentTo:))

A locale from the module’s supported locales equivalent to the given locale.

### Checking audio format support

### Getting results

[`var results: some Sendable & AsyncSequence<SpeechTranscriber.Result, any Error>`](/documentation/Speech/SpeechTranscriber/results)

The asynchronous sequence of transcription results.

[`struct Result`](/documentation/Speech/SpeechTranscriber/Result)

A phrase or passage of transcribed speech. The phrases are sent in order.

### Inspecting the transcriber

## Relationships

### Conforms To

[`SpeechModule`](/documentation/Speech/SpeechModule)

[`SendableMetatype`](/documentation/Swift/SendableMetatype)

[`Sendable`](/documentation/Swift/Sendable)

[`LocaleDependentSpeechModule`](/documentation/Speech/LocaleDependentSpeechModule)

---

Copyright &copy; 2026 Apple Inc. All rights reserved. | [Terms of Use](https://www.apple.com/legal/internet-services/terms/site.html) | [Privacy Policy](https://www.apple.com/privacy/privacy-policy)