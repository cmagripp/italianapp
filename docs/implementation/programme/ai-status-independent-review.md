# Independent history and offline availability review

Reviewed `js/views/learningHistory.js`, `js/views/offlineAI.js`, the two profile lazy-import hooks and the shared evidence/provider contracts. Four additional browser checks pass in Chromium and WebKit; raw reports are `ai-status-audit-chromium.json` and `ai-status-audit-webkit.json`. Reproduction is `tests/ai-status-independent-e2e.mjs`, now included in browser CI for both engines.

The views do not grade, complete lessons, award recall, acquire generation, download assets or change learner state. The audit compares the entire profile JSON before and after history searching, tab switching, availability/provider changes and late storage estimation. It remains equal. A learning epoch reset closes both sheets; a late storage estimate cannot reopen them. Existing programme navigation checks cover changing to another learner. Recognition, supported answers, ungraded answers and independent grammar checks retain the shared evidence model's distinct labels.

Availability follows the installed provider, including separate written, recorded and hands-free flags. The injected provider in this test is explicitly test-only and throws if generation is acquired. Mode flags appearing in this audit establish UI behavior, not an installed production model, offline device qualification or Italian quality. Production availability remains closed.

One defensive source-review finding: the outer profile lazy-import hooks initially captured profile ID and epoch but omitted learner ID. The modules themselves capture and compare all three. Root has added learner ID to both outer guards; independently re-reading the saved hooks confirms all three are compared after the await. This rejects an identity replacement retaining profile/epoch from opening a dialog from an earlier request. This is separate from any state-write or false-mastery finding; neither was observed.

The storage estimate is a browser quota estimate, not guaranteed persistent space. The review does not establish installed-PWA/cold-start behavior, human speech quality or model approval.
