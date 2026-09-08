const encodeUriComponent = require('encodeUriComponent');
const getAllEventData = require('getAllEventData');
const getRequestHeader = require('getRequestHeader');
const getType = require('getType');
const JSON = require('JSON');
const logToConsole = require('logToConsole');
const makeString = require('makeString');
const Promise = require('Promise');
const sendHttpRequest = require('sendHttpRequest');

/*==============================================================================
==============================================================================*/

const eventData = getAllEventData();

if (shouldExitEarly(data, eventData)) return;

if (data.eventType === 'createSubscriber') {
  const failed = createSubscriber(eventData);
  if (!failed && data.useOptimisticScenario) {
    return data.gtmOnSuccess();
  }
} else if (data.eventType === 'updateSubscriber') {
  const failed = updateSubscriber(eventData);
  if (!failed && data.useOptimisticScenario) {
    return data.gtmOnSuccess();
  }
} else {
  return data.gtmOnSuccess();
}

/*==============================================================================
  Vendor related functions
==============================================================================*/

function createSubscriber(eventData) {
  const subscriberData = buildSubscriberData(eventData);
  if (!subscriberData) return true;

  performApiCall('/subscribers', 'POST', subscriberData);
  return false;
}

function updateSubscriber(eventData) {
  const subscriberData = buildSubscriberData(eventData);
  if (!subscriberData) return true;

  getSubscriberId(subscriberData.email_address).then((subscriberId) => {
    if (!subscriberId) return;
    performApiCall('/subscribers/' + subscriberId, 'PUT', subscriberData);
  });
  return false;
}

function buildSubscriberData(eventData) {
  const eventDataUserData = eventData.user_data || {};
  const autoMap = data.autoMapEventData;
  const email =
    data.emailAddress ||
    (autoMap
      ? eventData.email || eventDataUserData.email || eventDataUserData.email_address
      : undefined);

  if (!requireValue(email, 'emailAddress', '🛑 [ERROR] Subscriber was not sent.')) return null;

  const subscriberData = { email_address: makeString(email) };
  if (isValidValue(data.firstName)) subscriberData.first_name = makeString(data.firstName);

  if (data.eventType === 'createSubscriber' && isValidValue(data.subscriberState)) {
    subscriberData.state = data.subscriberState;
  }

  const fields = mapCustomFields();
  if (fields) subscriberData.fields = fields;

  return subscriberData;
}

function mapCustomFields() {
  if (!data.customFields || !data.customFields.length) return null;
  const fields = {};
  data.customFields.forEach((row) => {
    if (isValidValue(row.key)) fields[makeString(row.key)] = makeString(row.value);
  });
  return fields;
}

function getSubscriberId(email) {
  return apiRequest('/subscribers?email_address=' + enc(email), 'GET')
    .then((result) => {
      const parsedBody = JSON.parse(result.body || '{}');
      const subscribers = (parsedBody && parsedBody.subscribers) || [];
      const subscriberId = subscribers.length ? subscribers[0].id : undefined;

      if (!isValidValue(subscriberId)) {
        if (!data.useOptimisticScenario) data.gtmOnFailure();
        return undefined;
      }
      return subscriberId;
    })
    .catch(() => {
      if (!data.useOptimisticScenario) data.gtmOnFailure();
      return undefined;
    });
}

function performApiCall(path, method, body) {
  apiRequest(path, method, body)
    .then((result) => {
      const parsedBody = JSON.parse(result.body || '{}');
      const success =
        result.statusCode >= 200 && result.statusCode < 400 && !(parsedBody && parsedBody.errors);

      if (!data.useOptimisticScenario) {
        if (success) data.gtmOnSuccess();
        else data.gtmOnFailure();
      }
    })
    .catch(() => {
      if (!data.useOptimisticScenario) data.gtmOnFailure();
    });
}

function apiRequest(path, method, body) {
  const endpoint = 'https://api.kit.com/v4' + path;
  const requestOptions = {
    headers: { 'X-Kit-Api-Key': data.apiKey, 'Content-Type': 'application/json' },
    method: method
  };

  return body === undefined
    ? sendHttpRequest(endpoint, requestOptions)
    : sendHttpRequest(endpoint, requestOptions, JSON.stringify(body));
}

/*==============================================================================
  Helpers
==============================================================================*/

function requireValue(value, paramName, failMessage) {
  if (isValidValue(value)) return true;
  log({
    Name: 'Kit',
    Type: 'Message',
    Message: failMessage,
    Reason: 'Missing required parameter: "' + paramName + '".'
  });
  data.gtmOnFailure();
  return false;
}

function isValidValue(value) {
  const valueType = getType(value);
  if (valueType === 'null' || valueType === 'undefined' || value !== value) return false;
  return value !== '' && value !== 'undefined' && value !== 'null';
}

function isConsentGivenOrNotRequired(data, eventData) {
  if (data.adStorageConsent !== 'required') return true;
  if (eventData.consent_state) return !!eventData.consent_state.ad_storage;
  const xGaGcs = eventData['x-ga-gcs'] || '';
  return xGaGcs[2] === '1';
}

function getUrl(eventData) {
  return eventData.page_location || getRequestHeader('referer') || eventData.page_referrer;
}

function shouldExitEarly(data, eventData) {
  if (!isConsentGivenOrNotRequired(data, eventData)) {
    data.gtmOnSuccess();
    return true;
  }

  const url = getUrl(eventData);
  if (url && url.lastIndexOf('https://gtm-msr.appspot.com/', 0) === 0) {
    data.gtmOnSuccess();
    return true;
  }
  return false;
}

function enc(value) {
  if (['null', 'undefined'].indexOf(getType(value)) !== -1) value = '';
  return encodeUriComponent(makeString(value));
}

function log(rawDataToLog) {
  rawDataToLog.TraceId = getRequestHeader('trace-id');
  logToConsole(JSON.stringify(rawDataToLog));
}
