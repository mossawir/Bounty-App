import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedValue } from './useDebouncedValue';
import { useLocalStorageState } from './useLocalStorageState';

describe('useDebouncedValue', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('only publishes the latest value after the delay', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 300),
      { initialProps: { value: 'd' } },
    );

    expect(result.current).toBe('d');

    rerender({ value: 'du' });
    rerender({ value: 'duc' });
    rerender({ value: 'duck' });
    expect(result.current).toBe('d');

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe('d');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('duck');
  });

  it('cancels the pending update when the value comes back before the timer fires', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 100),
      { initialProps: { value: 'a' } },
    );

    rerender({ value: 'b' });
    rerender({ value: 'a' });
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(result.current).toBe('a');
  });
});

describe('useLocalStorageState', () => {
  it('writes updates through to storage', () => {
    const { result } = renderHook(() => useLocalStorageState<number>('counter', 1));
    expect(result.current[0]).toBe(1);

    act(() => result.current[1]((current) => current + 4));

    expect(result.current[0]).toBe(5);
    expect(JSON.parse(localStorage.getItem('counter') ?? 'null')).toBe(5);
  });

  it('keeps tabs in sync through the storage event', () => {
    const { result } = renderHook(() => useLocalStorageState<string>('theme', 'paper'));

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'theme', newValue: '"ink"' }));
    });

    expect(result.current[0]).toBe('ink');
  });

  it('falls back to the initial value when stored JSON is corrupt', () => {
    localStorage.setItem('broken', '{not json');
    const { result } = renderHook(() => useLocalStorageState<string>('broken', 'safe'));
    expect(result.current[0]).toBe('safe');
  });
});
