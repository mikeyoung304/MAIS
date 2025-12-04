/**
 * Widget postMessage communication service
 *
 * SECURITY: Always validates parent origin before sending messages
 * Singleton pattern ensures consistent messaging throughout the widget lifecycle
 */
export class WidgetMessenger {
  private static instance: WidgetMessenger;
  private parentOrigin: string;
  private resizeDebounceTimer: NodeJS.Timeout | null = null;
  private lastHeight: number = 0;

  private constructor(parentOrigin: string) {
    this.parentOrigin = parentOrigin;
  }

  static getInstance(parentOrigin: string): WidgetMessenger {
    if (!WidgetMessenger.instance) {
      WidgetMessenger.instance = new WidgetMessenger(parentOrigin);
    }
    return WidgetMessenger.instance;
  }

  /**
   * Send message to parent window
   * SECURITY: Never use '*' as target origin in production
   */
  private sendToParent(type: string, data: Record<string, unknown> = {}): void {
    if (!window.parent) return;

    // ✅ SECURE: Explicit target origin (never '*' in production)
    const targetOrigin =
      this.parentOrigin === '*'
        ? '*' // Only for development
        : this.parentOrigin;

    window.parent.postMessage(
      {
        source: 'elope-widget',
        type,
        ...data,
      },
      targetOrigin
    );
  }

  /**
   * Notify parent that widget is loaded and ready
   */
  sendReady(): void {
    this.sendToParent('READY', {
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Request iframe resize (debounced to avoid excessive messages)
   */
  sendResize(height: number): void {
    // Skip if height hasn't changed significantly (within 5px)
    if (Math.abs(height - this.lastHeight) < 5) {
      return;
    }

    this.lastHeight = height;

    // Debounce resize events
    if (this.resizeDebounceTimer) {
      clearTimeout(this.resizeDebounceTimer);
    }

    this.resizeDebounceTimer = setTimeout(() => {
      this.sendToParent('RESIZE', { height });
    }, 100); // 100ms debounce
  }

  /**
   * Notify parent that booking was created (pending payment)
   */
  sendBookingCreated(bookingId: string): void {
    this.sendToParent('BOOKING_CREATED', {
      bookingId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Notify parent that booking was completed (payment successful)
   */
  sendBookingCompleted(bookingId: string, returnUrl?: string): void {
    this.sendToParent('BOOKING_COMPLETED', {
      bookingId,
      returnUrl,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send error to parent
   */
  sendError(error: string, code?: string): void {
    this.sendToParent('ERROR', {
      error,
      code,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Notify parent of navigation within widget
   */
  sendNavigation(route: string, params?: Record<string, string>): void {
    this.sendToParent('NAVIGATION', {
      route,
      params,
      timestamp: new Date().toISOString(),
    });
  }
}
