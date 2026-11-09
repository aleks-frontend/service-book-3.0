import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/node";
import { withoutCustomerText } from "../src/lib/sentryScrub.js";

const ID = "8b0b6a2e-5f0a-4c1e-9d3a-0c5e4b2f1a7d";

function event(url: string, data: unknown): ErrorEvent {
  return { type: undefined, request: { url, method: "POST", data } };
}

describe("withoutCustomerText", () => {
  it.each([
    [`http://localhost/api/services/${ID}/customer-report/polish`, { text: "zamenjen ekran" }],
    [`http://localhost/api/services/${ID}/customer-report`, { customerReport: "zamenjen ekran" }],
    ["http://localhost/api/services/description/polish", { text: "zamenjen ekran" }],
  ])("drops the body sent to %s", (url, data) => {
    const scrubbed = withoutCustomerText(event(url, data));

    expect(JSON.stringify(scrubbed)).not.toContain("zamenjen");
    expect(scrubbed.request?.url).toBe(url);
  });

  it.each([
    [`http://localhost/api/services/${ID}/status`, { status: "done" }],
    ["http://localhost/api/services", { description: "Ne pali se" }],
  ])("keeps the body of other requests, such as %s", (url, data) => {
    expect(withoutCustomerText(event(url, data)).request?.data).toEqual(data);
  });
});
