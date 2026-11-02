import type { ErrorEvent } from "@sentry/node";

/** The routes whose request body holds a customer report (its save and its AI polish). */
const CUSTOMER_REPORT_ROUTE = /\/customer-report(?:\/|$|\?)/;

/**
 * Sentry's `beforeSend`: drops the request body from events raised while a
 * customer report was sent, since Sentry attaches incoming bodies by default
 * and report text must not reach it (ADR-0007).
 */
export function withoutCustomerReports(event: ErrorEvent): ErrorEvent {
  if (event.request?.url && CUSTOMER_REPORT_ROUTE.test(event.request.url)) {
    delete event.request.data;
  }
  return event;
}
