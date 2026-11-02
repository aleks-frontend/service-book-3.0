import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/node";
import { withoutCustomerReports } from "../src/lib/sentryScrub.js";

const ID = "8b0b6a2e-5f0a-4c1e-9d3a-0c5e4b2f1a7d";

function event(url: string, data: unknown): ErrorEvent {
  return { type: undefined, request: { url, method: "POST", data } };
}

describe("withoutCustomerReports", () => {
  it.each([
    [`http://localhost/api/services/${ID}/customer-report/polish`, { text: "zamenjen ekran" }],
    [`http://localhost/api/services/${ID}/customer-report`, { customerReport: "zamenjen ekran" }],
  ])("drops the body sent to %s", (url, data) => {
    const scrubbed = withoutCustomerReports(event(url, data));

    expect(JSON.stringify(scrubbed)).not.toContain("zamenjen");
    expect(scrubbed.request?.url).toBe(url);
  });

  it("keeps the body of other requests", () => {
    const url = `http://localhost/api/services/${ID}/status`;

    expect(withoutCustomerReports(event(url, { status: "done" })).request?.data).toEqual({
      status: "done",
    });
  });
});
