/**
 * ESLint Rule: landing-page-config-wrapper
 *
 * Purpose: Prevent direct object assignments to landingPageConfig field.
 * Instead, enforce use of createPublishedWrapper() helper.
 *
 * Why: The wrapper format requires specific fields (draft, draftUpdatedAt, published, publishedAt).
 * Without publishedAt timestamp, published changes become invisible to the public API.
 *
 * Related: Bug #697 - Dual draft system publish mismatch fix
 * Documentation: docs/solutions/WRAPPER_FORMAT_PREVENTION.md
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Ensure landingPageConfig updates use createPublishedWrapper() helper',
      category: 'Security & Data Quality',
      url: 'docs/solutions/WRAPPER_FORMAT_PREVENTION.md',
    },
    fixable: 'code',
    messages: {
      useWrapper:
        'Use createPublishedWrapper() helper for landingPageConfig updates. Manually constructed objects are missing the publishedAt timestamp.',
      importRequired: 'Import createPublishedWrapper from lib/landing-page-utils',
    },
  },

  create(context) {
    return {
      // Pattern: { landingPageConfig: { ... } }
      // Detects object property assignments
      Property(node) {
        if (!node.key || node.key.name !== 'landingPageConfig') {
          return;
        }

        // Skip if value is identifier (variable reference)
        // e.g., { landingPageConfig: wrapper }
        if (node.value.type === 'Identifier') {
          return;
        }

        // Skip if value is call expression like createPublishedWrapper()
        if (node.value.type === 'CallExpression') {
          const callee =
            node.value.callee.type === 'Identifier'
              ? node.value.callee.name
              : node.value.callee.property?.name;

          if (callee === 'createPublishedWrapper') {
            return; // This is correct usage
          }
        }

        // If it's an object literal, check for wrapper-like pattern
        if (node.value.type === 'ObjectExpression') {
          const properties = node.value.properties.map((prop) => prop.key?.name).filter(Boolean);

          // If it has 'published' and looks like manual wrapper construction
          if (properties.includes('published')) {
            context.report({
              node: node.value,
              messageId: 'useWrapper',
              fix(fixer) {
                // Try to extract the published value
                const hasPublishedAt = properties.includes('publishedAt');

                if (!hasPublishedAt) {
                  // Likely pattern: { published: draftConfig }
                  // Find the publishedProperty value
                  const publishedProp = node.value.properties.find(
                    (p) => p.key?.name === 'published'
                  );

                  if (publishedProp) {
                    const source = context.getSourceCode();
                    const text = source.getText(publishedProp.value);
                    return fixer.replaceText(node.value, `createPublishedWrapper(${text})`);
                  }
                }
              },
            });
          }
        }
      },

      // Also check for direct assignments in update calls
      // Pattern: .update({ landingPageConfig: { published: ... } })
      CallExpression(node) {
        // Look for patterns like: tenantRepo.update(tenantId, { landingPageConfig: ... })
        if (
          node.callee.property &&
          (node.callee.property.name === 'update' ||
            node.callee.property.name === 'updateLandingPageConfig')
        ) {
          // Check second argument (usually the data object)
          const dataArg = node.arguments[1];
          if (dataArg && dataArg.type === 'ObjectExpression') {
            const config = dataArg.properties.find((p) => p.key?.name === 'landingPageConfig');

            if (config && config.value.type === 'ObjectExpression') {
              const properties = config.value.properties.map((p) => p.key?.name);

              if (properties.includes('published') && !properties.includes('publishedAt')) {
                context.report({
                  node: config.value,
                  messageId: 'useWrapper',
                });
              }
            }
          }
        }
      },
    };
  },
};
