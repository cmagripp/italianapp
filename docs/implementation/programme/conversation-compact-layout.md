# Conversation composer with optional help

The written conversation player now puts reply suggestions and voice controls in one internally scrolling area. The message field, Send button and keyboard toggle retain their space below it, and part of the conversation remains visible above it.

The prior layout used two separately bounded panels. With both open, a 390 × 430 viewport placed the bottom of Send at 510.28 pixels and the keyboard tools at 554.28 pixels. The fixed page prevented reaching them. The corrected layout places those bottoms at 382 and 426 pixels respectively, with the optional controls reachable by scrolling their shared area.

`tests/conversation-compact-e2e.mjs` passes twelve width/height/theme combinations in each of Chromium and WebKit: widths 375, 390 and 430; heights 430 and 480; dark and light themes. It hit-tests the composer controls, reaches both help panels, checks internal rather than page scrolling, and verifies the unchanged unsent draft after a reload. Reports are saved as `conversation-compact-chromium.json` and `conversation-compact-webkit.json`.

The existing player suite also passes nine Chromium checks, reply support five Chromium checks, and speech UI six WebKit checks after the layout change. Generation and speech use explicit test providers. These results validate layout and controller behavior; they do not validate a production AI model, speech quality, a physical keyboard or a physical iPhone.

The source changes have not been deployed. The installed simulator checkpoint remains recorded separately in `installed-checkpoint-lifecycle.json`.
