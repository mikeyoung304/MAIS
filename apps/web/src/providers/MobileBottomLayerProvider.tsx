'use client';

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { BOTTOM_LAYER_Z_INDEX } from '@/types/responsive';

/**
 * A layer that occupies bottom screen space.
 */
export interface BottomLayer {
  /** Unique identifier for the layer */
  readonly id: string;

  /** Height of the layer in pixels */
  readonly height: number;

  /** Priority (lower = closer to screen bottom) */
  readonly priority: number;

  /** Whether the layer is currently visible */
  readonly visible: boolean;
}

/**
 * Context value for bottom layer coordination.
 */
export interface MobileBottomLayerContextValue {
  /** All registered layers */
  readonly layers: readonly BottomLayer[];

  /** Register a new layer or update existing */
  readonly registerLayer: (layer: BottomLayer) => void;

  /** Remove a layer by ID */
  readonly unregisterLayer: (id: string) => void;

  /** Update a layer's visibility */
  readonly setLayerVisibility: (id: string, visible: boolean) => void;

  /** Update a layer's height */
  readonly setLayerHeight: (id: string, height: number) => void;

  /** Get the offset (total height of lower-priority visible layers) */
  readonly getOffsetFor: (id: string) => number;

  /** Get the z-index for a layer */
  readonly getZIndexFor: (id: string) => number;

  /** Total height of all visible layers */
  readonly totalHeight: number;
}

/**
 * Pre-defined layer IDs for consistent identification.
 */
export const LAYER_IDS = {
  stickyCta: 'sticky-cta',
  bottomNav: 'bottom-nav',
  chatBubble: 'chat-bubble',
  chatExpanded: 'chat-expanded',
  cookieBanner: 'cookie-banner',
  toast: 'toast',
} as const;

/**
 * Pre-defined layer priorities (lower = bottom of stack).
 */
export const LAYER_PRIORITIES = {
  [LAYER_IDS.stickyCta]: 1,
  [LAYER_IDS.bottomNav]: 2,
  [LAYER_IDS.chatBubble]: 10,
  [LAYER_IDS.chatExpanded]: 11,
  [LAYER_IDS.cookieBanner]: 20,
  [LAYER_IDS.toast]: 30,
} as const;

const MobileBottomLayerContext =
  createContext<MobileBottomLayerContextValue | null>(null);

/**
 * Provider for coordinating bottom-of-screen layer stacking.
 *
 * This solves the problem of multiple fixed-bottom elements
 * (chat widget, sticky CTA, bottom nav, cookie banner) overlapping.
 *
 * Components register their layers with height and priority.
 * The provider calculates offsets so layers stack correctly.
 *
 * @example
 * ```tsx
 * // In StickyMobileCTA.tsx
 * function StickyMobileCTA() {
 *   const { registerLayer, unregisterLayer, getOffsetFor } = useMobileBottomLayer();
 *   const layerId = LAYER_IDS.stickyCta;
 *
 *   useEffect(() => {
 *     registerLayer({
 *       id: layerId,
 *       height: 64,
 *       priority: LAYER_PRIORITIES[layerId],
 *       visible: true,
 *     });
 *     return () => unregisterLayer(layerId);
 *   }, []);
 *
 *   const offset = getOffsetFor(layerId);
 *
 *   return (
 *     <div style={{ bottom: offset }}>
 *       Book Now
 *     </div>
 *   );
 * }
 * ```
 */
export function MobileBottomLayerProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [layers, setLayers] = useState<BottomLayer[]>([]);

  const registerLayer = useCallback((layer: BottomLayer) => {
    setLayers((prev) => {
      const existing = prev.findIndex((l) => l.id === layer.id);
      if (existing >= 0) {
        // Update existing layer
        const updated = [...prev];
        updated[existing] = layer;
        return updated;
      }
      // Add new layer
      return [...prev, layer];
    });
  }, []);

  const unregisterLayer = useCallback((id: string) => {
    setLayers((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const setLayerVisibility = useCallback((id: string, visible: boolean) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, visible } : l))
    );
  }, []);

  const setLayerHeight = useCallback((id: string, height: number) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, height } : l))
    );
  }, []);

  const getOffsetFor = useCallback(
    (id: string): number => {
      const layer = layers.find((l) => l.id === id);
      if (!layer) return 0;

      // Sum heights of all visible layers with lower priority
      return layers
        .filter((l) => l.visible && l.priority < layer.priority)
        .reduce((sum, l) => sum + l.height, 0);
    },
    [layers]
  );

  const getZIndexFor = useCallback((id: string): number => {
    const zIndexMap: Record<string, number> = {
      [LAYER_IDS.stickyCta]: BOTTOM_LAYER_Z_INDEX.stickyCta,
      [LAYER_IDS.bottomNav]: BOTTOM_LAYER_Z_INDEX.bottomNav,
      [LAYER_IDS.chatBubble]: BOTTOM_LAYER_Z_INDEX.chatBubble,
      [LAYER_IDS.chatExpanded]: BOTTOM_LAYER_Z_INDEX.chatExpanded,
      [LAYER_IDS.cookieBanner]: BOTTOM_LAYER_Z_INDEX.cookieBanner,
      [LAYER_IDS.toast]: BOTTOM_LAYER_Z_INDEX.toast,
    };
    return zIndexMap[id] ?? 40;
  }, []);

  const totalHeight = useMemo(
    () =>
      layers.filter((l) => l.visible).reduce((sum, l) => sum + l.height, 0),
    [layers]
  );

  const value = useMemo<MobileBottomLayerContextValue>(
    () => ({
      layers,
      registerLayer,
      unregisterLayer,
      setLayerVisibility,
      setLayerHeight,
      getOffsetFor,
      getZIndexFor,
      totalHeight,
    }),
    [
      layers,
      registerLayer,
      unregisterLayer,
      setLayerVisibility,
      setLayerHeight,
      getOffsetFor,
      getZIndexFor,
      totalHeight,
    ]
  );

  return (
    <MobileBottomLayerContext.Provider value={value}>
      {children}
    </MobileBottomLayerContext.Provider>
  );
}

/**
 * Hook to access bottom layer coordination.
 *
 * @throws Error if used outside MobileBottomLayerProvider
 */
export function useMobileBottomLayer(): MobileBottomLayerContextValue {
  const context = useContext(MobileBottomLayerContext);

  if (context === null) {
    throw new Error(
      'useMobileBottomLayer must be used within a MobileBottomLayerProvider'
    );
  }

  return context;
}

/**
 * Optional hook that returns null if outside provider.
 */
export function useMobileBottomLayerOptional(): MobileBottomLayerContextValue | null {
  return useContext(MobileBottomLayerContext);
}

/**
 * Hook to register a layer and get its offset.
 * Automatically cleans up on unmount.
 */
export function useBottomLayerRegistration(
  id: string,
  config: {
    height: number;
    priority: number;
    visible?: boolean;
  }
): {
  offset: number;
  zIndex: number;
  setVisible: (visible: boolean) => void;
  setHeight: (height: number) => void;
} {
  const {
    registerLayer,
    unregisterLayer,
    getOffsetFor,
    getZIndexFor,
    setLayerVisibility,
    setLayerHeight,
  } = useMobileBottomLayer();

  // Register on mount, update on config changes, unregister on unmount
  useEffect(() => {
    registerLayer({
      id,
      height: config.height,
      priority: config.priority,
      visible: config.visible ?? true,
    });

    return () => {
      unregisterLayer(id);
    };
  }, [id, config.height, config.priority, config.visible, registerLayer, unregisterLayer]);

  return {
    offset: getOffsetFor(id),
    zIndex: getZIndexFor(id),
    setVisible: (visible: boolean) => setLayerVisibility(id, visible),
    setHeight: (height: number) => setLayerHeight(id, height),
  };
}
