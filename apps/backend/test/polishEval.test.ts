import { describe, expect, it } from "vitest";
import {
  POLISH_EVAL_SAMPLES,
  formatPolishEval,
  polishEvalPolisher,
  runPolishEval,
  scriptOf,
} from "../src/lib/polishEval.js";
import { createFakeTextPolisher, TextPolishError, type TextKind } from "../src/lib/textPolisher.js";

describe("the AI polish prompt eval", () => {
  it("covers six customer reports and five service descriptions", () => {
    const labels = (kind: TextKind) =>
      POLISH_EVAL_SAMPLES.filter((sample) => sample.kind === kind).map(({ label }) => label);

    expect(labels("customer_report")).toEqual([
      "Serbian (Latin)",
      "Serbian (Cyrillic)",
      "Serbian without diacritics",
      "Hungarian",
      "English",
      "Terse notes",
    ]);
    expect(labels("service_description")).toEqual([
      "Serbian (Latin)",
      "Serbian (Cyrillic)",
      "Serbian without diacritics",
      "Hungarian",
      "Terse notes",
    ]);
  });

  it("refuses to run without a configured model and key, or on the fake", () => {
    const missing = /AI_POLISH_MODEL and OPENAI_API_KEY/;
    expect(() => polishEvalPolisher({})).toThrow(missing);
    expect(() => polishEvalPolisher({ AI_POLISH_MODEL: "openai:gpt-5.4-mini-2026-03-17" })).toThrow(
      missing,
    );
    expect(() => polishEvalPolisher({ AI_POLISH_FAKE: "true" })).toThrow(missing);
    expect(
      polishEvalPolisher({
        AI_POLISH_MODEL: "openai:gpt-5.4-mini-2026-03-17",
        OPENAI_API_KEY: "sk-test",
      }),
    ).toBeDefined();
  });

  it("tells a Latin text from a Cyrillic one", () => {
    expect(scriptOf("Zamenjen ekran, očišćen.")).toBe("Latin");
    expect(scriptOf("Замењен екран, очишћен.")).toBe("Cyrillic");
    expect(scriptOf("Замењен USB конектор и кабл.")).toBe("Cyrillic");
    expect(scriptOf("123 —")).toBe("none");
  });

  it("polishes every sample, flagging a changed script and keeping failures", async () => {
    const fake = createFakeTextPolisher();
    const kinds: TextKind[] = [];
    const results = await runPolishEval(
      {
        async polish(text, kind) {
          kinds.push(kind);
          if (text === "fail") throw new TextPolishError("timeout");
          if (text === "латиница") return { text: "latinica", changed: true };
          return fake.polish(text, kind);
        },
      },
      [
        { kind: "customer_report", label: "Kept", text: "zamenjen ekran" },
        { kind: "service_description", label: "Switched", text: "латиница" },
        { kind: "customer_report", label: "Failed", text: "fail" },
      ],
    );

    expect(results).toEqual([
      {
        kind: "customer_report",
        label: "Kept",
        input: "zamenjen ekran",
        output: "zamenjen ekran (polished)",
        warnings: [],
      },
      {
        kind: "service_description",
        label: "Switched",
        input: "латиница",
        output: "latinica",
        warnings: ["script changed: Cyrillic → Latin"],
      },
      {
        kind: "customer_report",
        label: "Failed",
        input: "fail",
        output: null,
        warnings: ["failed: timeout"],
      },
    ]);
    expect(kinds).toEqual(["customer_report", "service_description", "customer_report"]);
  });

  it("prints each input next to its output, wrapped to the column width", () => {
    const report = formatPolishEval(
      [
        {
          kind: "customer_report",
          label: "English",
          input: "replaced the charging port, phone charges normaly now",
          output: "We replaced the charging port and the phone now charges normally.",
          warnings: [],
        },
        {
          kind: "service_description",
          label: "Terse notes",
          input: "radi",
          output: null,
          warnings: ["failed: timeout"],
        },
      ],
      { columnWidth: 24 },
    );

    expect(report).toBe(
      [
        "── Customer report: English ──",
        "Input                    │ Output",
        "replaced the charging    │ We replaced the charging",
        "port, phone charges      │ port and the phone now",
        "normaly now              │ charges normally.",
        "",
        "── Service description: Terse notes ──",
        "Input                    │ Output",
        "radi                     │ —",
        "! failed: timeout",
        "",
      ].join("\n"),
    );
  });
});
