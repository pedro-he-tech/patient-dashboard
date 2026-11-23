# Assumptions

These are the product and technical assumptions I made while building this patient management dashboard. Where a real deployment would need more, I note how the design extends.

## Users and scope

- The app is used by a single provider (one practice). There is no login for this assignment. In a multi-provider setup, every patient row would carry a `provider_id`, every query would be scoped to the signed-in provider, and authentication would sit in front of the API.

## Patient data

- **Name:** first and last name are required; middle name is optional, since many people don't have one.
- **Date of birth:** stored as a date only (no time), so time zones can never shift a birthday by a day. It cannot be in the future, and age is capped at 130 years.
- **Address:** US addresses only for now, split into line 1, optional line 2, city, two-letter state code, and ZIP (stored as text so leading zeros and ZIP+4 work). A `country` column defaults to `US` to leave room for international addresses later.
- **SSN (optional):** used only to tell apart patients who share a name and date of birth. Many patients won't or can't provide one (for example newborns or non-US residents), so it is never required and never the primary key. It is encrypted at rest, shown masked in the UI (`***-**-1234`), never returned in full by the API, and deduplicated through a keyed hash so duplicates can be detected without decrypting.

## Status

- A new patient starts as **Inquiry** by default.
- Providers can move a patient to any status, including back from **Churned** to **Active**, because real patients do return. Every change is recorded with a timestamp in a status history table and shown as a timeline on the patient's detail page.

## Deleting vs. churning

- **Churned** is a business status: the patient is no longer receiving care but their record stays visible and searchable.
- **Delete** is for records entered by mistake or duplicated. It is a soft delete (`deleted_at` timestamp): the record is hidden from lists but never physically removed, and it can be restored. Healthcare records typically have retention and audit requirements, and accidentally losing a patient record is costly.

## Duplicates

- Same SSN: creation is blocked and the provider is pointed to the existing patient.
- Same name and date of birth (no SSN match): the provider sees a "possible duplicate" warning and can confirm to create the record anyway.

## Viewing data

- The main pain point is finding the right patient quickly, so the list supports name search, status filtering (multi-select), sorting, and server-side pagination. Server-side pagination assumes a practice may grow to thousands of patients.
- Each patient has a detail page with their information, masked SSN, and status timeline.

## Compliance

- Patient data is protected health information under HIPAA. This assignment does not implement full compliance, but a production version would add authentication and role-based access, audit logging of every read and write, encryption in transit and at rest, and a signed BAA with the hosting provider.

## Search by SSN

- Providers can search by the last four digits of the SSN (typing four digits in the search box also matches `ssn_last4`). This is common in clinical settings for telling patients apart. Only the last four digits are stored in plain text for this purpose; the full SSN stays encrypted and is never searchable. In production, these lookups would be covered by the audit log.

## Restoring deleted patients

- A "Deleted patients" page lists soft-deleted records with when they were deleted, and each has a one-click **Restore** button. This makes soft delete visible and reversible in the UI instead of only through the API.
