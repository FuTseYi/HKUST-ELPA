/* Public configuration only. Never put Cloudflare or GitHub secrets in this file.
 * PR 2 / deployment: set apiEndpoint to the HTTPS Worker URL and
 * turnstileSiteKey to the public Cloudflare Turnstile Site Key.
 * Keeping either blank disables submissions safely.
 */
window.ELPA_SUBMISSION_CONFIG = {
  apiEndpoint: 'https://hkust-elpa-submissions.futseyi.workers.dev/submit',
  turnstileSiteKey: '0x4AAAAAAFWWsgbB9w0JPOm3'
};
