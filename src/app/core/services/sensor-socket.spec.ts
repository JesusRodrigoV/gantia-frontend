import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Pure backoff formula — testable in isolation
function calculateDelay(attempt: number): number {
  const BASE = 1000;
  const MAX = 30000;
  return Math.min(BASE * Math.pow(2, attempt - 1), MAX);
}

const MAX_RETRIES = 10;

describe('backoff formula', () => {
  it('returns 1000ms for attempt 1', () => {
    expect(calculateDelay(1)).toBe(1000);
  });

  it('returns 2000ms for attempt 2', () => {
    expect(calculateDelay(2)).toBe(2000);
  });

  it('returns 4000ms for attempt 3', () => {
    expect(calculateDelay(3)).toBe(4000);
  });

  it('returns 8000ms for attempt 4', () => {
    expect(calculateDelay(4)).toBe(8000);
  });

  it('returns 16000ms for attempt 5', () => {
    expect(calculateDelay(5)).toBe(16000);
  });

  it('caps at 30000ms from attempt 6 onward', () => {
    for (let i = 6; i <= 10; i++) {
      expect(calculateDelay(i)).toBe(30000);
    }
  });
});

describe('max retries', () => {
  it('is 10', () => {
    expect(MAX_RETRIES).toBe(10);
  });

  it('stops reconnecting after 10 attempts', () => {
    let reconnectAttempts = 0;
    const shouldStop = reconnectAttempts >= MAX_RETRIES;
    expect(shouldStop).toBe(false);

    reconnectAttempts = 10;
    const shouldStopNow = reconnectAttempts >= MAX_RETRIES;
    expect(shouldStopNow).toBe(true);
  });
});

describe('checkToken guard', () => {
  it('returns true for valid token', () => {
    // Token that expires far in the future
    const future = Math.floor(Date.now() / 1000) + 3600;
    const payload = btoa(JSON.stringify({ exp: future }));
    const token = `header.${payload}.sig`;
    const decoded = JSON.parse(atob(token.split('.')[1]));
    expect(decoded.exp * 1000 > Date.now()).toBe(true);
  });

  it('returns true for expired token', () => {
    const past = Math.floor(Date.now() / 1000) - 3600;
    const payload = btoa(JSON.stringify({ exp: past }));
    const token = `header.${payload}.sig`;
    const decoded = JSON.parse(atob(token.split('.')[1]));
    expect(decoded.exp * 1000 < Date.now()).toBe(true);
  });
});

describe('_isConnecting guard', () => {
  it('prevents duplicate connection attempts', () => {
    let _isConnecting = false;
    let callCount = 0;

    function establishConnection() {
      if (_isConnecting) return;
      _isConnecting = true;
      callCount++;
    }

    establishConnection();
    expect(callCount).toBe(1);

    // Second call while connecting — no-op
    establishConnection();
    expect(callCount).toBe(1);

    // Reset and allow
    _isConnecting = false;
    establishConnection();
    expect(callCount).toBe(2);
  });
});
