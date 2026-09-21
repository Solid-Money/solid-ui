import {
  asOrchestraError,
  ORCHESTRA_ERROR_CODE,
  OrchestraError,
  orchestraErrorFromCode,
  orchestraErrorTitle,
  toOrchestraError,
} from '@/lib/orchestraErrors';
import { fiatLimitsFromResponse } from '@/lib/orchestraFormat';
import { ORCHESTRA_FAILED_STATUSES, ORCHESTRA_SETTLED_STATUSES } from '@/lib/types/orchestra';

import type { OrchestraLimitsResponse } from '@/lib/types/orchestra';

const responseWith = (status: number, body?: unknown) =>
  ({
    status,
    json: async () => {
      if (body === undefined) throw new SyntaxError('Unexpected end of JSON input');
      return body;
    },
  }) as Response;

describe('toOrchestraError', () => {
  it('reads Orchestra’s nested error body', async () => {
    const error = await toOrchestraError(
      responseWith(400, { error: { code: 'amount_too_small', message: 'below minimum' } }),
    );
    expect(error.code).toBe(ORCHESTRA_ERROR_CODE.AMOUNT_TOO_SMALL);
    expect(error.action).toBe('adjust_amount');
    expect(error.status).toBe(400);
    // The user-facing copy is ours; Orchestra's wording is kept for telemetry.
    expect(error.message).not.toBe('below minimum');
    expect(error.rawMessage).toBe('below minimum');
  });

  it('falls back to a generic retry for a body that is not ours', async () => {
    const error = await toOrchestraError(responseWith(502));
    expect(error.code).toBe(ORCHESTRA_ERROR_CODE.UNKNOWN);
    expect(error.action).toBe('retry');
    expect(error.status).toBe(502);
  });

  it('keeps the status so isHTTPError-style checks still work', async () => {
    const error = await toOrchestraError(
      responseWith(403, { error: { code: 'invalid_read_token' } }),
    );
    expect(error.status).toBe(403);
    expect(error).toBeInstanceOf(OrchestraError);
  });
});

describe('orchestraErrorFromCode', () => {
  it('maps order-level failure codes to copy and an action', () => {
    const slippage = orchestraErrorFromCode('slippage_exceeded');
    expect(slippage.action).toBe('none');
    expect(slippage.message).toMatch(/refunded/i);

    const missingRefund = orchestraErrorFromCode('refund_address_missing');
    expect(missingRefund.action).toBe('contact_support');
  });

  it('treats an unknown code as retryable rather than fatal', () => {
    const error = orchestraErrorFromCode('some_new_code_we_have_not_seen');
    expect(error.action).toBe('retry');
    expect(orchestraErrorTitle(error)).toBe('Something went wrong');
  });
});

describe('asOrchestraError', () => {
  it('passes an OrchestraError through untouched', () => {
    const original = orchestraErrorFromCode('amount_too_large', 400);
    expect(asOrchestraError(original)).toBe(original);
  });

  it('turns a dropped connection into something renderable', () => {
    const error = asOrchestraError(new TypeError('Failed to fetch'));
    expect(error.action).toBe('retry');
    expect(error.message).not.toMatch(/fetch/i);
    expect(error.rawMessage).toBe('Failed to fetch');
  });
});

describe('fiatLimitsFromResponse', () => {
  const route = (supported: boolean, min: string, max: string) => ({
    sourceChain: 'lightning',
    sourceAsset: 'BTC',
    destinationChain: 'base',
    destinationAsset: 'USDC',
    limits: { fiatUsd: { supported, min, max } },
  });

  it('picks the first route that actually publishes a fiat band', () => {
    const response: OrchestraLimitsResponse = {
      routes: [route(false, '0.00', '0.00'), route(true, '1.00', '50000.00')],
    };
    expect(fiatLimitsFromResponse(response)?.max).toBe('50000.00');
  });

  it('is undefined when nothing supports fiat, or when the call failed', () => {
    expect(fiatLimitsFromResponse({ routes: [route(false, '1.00', '2.00')] })).toBeUndefined();
    expect(fiatLimitsFromResponse({ routes: [] })).toBeUndefined();
    expect(fiatLimitsFromResponse(undefined)).toBeUndefined();
  });
});

describe('terminal status sets', () => {
  it('does not treat unfulfilled as settled — a late deposit can still resume it', () => {
    expect(ORCHESTRA_SETTLED_STATUSES).not.toContain('unfulfilled');
    expect(ORCHESTRA_FAILED_STATUSES).not.toContain('unfulfilled');
  });

  it('settles on completed as well as the three failure outcomes', () => {
    expect([...ORCHESTRA_SETTLED_STATUSES].sort()).toEqual([
      'completed',
      'expired',
      'failed',
      'refunded',
    ]);
    expect(ORCHESTRA_FAILED_STATUSES).not.toContain('completed');
  });
});
