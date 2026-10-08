# Service Book

Back-office tool for a repair shop: it records devices brought in by customers, the work done on them and the devices sold with them, and produces the documents handed to the customer.

## Language

### Core

**Service**:
One customer's visit with one or more devices on a given date, together with the work and sales recorded against it (Serbian: servis).
_Avoid_: Job, ticket, order, repair

**Service number**:
The human-readable identifier of a service in the form `YYYY-NNNN`, sequential per year and never reused.
_Avoid_: Ticket number, ID, legacy ID

**Public token**:
A 12-character random, URL-safe string identifying a service on its public link (`/s/<publicToken>`); hard to guess, never sequential.
_Avoid_: Public ID, hash, code

**Customer**:
A person or business that brings devices in for service; always has a phone number.
_Avoid_: Client, user, buyer

**Device**:
A physical item that can be serviced or sold, either owned by one customer or generic. It is named by its manufacturer and model, e.g. "Samsung Galaxy S21"; accessories such as cables may have only a model. It may also have a serial number, which is not unique.
_Avoid_: Item, product, equipment, device name

**Device description**:
Optional facts about the device itself, such as colour or capacity (Serbian: opis). The device's condition at intake belongs in the service's log, not here.
_Avoid_: Title, note, remark

**Generic device**:
A device with no owner, used for common models and for devices sold, or for legacy devices that appeared under several customers.
_Avoid_: Shared device, template device

**Action**:
An entry in the shop's price list: a type of work with a default price (Serbian: usluga).
_Avoid_: Task, operation, price item

### Money

**Service line**:
One priced row on a service, with a quantity and unit price; either a work line or a sale line.
_Avoid_: Row, item, entry

**Work line**:
A service line for work performed, referring to an action (type `WORK`).
_Avoid_: Action row, labour line

**Sale line**:
A service line for a device sold to the customer (type `SALE`).
_Avoid_: New device, sold device

**Total**:
The sum of quantity × unit price over all service lines of a service, in RSD.
_Avoid_: Price, amount, sum

**Earnings**:
The sum of totals over services in a period, excluding cancelled services.
_Avoid_: Revenue, income, turnover

### Lifecycle

**Status**:
Where a service is in its lifecycle: Received, In progress, Completed, Delivered or Cancelled.
_Avoid_: State, stage, phase

**Delivered**:
The final status of a service whose devices were handed back to the customer.
_Avoid_: Shipped, picked up, closed

**Log**:
The internal, chronological thread of a service, made of log entries; never shown to the customer.
_Avoid_: Notes, comments, history, remarks

**Log entry**:
One item in the log: a staff note, an automatic status change record, or an imported Firebase `remark`.
_Avoid_: Comment, remark

**Customer report**:
The final customer-facing text describing what was done on a service.
_Avoid_: Remark, note, summary, description

### Documents & identity

**Dispatch note**:
The PDF handed to the customer on pickup, listing service lines and total, with a QR code of the public link (Serbian: otpremnica).
_Avoid_: Invoice, bill

**Service report**:
The PDF containing the customer report for a service.
_Avoid_: Work report, summary

**Settings**:
The single record of the company's identity (name, address, contacts, tax ID, logo, signature) used on documents.
_Avoid_: Company profile, config

**Staff member**:
A person with an account who can log in to the admin panel; all staff members have equal rights.
_Avoid_: Admin, user, technician, operator

### Migration

**Legacy ID**:
The identifier a record had in the old Firebase app, kept for traceability and to make re-imports idempotent.
_Avoid_: Old ID, Firebase ID

**Cutover**:
The one-time switch from the old Firebase app to this app, including the final import and locking Firebase.
_Avoid_: Migration day, go-live
