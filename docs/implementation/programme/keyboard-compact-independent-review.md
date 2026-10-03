# Shared keyboard and compact Conversation independent review

The bounded source review passes with no blocker found in the current shared modal/dropdown focus and compact composer changes. Source SHA-256 fingerprints and inspected test reports are recorded in `keyboard-compact-independent-review.json`. Root executed 13 keyboard checks and 12 compact viewport cases in each of Chromium and WebKit; this reviewer inspected their implementation and evidence independently.

The modal helper excludes invisible, inert, disabled-fieldset and closed-detail controls; radio groups retain one Tab stop and native arrow selection. Topmost-sheet ownership and nested-sheet focus restoration remain explicit. Dropdown Tab closes the menu and continues the surrounding sheet, and redraw replaces focus on its new trigger. Prompt Enter cannot reactivate the restored opener, and cancelled focus timers cannot focus a dismissed prompt.

Reply support and voice controls share one bounded scroll area. The draft, Send and keyboard controls stay outside it; the inspected fixture checks hit targets and viewport containment for both themes at six compact sizes and preserves the exact unsent draft on reload. No transcript or controller semantics were changed by this layout slice.

This is source/browser-fixture evidence only. Physical keyboard, VoiceOver, device and native-human validation remain separate gates. The Conversation fixture uses an explicit test provider and establishes no production-model claim.
