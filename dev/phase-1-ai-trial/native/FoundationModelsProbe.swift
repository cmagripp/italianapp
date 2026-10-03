import Foundation
import FoundationModels

// Investigation CLI only. It never changes Apple Intelligence settings,
// downloads model packs, or participates in the browser application's runtime.
@Generable
struct Correction: Codable {
    var original: String
    var replacement: String
    var ruleId: String
    var reason: String
}

@Generable
struct Reply: Codable {
    var participantId: String
    var text: String
    @Guide(.maximumCount(1)) var corrections: [Correction]
}

struct Probe: Codable {
    var id: String
    var variant: String
    var instructions: String
    var prompt: String
}

func emit(_ value: [String: Any]) throws {
    let data = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data([10]))
}

@main struct FoundationModelsProbe {
    static func main() async throws {
        let model = SystemLanguageModel.default
        let status: String
        switch model.availability {
        case .available: status = "available"
        case .unavailable(let reason): status = String(describing: reason)
        }
        let supportsItalian = model.supportsLocale(Locale(identifier: "it_IT"))
        try emit(["kind": "availability", "availability": status,
                  "supportsItalian": supportsItalian,
                  "supportedLanguages": model.supportedLanguages.map { String(describing: $0) }.sorted(),
                  "os": ProcessInfo.processInfo.operatingSystemVersionString,
                  "runtime": "FoundationModels SystemLanguageModel.default",
                  "modelRevision": NSNull(), "tokens": NSNull(),
                  "scope": "physical Mac only; no iPhone proof; system-managed model has no revision API used here"])
        guard status == "available", supportsItalian,
              !CommandLine.arguments.contains("--availability"), CommandLine.arguments.count > 1 else { return }
        let cases = try JSONDecoder().decode([Probe].self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
        for probe in cases {
            let session = LanguageModelSession(model: model, instructions: "The person's locale is it_IT. You MUST respond in Italian.\n" + probe.instructions)
            let started = Date()
            do {
                if probe.variant == "grounded" {
                    let response = try await session.respond(to: probe.prompt, generating: Reply.self,
                        options: GenerationOptions(sampling: .greedy, maximumResponseTokens: 512))
                    let raw = String(data: try JSONEncoder().encode(response.content), encoding: .utf8)!
                    try emit(["kind": "response", "id": probe.id, "variant": probe.variant, "raw": raw,
                              "elapsedMs": Date().timeIntervalSince(started) * 1000, "ok": true])
                } else {
                    let response = try await session.respond(to: probe.prompt,
                        options: GenerationOptions(sampling: .greedy, maximumResponseTokens: 512))
                    try emit(["kind": "response", "id": probe.id, "variant": probe.variant, "raw": response.content,
                              "elapsedMs": Date().timeIntervalSince(started) * 1000, "ok": true])
                }
            } catch {
                try emit(["kind": "response", "id": probe.id, "variant": probe.variant,
                          "elapsedMs": Date().timeIntervalSince(started) * 1000, "ok": false,
                          "error": String(describing: error)])
            }
        }
    }
}
