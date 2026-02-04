import { initBotId } from 'botid/client/core';

// Define the paths that need bot protection.
// These are POST endpoints for forms and newsletters that were previously protected by Cloudflare Turnstile.

initBotId({
  protect: [
    {
      path: '/api/newsletter',
      method: 'POST',
    },
    {
      path: '/api/sdoh-newsletter',
      method: 'POST',
    },
    {
      path: '/api/txmx-newsletter',
      method: 'POST',
    },
    {
      path: '/api/contact-form',
      method: 'POST',
    },
    {
      path: '/api/sdoh-impact-report',
      method: 'POST',
    },
  ],
});
