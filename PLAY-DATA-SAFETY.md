# First Bites — Google Play Data Safety answers

These answers reflect the current First Bites codebase: React/Vite TWA, Supabase authentication/database, Vercel hosting, optional Google sign-in, shared households, child profiles, food logs, favorites, notes, and reaction tracking.

## Data collection and security
- Does the app collect or share any required user data types? **Yes**
- Is all collected user data encrypted in transit? **Yes** (HTTPS/TLS)
- Does the app provide a way to request data/account deletion? **Yes**, after deploying `/delete-account/`
- Does the app share user data with third parties? **No** under Google Play's Data Safety definition, assuming Supabase and Vercel are used as service providers. Household sharing is initiated by the user through invite codes and is part of the app's requested functionality.

## Data types to select

### Location
**Approximate location**
- Collected: Yes
- Shared: No
- Required/optional: Required/automatic
- Purposes: App functionality; Fraud prevention, security, and compliance; Analytics
- Why: hosting/database providers may process IP addresses and derive city/country for routing, security, logs, and service operation.

Do **not** select Precise location.

### Personal info
**Name**
- Collected: Yes
- Shared: No
- Required/optional: Required
- Purposes: App functionality; Account management
- Includes caregiver display names and child names entered by caregivers.

**Email address**
- Collected: Yes
- Shared: No
- Required/optional: Required
- Purposes: App functionality; Account management; Fraud prevention, security, and compliance

**User IDs**
- Collected: Yes
- Shared: No
- Required/optional: Required
- Purposes: App functionality; Account management; Fraud prevention, security, and compliance

**Other info**
- Collected: Yes
- Shared: No
- Required/optional: Optional
- Purposes: App functionality
- Includes optional child birth date and other profile/household information that does not fit another personal-info subtype.

Do not select address, phone number, race/ethnicity, political/religious beliefs, or sexual orientation unless you later add those fields.

### Health and fitness
**Health info**
- Collected: Yes
- Shared: No
- Required/optional: Optional
- Purposes: App functionality
- Includes allergen exposure tracking, possible reaction status, feeding history, and health-related notes entered by caregivers.

Do not select Fitness info.

### Photos and videos
**Photos**
- Collected: Yes (conservative declaration)
- Shared: No
- Required/optional: Optional
- Purposes: App functionality; Account management
- Why: Google sign-in can provide a profile-picture URL that First Bites stores/displays. First Bites does not access the phone's photo library or upload meal photos in the current version.

Do not select Videos.

### App activity
**App interactions**
- Collected: Yes
- Shared: No
- Required/optional: Required/automatic
- Purposes: App functionality; Analytics; Fraud prevention, security, and compliance
- Why: hosting/database request and usage logs can reflect use of the service.

**Other user-generated content**
- Collected: Yes
- Shared: No
- Required/optional: Optional
- Purposes: App functionality
- Includes free-text notes, amount/description fields, household names, and other text entered by users.

**Other actions**
- Collected: Yes
- Shared: No
- Required/optional: Optional
- Purposes: App functionality
- Includes likes/dislikes, favorites, food-log actions, reaction choices, and similar in-app choices.

Do not select In-app search history: the current food-search query remains client-side and is not intentionally stored.
Do not select Installed apps.

### App info and performance
**Diagnostics**
- Collected: Yes
- Shared: No
- Required/optional: Required/automatic
- Purposes: App functionality; Analytics; Fraud prevention, security, and compliance
- Why: Vercel/Supabase may process request, performance, diagnostic, and security logs needed to run the service.

Do not select Crash logs unless you later add a crash-reporting SDK or otherwise collect crash reports from the app.

### Device or other IDs
**Device or other IDs**
- Collected: Yes (conservative declaration)
- Shared: No
- Required/optional: Required/automatic
- Purposes: App functionality; Analytics; Fraud prevention, security, and compliance
- Why: service providers may process browser/device identifiers and authentication/session identifiers.

## Categories not currently collected by First Bites
- Precise location
- Financial information
- Messages
- Audio files
- Videos
- Files and documents
- Calendar
- Contacts
- Web browsing history
- Fitness information
- Installed apps

## Account deletion
Use this web resource in the Play Console account-deletion field:
`https://first-bites-roan.vercel.app/delete-account/`

Privacy policy URL:
`https://first-bites-roan.vercel.app/privacy/`

Run `supabase/account-deletion-support.sql` once before accepting deletion requests. When a verified request arrives, delete the user from Supabase Authentication -> Users; the trigger cleans up user-authored records and handles household ownership.

## Important
Revisit the Data Safety form whenever you add analytics, ads, push notifications, meal photos, crash reporting, payments, location, messaging, or other SDKs/features. Google requires the declaration to describe all data collected by the app and its third-party code/service integrations.
