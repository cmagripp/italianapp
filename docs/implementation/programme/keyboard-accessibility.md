# Keyboard and modal focus review

The shared modal controls now retain keyboard position after a dropdown changes its own trigger. Workshop agreement and Conversation setup preserve the unfinished input and focus the replacement control; participant counters move to the remaining enabled control at their upper and lower limits.

The first WebKit run reproduced Tab leaving an open Conversation setup sheet and landing on the page body after closing its level dropdown. Safari's native Tab order can skip buttons. `js/focus.js` now walks visible, enabled modal controls explicitly; shared sheets and menus nested inside them use that same helper. Hidden or disabled controls and unopened detail contents are excluded. Escape closes the top menu first, and a nested sheet returns focus to its parent.

Shared text-entry prompts have a programmatic name. Cancellation clears their delayed autofocus, and Enter consumes its keyboard event before returning focus. The second WebKit run exposed why that last step matters: without it, Enter could activate the restored opener and immediately open a new sheet. The corrected implementation preserves the submitted text and returns to the intended control once.

`tests/programme-keyboard-e2e.mjs` passes thirteen checks in Chromium and thirteen in WebKit, with zero page errors. Both themes cover the real Workshop and Conversation controls; separate shared-component fixtures cover early prompt dismissal, nested sheets, collapsed details, disabled fieldsets and native arrow-key selection within a radio group. The Workshop preference check asserts that no learning event or XP is created. Reports are `keyboard-accessibility-chromium.json` and `keyboard-accessibility-webkit.json`.

These are browser keyboard and DOM accessibility checks. They do not establish VoiceOver behavior, physical iPhone input, Dynamic Type or 200% text reflow. Those remain separate programme gates.
