# Generic devices and sale lines

## Context

In the Firebase data, the same device record was attached to services of different customers. Devices sold with a service were stored in a separate `newDevices` array, which the old earnings calculation ignored.

## Decision

A device's owner is nullable; a device with no owner is a generic device. Devices sold with a service are recorded as sale lines in the same service line table as work lines, distinguished by a type (`SALE` refers to a device, `WORK` to an action). Forcing every device to have one owner would mean guessing ownership for shared legacy devices. Keeping sales in a separate structure would keep earnings wrong. One line table makes the total a single sum of quantity × unit price.

## Consequences

- During the legacy import, ownership is derived from usage (see the mapping in #17).
- Each line stores a snapshot of its label and unit price, so later edits to an action or device do not rewrite old dispatch notes.
- A referenced device cannot be deleted. Its owner cannot be changed while it is attached to another customer's services.
