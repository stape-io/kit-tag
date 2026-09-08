# Kit tag for Google Tag Manager Server Side

The **Kit tag for the Google Tag Manager server container** allows you to integrate your website with Kit by creating and updating Subscribers via Kit's Subscribers API.

This server-to-server integration helps improve data accuracy and security by communicating directly with Kit from your server, bypassing client-side tracking limitations. Authentication uses a Kit API Key — no OAuth setup required.

## Features

- **Create Subscriber** — creates a new subscriber, or upserts an existing one by email address, via Kit's Subscribers API.
- **Update Subscriber** — updates an existing subscriber's name and custom fields. Kit identifies subscribers to update by their numeric ID rather than email, so the tag first looks the subscriber up by email and then updates the matched record.

## How to use Kit tag

1. Add the Kit tag to the server GTM container from the template gallery.
2. Add your Kit API Key — found in your Kit account under **Settings → Developer**. [Learn more](https://developers.kit.com/api-reference/authentication) about locating your API Key.
3. Select the Event Type: **Create Subscriber** or **Update Subscriber**.
4. Add the subscriber's email address (or leave it empty to fall back to the event's email fields, when Automap from Event Data is enabled) and any optional fields.
5. With **Automap from Event Data** enabled (the default), fields left empty are automatically filled from Event Data — e.g. Customer Email/Contact Email Address fall back to `email`/`user_data.email`/`user_data.email_address`. Disable this checkbox to require every value to be set explicitly on the tag. Each field's help text documents its exact Event Data source.

## Open Source

The **Kit tag for GTM Server Side** is developed and maintained by [Stape Team](https://stape.io/) under the Apache 2.0 license.
