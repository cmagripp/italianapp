# Lesson action labels at enlarged text

The bounded footer fix passes8 checks in Chromium and8 in WebKit, in both themes. The real first-contact portfolio cropped “Continue without a response” at200% text. Its deferred finish also cropped “Return to unfinished skills” and “Next lesson · Thank and ask politely”. Before measurements and exact source fingerprints are in `learning-text-reflow-contract.json`.

Only `css/grammar-course.css` changes runtime behavior: footer buttons wrap and grow, and implicit grid rows retain their intrinsic height. The existing footer scroll bounds remain. Tests require each full label to stay inside its button and the visible footer, remain reachable after scrolling, and avoid horizontal page overflow.

The actual route/controller/storage cases also preserve the learner’s place: empty portfolio continuation adds no answer evidence, XP or word completion; exact draft and selected step survive reload; following the next-lesson link retains the deferred original session.

Measurements use uniform computed-font/line-height200% at375×667 and normal-font320×225 CSS reflow, equivalent in layout size to400% zoom of a1280×900 window. These are controlled proxies, not native OS text settings, browser UI zoom or physical devices. Screen-reader and full accessibility conformance remain separate gates. Earlier scratch answer-control probes found no unreachable controls on the four tested word/verb/game/Review routes; no broader catalogue claim is made.
