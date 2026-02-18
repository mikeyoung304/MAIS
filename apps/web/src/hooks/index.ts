/**
 * Mobile-First Hooks Library
 *
 * This module exports all hooks for building responsive, mobile-optimized UIs.
 *
 * @example
 * ```tsx
 * import {
 *   useBreakpoint,
 *   useMediaQuery,
 *   useSwipeGesture,
 *   useNetworkStatus,
 * } from '@/hooks';
 * ```
 */

// Responsive & Media Queries
export {
  useMediaQuery,
  useMediaQueryValue,
  useMediaQueryWithFallback,
  type MediaQueryState,
} from './useMediaQuery';
export {
  useBreakpoint,
  usePrefersReducedMotion,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  useSupportsHover,
  useIsTouch,
  type BreakpointState,
} from './useBreakpoint';

// Layout & Safe Areas
export {
  useSafeArea,
  useSafeAreaInsets,
  useSafeAreaBottom,
  type SafeAreaInsets,
} from './useSafeArea';
export { useKeyboardHeight, type KeyboardState } from './useKeyboardHeight';

// Network & Connectivity
export {
  useNetworkStatus,
  useIsOnline,
  useSaveData,
  useIsSlowConnection,
  type NetworkStatus,
  type ConnectionType,
  type EffectiveType,
} from './useNetworkStatus';

// Gestures
export {
  useSwipeGesture,
  useSimpleSwipe,
  type SwipeEvent,
  type SwipeDirection,
  type SwipeGestureOptions,
  type SwipeGestureState,
} from './useSwipeGesture';
export {
  usePullToRefresh,
  type PullToRefreshOptions,
  type PullToRefreshState,
  type PullToRefreshStatus,
} from './usePullToRefresh';
export { usePinchZoom, type PinchZoomOptions, type PinchZoomState } from './usePinchZoom';
export { useHapticFeedback, type HapticPattern, type HapticIntensity } from './useHapticFeedback';

// Storage & Persistence
export { useLocalStorage, useLocalStorageBoolean } from './useLocalStorage';

// Scroll
export {
  useScrollRestoration,
  useScrollToTop,
  type ScrollRestorationOptions,
  type ScrollRestorationState,
} from './useScrollRestoration';

// Subscription & Billing
export { useSubscription, type SubscriptionTier } from './useSubscription';

// Agent Chat - Tenant Agent (Cloud Run)
export {
  useTenantAgentChat,
  type TenantAgentMessage,
  type TenantAgentToolCall,
  type DashboardAction,
  type UseTenantAgentChatOptions,
  type UseTenantAgentChatReturn,
} from './useTenantAgentChat';

// Agent Dashboard Actions
export { useDashboardActionDispatch } from './useDashboardActionDispatch';

// Agent Panel State
export { useAgentPanelState } from './useAgentPanelState';

// Scroll Reveal (storefront animations)
export { useScrollReveal } from './useScrollReveal';

// Active Section (storefront nav highlighting)
export { useActiveSection } from './useActiveSection';
