/**
 * PWA Components
 *
 * Progressive Web App functionality for HANDLED:
 * - Install prompts (iOS manual, Android/Desktop native)
 * - Service worker registration with update handling
 * - Offline storage utilities
 */

export { InstallPrompt, InstallButton } from './InstallPrompt';
export {
  ServiceWorkerRegistration,
  useServiceWorker,
  type ServiceWorkerStatus,
} from './ServiceWorkerRegistration';
