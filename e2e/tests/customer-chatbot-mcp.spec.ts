/**
 * E2E Test: Customer Chatbot Interaction with MCP
 *
 * This test demonstrates end-to-end interaction with the customer-facing chatbot
 * on a tenant storefront. The chatbot can help customers:
 * - Browse available services
 * - Check availability
 * - Book appointments (creates T3 proposals)
 * - Get information about the business
 *
 * Test Flow:
 * 1. Create and authenticate a tenant
 * 2. Navigate to their storefront
 * 3. Open the customer chat widget
 * 4. Interact with the chatbot to browse services and book
 * 5. Verify the chatbot responds and creates proposals
 *
 * @see apps/web/src/components/chat/CustomerChatWidget.tsx
 * @see server/src/agent/orchestrator/customer-chat-orchestrator.ts
 */

import { test, expect } from '../fixtures/auth.fixture';
import type { Page } from '@playwright/test';

/**
 * Helper: Navigate to tenant storefront
 */
async function goToStorefront(page: Page, slug: string): Promise<void> {
  await page.goto(`/t/${slug}`);
  await page.waitForLoadState('networkidle');
}

/**
 * Helper: Open the customer chat widget
 */
async function openChatWidget(page: Page): Promise<void> {
  // Find and click the floating chat bubble
  const chatBubble = page.locator('button[aria-label="Open chat"]');
  await expect(chatBubble).toBeVisible({ timeout: 10000 });
  await chatBubble.click();

  // Wait for chat widget to open
  const chatWidget = page.locator('h3:has-text("Booking Assistant")').first();
  await expect(chatWidget).toBeVisible({ timeout: 5000 });
}

/**
 * Helper: Send a message in the chat
 */
async function sendChatMessage(page: Page, message: string): Promise<void> {
  const chatInput = page.locator('textarea[placeholder*="Ask about services"]').first();
  await expect(chatInput).toBeVisible({ timeout: 5000 });

  await chatInput.fill(message);

  // Find and click the send button
  const sendButton = page
    .locator('button:has-text("")')
    .filter({ has: page.locator('svg') })
    .last();
  await sendButton.click();
}

/**
 * Helper: Wait for chatbot response
 */
async function waitForChatbotResponse(page: Page): Promise<string> {
  // Wait for the typing indicator to appear and then disappear
  // The typing indicator has 3 animated dots
  await page.waitForTimeout(1000);

  // Wait for a new assistant message to appear
  // Assistant messages have a Bot icon and are left-aligned
  const assistantMessages = page.locator('div:has(> div > svg)').filter({
    has: page.locator('p'),
  });

  // Get the last message text
  const lastMessage = assistantMessages.last().locator('p').first();
  await expect(lastMessage).toBeVisible({ timeout: 15000 });

  const messageText = await lastMessage.textContent();
  return messageText || '';
}

test.describe('Customer Chatbot with MCP', () => {
  test('should open chat widget and interact with chatbot', async ({
    authenticatedPage,
    testTenant,
  }) => {
    // Step 1: Navigate to tenant storefront
    await goToStorefront(authenticatedPage, testTenant.slug);

    // Verify we're on the storefront page
    await expect(authenticatedPage).toHaveURL(new RegExp(`/t/${testTenant.slug}`));

    // Step 2: Open the customer chat widget
    await openChatWidget(authenticatedPage);

    // Step 3: Interact with the chatbot - ask about services
    await sendChatMessage(authenticatedPage, 'What services do you offer?');

    // Step 4: Wait for and verify chatbot response
    const response1 = await waitForChatbotResponse(authenticatedPage);
    expect(response1).toBeTruthy();
    expect(response1.length).toBeGreaterThan(10);

    // Step 5: Ask another question - check availability
    await sendChatMessage(authenticatedPage, 'What dates are available next week?');

    // Wait for response
    const response2 = await waitForChatbotResponse(authenticatedPage);
    expect(response2).toBeTruthy();
    expect(response2.length).toBeGreaterThan(10);

    // Step 6: Attempt to book (this will create a T3 proposal)
    await sendChatMessage(
      authenticatedPage,
      'I want to book a session for next Monday at 2pm. My name is Jane Doe and email is jane@example.com'
    );

    // Wait for response - should mention booking or confirmation
    const response3 = await waitForChatbotResponse(authenticatedPage);
    expect(response3).toBeTruthy();
    expect(response3.toLowerCase()).toMatch(/book|confirm|appointment|session/);

    // Verify chat history is preserved
    const allMessages = authenticatedPage.locator('div[class*="flex gap-3"]');
    const messageCount = await allMessages.count();
    expect(messageCount).toBeGreaterThanOrEqual(6); // 3 user + 3 assistant messages minimum
  });

  test('should handle greeting message when opening chat', async ({
    authenticatedPage,
    testTenant,
  }) => {
    await goToStorefront(authenticatedPage, testTenant.slug);
    await openChatWidget(authenticatedPage);

    // Should see a greeting message immediately
    const greetingMessage = authenticatedPage
      .locator('p')
      .filter({ hasText: /help|book|welcome|service/i })
      .first();
    await expect(greetingMessage).toBeVisible({ timeout: 10000 });
  });

  test('should close chat widget when close button is clicked', async ({
    authenticatedPage,
    testTenant,
  }) => {
    await goToStorefront(authenticatedPage, testTenant.slug);
    await openChatWidget(authenticatedPage);

    // Find and click the close button
    const closeButton = authenticatedPage.locator('button[aria-label="Close chat"]');
    await expect(closeButton).toBeVisible({ timeout: 5000 });
    await closeButton.click();

    // Widget should close and show the bubble again
    const chatBubble = authenticatedPage.locator('button[aria-label="Open chat"]');
    await expect(chatBubble).toBeVisible({ timeout: 5000 });
  });
});
