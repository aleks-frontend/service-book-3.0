import type { ErrorEvent } from "@sentry/node";

/**
 * The routes whose request body holds a customer report (its save and its AI polish)
 * or a service description sent to AI polish.
 */
const CUSTOMER_TEXT_ROUTE = /\/(?:customer-report|description\/polish)(?:\/|$|\?)/;

/**
 * Sentry's `beforeSend`: drops the request body from events raised while a
 * customer report, or a description to polish, was sent, since Sentry attaches
 * incoming bodies by default and that text must not reach it (ADR-0007).
 */
export function withoutCustomerText(event: ErrorEvent): ErrorEvent {
  if (event.request?.url && CUSTOMER_TEXT_ROUTE.test(event.request.url)) {
    delete event.request.data;
  }
  return event;
}
