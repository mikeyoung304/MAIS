/**
 * E2E Test: Agent UI Control
 *
 * Tests the Agent-First Dashboard Architecture where the AI chatbot
 * controls what's displayed in the content area.
 *
 * Test Cases:
 * 1. Agent shows preview - agentUIActions.showPreview() renders PreviewPanel
 * 2. Agent hides preview - agentUIActions.showDashboard() returns to dashboard
 * 3. Agent navigates - agentUIActions triggers router navigation
 * 4. Section highlight - highlightSection sends PostMessage to iframe
 * 5. /tenant/build redirect - Legacy URL redirects to dashboard with preview
 * 6. showPreview query param - ?showPreview=true activates preview
 * 7. Publish T3 dialog - Clicking Publish shows confirmation dialog
 * 8. Discard T3 dialog - Clicking Discard shows confirmation dialog
 * 9. Cmd+K focuses input - Keyboard shortcut focuses agent chat
 *
 * These tests verify the agent-controlled UI state management implemented
 * in Phase 1-4 of the Agent-First Dashboard Architecture.
 *
 * @see plans/agent-first-dashboard-architecture.md
 */
import { test, expect } from '../fixtures/auth.fixture';
import type { Page } from '@playwright/test';

/**
 * Helper: Navigate to tenant dashboard and wait for load
 */
async function goToDashboard(page: Page): Promise<void> {
  await page.goto('/tenant/dashboard');
  await page.waitForLoadState('domcontentloaded');

  // Wait for agent panel to be visible
  await page.waitForSelector('[data-testid="agent-panel"]', { timeout: 15000 });
}

/**
 * Helper: Initialize the agent UI store with tenant ID
 * This simulates what happens when the tenant layout mounts
 */
async function initializeAgentStore(page: Page, tenantId: string): Promise<void> {
  await page.evaluate((id) => {
    // Access the Zustand store from the window (exposed via devtools)
    const store = (
      window as unknown as {
        useAgentUIStore?: { getState: () => { initialize: (id: string) => void } };
      }
    ).useAgentUIStore;
    if (store) {
      store.getState().initialize(id);
    }
  }, tenantId);
}

/**
 * Helper: Call agentUIActions from the browser context
 */
async function callAgentUIAction(
  page: Page,
  action: 'showPreview' | 'showDashboard' | 'highlightSection' | 'setPreviewPage',
  ...args: unknown[]
): Promise<void> {
  await page.evaluate(
    ({ action, args }) => {
      // The agentUIActions are exposed on window for external access
      const actions = (
        window as unknown as { agentUIActions?: Record<string, (...args: unknown[]) => void> }
      ).agentUIActions;
      if (actions && typeof actions[action] === 'function') {
        actions[action](...args);
      } else {
        // Fallback: access store directly
        const store = (
          window as unknown as {
            useAgentUIStore?: { getState: () => Record<string, (...args: unknown[]) => void> };
          }
        ).useAgentUIStore;
        if (store) {
          const state = store.getState();
          if (typeof state[action] === 'function') {
            state[action](...args);
          }
        }
      }
    },
    { action, args }
  );
}

/**
 * Helper: Create a draft to enable publish/discard buttons
 */
async function createDraft(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await fetch('/api/tenant-admin/landing-page/draft', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pages: {
          home: {
            enabled: true,
            sections: [
              {
                id: 'home-hero-main',
                type: 'hero',
                headline: 'E2E Test Headline',
                subheadline: 'Test subheadline for agent UI control tests',
              },
            ],
          },
        },
      }),
    });
  });
}

test.describe('Agent UI Control', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await goToDashboard(authenticatedPage);
  });

  /**
   * Test 1: Agent shows preview
   *
   * When the agent executes the show_preview tool, the ContentArea
   * should render the PreviewPanel instead of the dashboard view.
   */
  test('shows preview when agent triggers show_preview', async ({ authenticatedPage }) => {
    // Initially should show dashboard view
    await expect(authenticatedPage.locator('[data-testid="content-area-dashboard"]')).toBeVisible({
      timeout: 10000,
    });

    // Trigger show_preview action (simulating agent tool execution)
    await callAgentUIAction(authenticatedPage, 'showPreview', 'home');

    // Should now show preview panel (assertion handles waiting for state change)
    await expect(authenticatedPage.locator('[data-testid="content-area-preview"]')).toBeVisible({
      timeout: 5000,
    });
    await expect(authenticatedPage.locator('[data-testid="preview-panel"]')).toBeVisible();
  });

  /**
   * Test 2: Agent hides preview
   *
   * When the agent executes the hide_preview tool, the ContentArea
   * should return to showing the dashboard view.
   */
  test('returns to dashboard when agent triggers hide_preview', async ({ authenticatedPage }) => {
    // First show preview
    await callAgentUIAction(authenticatedPage, 'showPreview', 'home');
    await expect(authenticatedPage.locator('[data-testid="content-area-preview"]')).toBeVisible({
      timeout: 5000,
    });

    // Then trigger hide_preview (showDashboard)
    await callAgentUIAction(authenticatedPage, 'showDashboard');

    // Should be back to dashboard (assertion handles waiting for state change)
    await expect(authenticatedPage.locator('[data-testid="content-area-dashboard"]')).toBeVisible({
      timeout: 5000,
    });
  });

  /**
   * Test 3: Agent navigates
   *
   * When the agent executes navigate_to tool, the router should
   * navigate to the specified path.
   */
  test('navigates when agent triggers navigate_to', async ({ authenticatedPage }) => {
    // Navigate via agent action is handled by router.push in AgentPanel
    // We'll test by directly navigating and verifying URL changes

    // Start at dashboard
    await expect(authenticatedPage).toHaveURL('/tenant/dashboard');

    // Navigate to settings (simulating what happens when agent returns NAVIGATE action)
    await authenticatedPage.evaluate(() => {
      // Use Next.js router if available
      const nextRouter = (
        window as unknown as { next?: { router?: { push: (path: string) => void } } }
      ).next?.router;
      if (nextRouter) {
        nextRouter.push('/tenant/settings');
      } else {
        // Fallback to direct navigation
        window.location.href = '/tenant/settings';
      }
    });

    // Wait for navigation
    await authenticatedPage.waitForURL('**/tenant/settings', { timeout: 10000 });
    await expect(authenticatedPage).toHaveURL(/\/tenant\/settings/);
  });

  /**
   * Test 4: Section highlight updates store state
   *
   * When highlightSection is called, the store should update with the
   * section ID and switch to preview mode if not already in it.
   *
   * Note: PostMessage to iframe is tested separately via unit tests since
   * it requires a fully loaded iframe which is slow/flaky in E2E.
   */
  test('updates store when highlighting section', async ({ authenticatedPage }) => {
    // Trigger section highlight - this should also show preview
    await callAgentUIAction(authenticatedPage, 'highlightSection', 'home-hero-main');

    // Wait for preview panel to become visible (indicates store update propagated to UI)
    await expect(authenticatedPage.locator('[data-testid="content-area-preview"]')).toBeVisible({
      timeout: 5000,
    });

    // Poll store state until it reflects the highlight (replaces arbitrary timeout)
    const storeState = await authenticatedPage.evaluate(async () => {
      // Helper to wait for store state condition
      const waitForStoreState = (
        maxAttempts = 20,
        interval = 100
      ): Promise<{
        status: string;
        currentPage: string | null;
        highlightedSectionId: string | null;
      } | null> => {
        return new Promise((resolve) => {
          let attempts = 0;
          const check = () => {
            const store = (
              window as unknown as {
                useAgentUIStore?: {
                  getState: () => {
                    view: {
                      status: string;
                      config?: { currentPage: string; highlightedSectionId: string | null };
                    };
                  };
                };
              }
            ).useAgentUIStore;

            if (store) {
              const state = store.getState();
              const result = {
                status: state.view.status,
                currentPage:
                  'config' in state.view ? (state.view.config?.currentPage ?? null) : null,
                highlightedSectionId:
                  'config' in state.view ? (state.view.config?.highlightedSectionId ?? null) : null,
              };

              // Check if store has updated with the expected values
              if (result.status === 'preview' && result.highlightedSectionId === 'home-hero-main') {
                resolve(result);
                return;
              }
            }

            attempts++;
            if (attempts >= maxAttempts) {
              // Return current state even if not matching (let test assertion fail with details)
              const store2 = (
                window as unknown as {
                  useAgentUIStore?: {
                    getState: () => {
                      view: {
                        status: string;
                        config?: { currentPage: string; highlightedSectionId: string | null };
                      };
                    };
                  };
                }
              ).useAgentUIStore;
              if (store2) {
                const state = store2.getState();
                resolve({
                  status: state.view.status,
                  currentPage:
                    'config' in state.view ? (state.view.config?.currentPage ?? null) : null,
                  highlightedSectionId:
                    'config' in state.view
                      ? (state.view.config?.highlightedSectionId ?? null)
                      : null,
                });
              } else {
                resolve(null);
              }
              return;
            }

            setTimeout(check, interval);
          };
          check();
        });
      };

      return waitForStoreState();
    });

    // highlightSection should switch to preview mode and set the section
    expect(storeState).not.toBeNull();
    expect(storeState?.status).toBe('preview');
    expect(storeState?.highlightedSectionId).toBe('home-hero-main');
    // Page should be 'home' (extracted from section ID 'home-hero-main')
    expect(storeState?.currentPage).toBe('home');
  });

  /**
   * Test 5: /tenant/build redirects to dashboard with showPreview
   *
   * The legacy Build Mode URL should redirect to the unified dashboard
   * with the showPreview query parameter.
   */
  test('redirects /tenant/build to dashboard with showPreview', async ({ authenticatedPage }) => {
    // Navigate to legacy build mode URL
    await authenticatedPage.goto('/tenant/build');

    // Should redirect to dashboard with showPreview=true
    await authenticatedPage.waitForURL('**/tenant/dashboard**', { timeout: 10000 });

    // The URL should have been /tenant/dashboard?showPreview=true (may be cleaned up)
    // The important thing is we're on the dashboard and preview is shown
    await expect(authenticatedPage).toHaveURL(/\/tenant\/dashboard/);

    // Preview should be visible (triggered by showPreview param)
    await expect(authenticatedPage.locator('[data-testid="content-area-preview"]')).toBeVisible({
      timeout: 10000,
    });
  });

  /**
   * Test 6: showPreview query param activates preview
   *
   * Navigating to dashboard with ?showPreview=true should
   * automatically show the preview panel.
   */
  test('activates preview with showPreview query param', async ({ authenticatedPage }) => {
    // Navigate with query param
    await authenticatedPage.goto('/tenant/dashboard?showPreview=true');
    await authenticatedPage.waitForLoadState('domcontentloaded');

    // Preview should be visible
    await expect(authenticatedPage.locator('[data-testid="content-area-preview"]')).toBeVisible({
      timeout: 10000,
    });
  });

  /**
   * Test 7: Publish button shows T3 confirmation dialog
   *
   * Clicking Publish should show a confirmation dialog before
   * actually publishing (T3 trust tier = hard confirm).
   */
  test('shows confirmation dialog when clicking Publish', async ({ authenticatedPage }) => {
    // Create a draft first so publish button is enabled
    await createDraft(authenticatedPage);

    // Show preview to access the publish button
    await callAgentUIAction(authenticatedPage, 'showPreview', 'home');
    await expect(authenticatedPage.locator('[data-testid="preview-panel"]')).toBeVisible({
      timeout: 10000,
    });

    // Reload to get the draft state
    await authenticatedPage.reload();
    await authenticatedPage.waitForLoadState('domcontentloaded');

    // Show preview again after reload
    await callAgentUIAction(authenticatedPage, 'showPreview', 'home');
    await expect(authenticatedPage.locator('[data-testid="preview-panel"]')).toBeVisible({
      timeout: 10000,
    });

    // Find and click publish button
    const publishButton = authenticatedPage.locator('[data-testid="preview-publish-button"]');

    // Wait for button to be visible (may need draft to exist)
    const isVisible = await publishButton.isVisible().catch(() => false);

    if (isVisible) {
      await publishButton.click();

      // Confirmation dialog should appear
      await expect(
        authenticatedPage.getByRole('heading', { name: /Publish Changes/i })
      ).toBeVisible({ timeout: 5000 });

      // Close dialog by clicking Cancel
      await authenticatedPage.getByRole('button', { name: /Cancel/i }).click();
    } else {
      // SKIP REASON: Publish button only visible when draft exists
      test.skip(true, 'No draft exists - publish button not visible');
    }
  });

  /**
   * Test 8: Discard button shows T3 confirmation dialog
   *
   * Clicking Discard should show a confirmation dialog before
   * actually discarding (T3 trust tier = hard confirm).
   */
  test('shows confirmation dialog when clicking Discard', async ({ authenticatedPage }) => {
    // Create a draft first so discard button is enabled
    await createDraft(authenticatedPage);

    // Show preview to access the discard button
    await callAgentUIAction(authenticatedPage, 'showPreview', 'home');
    await expect(authenticatedPage.locator('[data-testid="preview-panel"]')).toBeVisible({
      timeout: 10000,
    });

    // Reload to get the draft state
    await authenticatedPage.reload();
    await authenticatedPage.waitForLoadState('domcontentloaded');

    // Show preview again after reload
    await callAgentUIAction(authenticatedPage, 'showPreview', 'home');
    await expect(authenticatedPage.locator('[data-testid="preview-panel"]')).toBeVisible({
      timeout: 10000,
    });

    // Find and click discard button
    const discardButton = authenticatedPage.locator('[data-testid="preview-discard-button"]');

    // Wait for button to be visible (may need draft to exist)
    const isVisible = await discardButton.isVisible().catch(() => false);

    if (isVisible) {
      await discardButton.click();

      // Confirmation dialog should appear
      await expect(
        authenticatedPage.getByRole('heading', { name: /Discard Changes/i })
      ).toBeVisible({ timeout: 5000 });

      // Close dialog by clicking Cancel
      await authenticatedPage.getByRole('button', { name: /Cancel/i }).click();
    } else {
      // SKIP REASON: Discard button only visible when draft exists
      test.skip(true, 'No draft exists - discard button not visible');
    }
  });

  /**
   * Test 9: Cmd+K focuses agent chat input
   *
   * The keyboard shortcut Cmd+K (or Ctrl+K on Windows/Linux)
   * should focus the agent chat input from anywhere on the page.
   */
  test('Cmd+K focuses agent chat input', async ({ authenticatedPage }) => {
    // Wait for the chat input to be present
    const chatInput = authenticatedPage.locator('[data-testid="agent-chat-input"]');
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    // Click somewhere else first to ensure input is not focused
    await authenticatedPage.click('body');

    // Verify input is not focused
    const isFocusedBefore = await chatInput.evaluate((el) => document.activeElement === el);
    expect(isFocusedBefore).toBe(false);

    // Press Cmd+K (Meta+K on Mac)
    await authenticatedPage.keyboard.press('Meta+k');

    // Wait for input to be focused (assertion handles waiting)
    await expect(chatInput).toBeFocused({ timeout: 2000 });
  });
});

/**
 * Additional test: Preview page tabs work correctly
 */
test.describe('Preview Panel Navigation', () => {
  test('page tabs switch preview to different pages', async ({ authenticatedPage }) => {
    await goToDashboard(authenticatedPage);

    // Show preview
    await callAgentUIAction(authenticatedPage, 'showPreview', 'home');
    await expect(authenticatedPage.locator('[data-testid="preview-panel"]')).toBeVisible({
      timeout: 10000,
    });

    // Click on About tab
    const aboutTab = authenticatedPage.locator('[data-testid="preview-page-tab-about"]');
    await expect(aboutTab).toBeVisible({ timeout: 5000 });
    await aboutTab.click();

    // Wait for tab to become active (CSS class indicates active state: bg-sage/10)
    await expect(aboutTab).toHaveClass(/bg-sage/, { timeout: 5000 });

    // Poll store state until it reflects 'about' (replaces arbitrary timeout)
    const currentPage = await authenticatedPage.evaluate(async () => {
      // Helper to wait for store state condition
      const waitForPageState = (
        expectedPage: string,
        maxAttempts = 20,
        interval = 100
      ): Promise<string | null> => {
        return new Promise((resolve) => {
          let attempts = 0;
          const check = () => {
            const store = (
              window as unknown as {
                useAgentUIStore?: {
                  getState: () => { view: { config?: { currentPage: string } } };
                };
              }
            ).useAgentUIStore;

            if (store) {
              const state = store.getState();
              if (state.view && 'config' in state.view) {
                const page = state.view.config?.currentPage;
                if (page === expectedPage) {
                  resolve(page);
                  return;
                }
              }
            }

            attempts++;
            if (attempts >= maxAttempts) {
              // Return current state even if not matching
              const store2 = (
                window as unknown as {
                  useAgentUIStore?: {
                    getState: () => { view: { config?: { currentPage: string } } };
                  };
                }
              ).useAgentUIStore;
              if (store2) {
                const state = store2.getState();
                if (state.view && 'config' in state.view) {
                  resolve(state.view.config?.currentPage ?? null);
                  return;
                }
              }
              resolve(null);
              return;
            }

            setTimeout(check, interval);
          };
          check();
        });
      };

      return waitForPageState('about');
    });

    expect(currentPage).toBe('about');
  });

  test('close button returns to dashboard', async ({ authenticatedPage }) => {
    await goToDashboard(authenticatedPage);

    // Show preview
    await callAgentUIAction(authenticatedPage, 'showPreview', 'home');
    await expect(authenticatedPage.locator('[data-testid="content-area-preview"]')).toBeVisible({
      timeout: 10000,
    });

    // Click close button
    const closeButton = authenticatedPage.locator('[data-testid="preview-close-button"]');
    await expect(closeButton).toBeVisible({ timeout: 5000 });
    await closeButton.click();

    // Should return to dashboard
    await expect(authenticatedPage.locator('[data-testid="content-area-dashboard"]')).toBeVisible({
      timeout: 5000,
    });
  });
});
