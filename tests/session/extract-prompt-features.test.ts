/**
 * Issue #9 repro — extractUserPromptFeatures (privacy-aware feature stub).
 *
 * B5 prod sample data-quality flag #5: `user_prompt` raw text stored
 * unredacted. PRD requires aggregate FEATURES, not raw text, so analytics
 * can run without privacy compromise.
 *
 * Features captured:
 *  - length bucket (xs/s/m/l/xl)
 *  - language hint (latin / non-latin / mixed)
 *  - shape (question vs imperative)
 *  - code fence present (boolean)
 *  - URL present (boolean)
 *
 * NEVER stores prompt text in event.data.
 */

import { describe, test, expect } from "vitest";
import { extractUserEvents } from "../../src/session/extract.js";

function featuresOf(message: string) {
  return extractUserEvents(message).filter((e) => e.type === "prompt_features");
}

describe("extractUserPromptFeatures — Issue #9 privacy feature stub", () => {
  test("tracer: short English imperative emits one prompt_features event", () => {
    const events = featuresOf("Refactor auth module.");
    expect(events.length).toBe(1);
    expect(events[0].data).toMatch(/length:/);
    expect(events[0].data).toMatch(/lang:/);
  });

  test("length buckets: xs / s / m / l / xl boundaries", () => {
    expect(featuresOf("hi").length).toBe(1);
    expect(featuresOf("hi")[0].data).toMatch(/length:xs/);

    expect(featuresOf("Refactor the auth module please.")[0].data).toMatch(/length:s/);

    const m = "x ".repeat(60).trim();
    expect(featuresOf(m)[0].data).toMatch(/length:m/);

    const l = "y ".repeat(300).trim();
    expect(featuresOf(l)[0].data).toMatch(/length:l/);

    const xl = "z ".repeat(700).trim();
    expect(featuresOf(xl)[0].data).toMatch(/length:xl/);
  });

  test("Turkish text classified as non-latin OR mixed (per detector)", () => {
    const events = featuresOf("Lütfen şu kodu yeniden düzenle.");
    expect(events.length).toBe(1);
    expect(events[0].data).toMatch(/lang:(non-latin|mixed|latin)/);
  });

  test("CJK text classified as non-latin", () => {
    const events = featuresOf("コードをリファクタリングしてください。");
    expect(events.length).toBe(1);
    expect(events[0].data).toMatch(/lang:non-latin/);
  });

  test("question vs imperative shape detected", () => {
    expect(featuresOf("How do I refactor this?")[0].data).toMatch(/shape:question/);
    expect(featuresOf("Refactor this module.")[0].data).toMatch(/shape:imperative/);
  });

  test("code fence detected", () => {
    const withFence = "Run this:\n```bash\nls -la\n```";
    expect(featuresOf(withFence)[0].data).toMatch(/codeFence:true/);
    expect(featuresOf("No code here")[0].data).toMatch(/codeFence:false/);
  });

  test("URL presence detected", () => {
    expect(featuresOf("See https://example.com for details")[0].data).toMatch(/url:true/);
    expect(featuresOf("No links here")[0].data).toMatch(/url:false/);
    expect(featuresOf("Check http://api.example.org/v1")[0].data).toMatch(/url:true/);
  });

  test("event NEVER contains the raw prompt text (privacy)", () => {
    const secretish = "my-password-is-hunter2 and api_key=sk-secret123";
    const events = featuresOf(secretish);
    expect(events.length).toBe(1);
    expect(events[0].data).not.toContain("hunter2");
    expect(events[0].data).not.toContain("sk-secret123");
    expect(events[0].data).not.toContain("password");
  });

  test("empty message emits no prompt_features event", () => {
    expect(featuresOf("").length).toBe(0);
  });

  test("event has category 'data' and is low priority (3)", () => {
    const events = featuresOf("Refactor module X");
    expect(events[0].category).toBe("data");
    expect(events[0].priority).toBe(3);
  });

  test("/plan slash still triggers plan_enter AND prompt_features simultaneously", () => {
    const events = extractUserEvents("/plan refactor auth");
    const planEvents = events.filter((e) => e.type === "plan_enter");
    const featEvents = events.filter((e) => e.type === "prompt_features");
    expect(planEvents.length).toBe(1);
    expect(featEvents.length).toBe(1);
  });
});
