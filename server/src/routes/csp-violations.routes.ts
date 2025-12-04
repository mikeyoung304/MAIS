/**
 * CSP Violation Reporting Endpoint
 *
 * Receives and logs Content Security Policy violations.
 * Helps identify CSP misconfigurations and potential attacks.
 */

import express from 'express';
import { logger } from '../lib/core/logger';

const router = express.Router();

/**
 * POST /api/v1/csp-violations
 *
 * Receives CSP violation reports from browsers.
 * Always returns 204 (don't expose internal errors).
 */
router.post('/csp-violations', express.json({ type: 'application/csp-report' }), (req, res) => {
  const report = req.body['csp-report'];

  if (report) {
    logger.warn(
      {
        type: 'csp-violation',
        documentUri: report['document-uri'],
        violatedDirective: report['violated-directive'],
        blockedUri: report['blocked-uri'],
        sourceFile: report['source-file'],
        lineNumber: report['line-number'],
        originalPolicy: report['original-policy'],
      },
      'Content Security Policy violation detected'
    );
  }

  // Always return 204 (don't expose internal errors)
  res.status(204).end();
});

export { router as cspViolationsRouter };
