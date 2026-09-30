const encodeUriComponent = require('encodeUriComponent');
const getAllEventData = require('getAllEventData');
const getRequestHeader = require('getRequestHeader');
const getType = require('getType');
const JSON = require('JSON');
const logToConsole = require('logToConsole');
const makeString = require('makeString');
const Promise = require('Promise');
const sendHttpRequest = require('sendHttpRequest');
const sha256Sync = require('sha256Sync');
const templateDataStorage = require('templateDataStorage');

/*==============================================================================
==============================================================================*/

const eventData = getAllEventData();

if (shouldExitEarly(data, eventData)) return;

const eventHandlers = {
  createSubscriber: createSubscriber,
  updateSubscriber: updateSubscriber,
  unsubscribeSubscriber: unsubscribeSubscriber
};
const eventHandler = eventHandlers[data.eventType];
if (!eventHandler) return data.gtmOnSuccess();

const failed = eventHandler(eventData);
if (!failed && data.useOptimisticScenario) return data.gtmOnSuccess();

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

  const email = subscriberData.email_address;
  getSubscriberId(email).then((subscriberId) => {
    if (!subscriberId) return;
    performApiCall('/subscribers/' + subscriberId, 'PUT', subscriberData, email);
  });
  return false;
}

function unsubscribeSubscriber(eventData) {
  const email = getEmail(eventData);
  if (!email) return true;

  getSubscriberId(email).then((subscriberId) => {
    if (!subscriberId) return;
    performApiCall('/subscribers/' + subscriberId + '/unsubscribe', 'POST', {}, email);
  });
  return false;
}

function getEmail(eventData) {
  const eventDataUserData = eventData.user_data || {};
  const email =
    data.emailAddress ||
    (data.autoMapEventData
      ? eventData.email || eventDataUserData.email || eventDataUserData.email_address
      : undefined);

  if (!requireValue(email, 'emailAddress', '🛑 [ERROR] Subscriber was not sent.')) return null;
  return makeString(email);
}

function buildSubscriberData(eventData) {
  const email = getEmail(eventData);
  if (!email) return null;

  const subscriberData = { email_address: email };
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
  const status = getLookupStatus();
  const cacheKey = getSubscriberIdCacheKey(email, status);
  const cachedSubscriberId = templateDataStorage.getItemCopy(cacheKey);
  if (cachedSubscriberId) return Promise.create((resolve) => resolve(cachedSubscriberId));

  return apiRequest('/subscribers?email_address=' + enc(email) + '&status=' + status, 'GET')
    .then((result) => {
      if (!isSuccessStatus(result.statusCode)) return handleFailure();

      const parsedBody = JSON.parse(result.body || '{}');
      const subscribers = (parsedBody && parsedBody.subscribers) || [];
      const subscriberId = subscribers.length ? subscribers[0].id : undefined;
      if (!isValidValue(subscriberId)) return handleFailure();

      templateDataStorage.setItemCopy(cacheKey, subscriberId);
      return subscriberId;
    })
    .catch(handleFailure);
}

function getLookupStatus() {
  // Kit only returns active subscribers unless "all" is requested explicitly.
  return data.subscriberLookupStatus === 'active' ? 'active' : 'all';
}

function getSubscriberIdCacheKey(email, status) {
  return sha256Sync('kit_subscriber_id_' + data.apiKey + '_' + status + '_' + email.toLowerCase());
}

function performApiCall(path, method, body, email) {
  apiRequest(path, method, body)
    .then((result) => {
      const parsedBody = JSON.parse(result.body || '{}');
      const success = isSuccessStatus(result.statusCode) && !(parsedBody && parsedBody.errors);

      // The subscriber was deleted in Kit, so the cached ID is stale.
      if (result.statusCode === 404 && email) {
        templateDataStorage.removeItem(getSubscriberIdCacheKey(email, getLookupStatus()));
      }

      if (success) {
        if (!data.useOptimisticScenario) data.gtmOnSuccess();
      } else {
        handleFailure();
      }
    })
    .catch(handleFailure);
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

function isSuccessStatus(statusCode) {
  return statusCode >= 200 && statusCode < 300;
}

function handleFailure() {
  if (!data.useOptimisticScenario) data.gtmOnFailure();
  return undefined;
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
