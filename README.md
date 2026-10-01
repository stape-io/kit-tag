# Kit tag for Google Tag Manager Server Side

The **Kit tag for the Google Tag Manager server container** allows you to integrate your website with Kit by creating, updating and unsubscribing Subscribers via Kit's Subscribers API.

This server-to-server integration helps improve data accuracy and security by communicating directly with Kit from your server, bypassing client-side tracking limitations. Authentication uses a Kit API Key — no OAuth setup required.

## Features

- **Create Subscriber** — creates a new subscriber, or upserts an existing one by email address, via Kit's Subscribers API. Kit does not support changing the state of an already existing subscriber, so **Subscriber State** (default: Active) only applies to new subscribers.
- **Update Subscriber** — updates an existing subscriber's name and custom fields. Kit identifies subscribers to update by their numeric ID rather than email, so the tag first looks the subscriber up by email and then updates the matched record.
- **Unsubscribe Subscriber** — unsubscribes an existing subscriber from all future emails, moving them to the `cancelled` state. The tag looks the subscriber up by email and then unsubscribes the matched record. Kit keeps the subscriber's record, history and tags. Kit treats this as consent-revoking and effectively permanent, so only re-subscribe someone with their explicit permission.

## How to use Kit tag

1. Add the Kit tag to the server GTM container from the template gallery.
2. Add your Kit API Key — found in your Kit account under **Settings → Developer**. [Learn more](https://developers.kit.com/api-reference/authentication) about locating your API Key.
3. Select the Event Type: **Create Subscriber**, **Update Subscriber** or **Unsubscribe Subscriber**.
4. Add the subscriber's email address. Leave it empty to fall back to the event's email fields when **Automap from Event Data** is enabled.
5. Optionally, set the Subscriber Lookup Status (Update and Unsubscribe only), First Name and Custom Fields (both not used by Unsubscribe Subscriber), and the Subscriber State (Create Subscriber only).

### Automap from Event Data

Enabled by default (**Automap from Event Data** checkbox). When on, the **Email Address** field falls back to the first available value below if left empty:

- `eventData.email`
- `eventData.user_data.email`
- `eventData.user_data.email_address`

Disable this checkbox to require the Email Address to be set explicitly on the tag.

### Subscriber Lookup Status

Update Subscriber and Unsubscribe Subscriber look the subscriber up by email before acting on them. **Subscriber Lookup Status** selects which subscriber statuses that lookup searches:

- **All** (default) — also finds cancelled, bounced, complained and inactive subscribers.
- **Active** — only finds active subscribers. The tag fails for anyone else.

### Custom Fields

Kit identifies Custom Fields by their **key**, not their label. Find each field's key by opening a subscriber's Custom Fields from the Subscribers list in the Kit UI. Unknown keys are ignored by Kit. Each row requires a key and a value, and keys must be unique. Kit accepts up to 140 custom fields per request, and processes requests with more than 10 fields asynchronously.

## Additional information

- **Subscriber lookup and caching:** Update Subscriber and Unsubscribe Subscriber look the subscriber up by email, using the selected **Subscriber Lookup Status**. A successful lookup is cached in memory on the server, scoped to the API Key, lookup status and email address, and reused by later events handled by the same server instance. A failed lookup is never cached, and the cached entry is dropped if Kit answers `404` for it.
- **API rate limit:** Kit limits API Key requests to 120 per rolling 60 seconds. A non-cached Update or Unsubscribe event makes two requests: the lookup and the update.
- **Use Optimistic Scenario:** calls `gtmOnSuccess()` without waiting for Kit's response. This speeds up the server container response, but reports success even if the API call fails.
- **Tag Execution Consent Settings:** the tag can send data always, or only when marketing consent (`ad_storage`) is given. When consent is required and not given, the tag doesn't send anything and finishes as successful.
- **GTM preview requests** (page location starting with `https://gtm-msr.appspot.com/`) are skipped and finish as successful.

## Open Source

The **Kit tag for GTM Server Side** is developed and maintained by [Stape Team](https://stape.io/) under the Apache 2.0 license.

### GTM Gallery Status
🔴 Not listed
