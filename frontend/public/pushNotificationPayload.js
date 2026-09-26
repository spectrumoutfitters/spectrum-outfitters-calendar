// Classic script. Loaded by sw.js via importScripts and by node:test in a vm.
// Do not add import/export — service workers parse this file as a classic script.
(function (root) {
  function notificationFields(data) {
    return {
      title: data.title || 'Spectrum Outfitters',
      body: data.body || '',
      tag: data.tag || 'spectrum',
      url: data.url || '/',
    };
  }

  /**
   * Map a push message body to the showNotification arguments.
   * Valid JSON objects keep title/body/tag/url. Anything that cannot be read
   * as an object (bad JSON, null, non-objects) uses the raw text as the body
   * so a failed parse still shows a notification.
   */
  function parsePushEventData(rawText) {
    const text = rawText == null ? '' : String(rawText);
    if (text === '') return notificationFields({});
    try {
      return notificationFields(JSON.parse(text));
    } catch (e) {
      return notificationFields({ title: 'Spectrum Outfitters', body: text });
    }
  }

  /** URL opened when the employee taps the notification. */
  function notificationClickUrl(notificationData) {
    const url = notificationData && notificationData.url;
    return url || '/';
  }

  root.parsePushEventData = parsePushEventData;
  root.notificationClickUrl = notificationClickUrl;
})(typeof globalThis !== 'undefined' ? globalThis : self);
