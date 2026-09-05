import { afterEach, describe, expect, it, vi } from 'vitest';
import { FlowTraceApiClient } from '../src/api-client.js';

const id = '11111111-1111-4111-8111-111111111111';
afterEach(() => vi.unstubAllGlobals());
describe('write transport recovery', () => {
  it('keeps the explicit request ID in headers and unwraps the exact receipt', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            data: { id: 'entity' },
            mutation: { requestId: id, history: { status: [] } },
          }),
          { status: 201 },
        ),
      );
    vi.stubGlobal('fetch', fetch);
    const api = new FlowTraceApiClient('http://flowtrace.test/api', {
      authorization: 'Bearer test',
    });
    expect(
      await api.request('/requirements', {
        method: 'POST',
        body: { title: '需求', requestId: id },
      }),
    ).toEqual({
      id: 'entity',
      _mutation: { requestId: id, history: { status: [] } },
    });
    expect(fetch).toHaveBeenCalledWith(
      'http://flowtrace.test/api/requirements',
      expect.objectContaining({
        body: JSON.stringify({ title: '需求' }),
        headers: expect.objectContaining({
          'x-flowtrace-request-id': id,
          'x-flowtrace-result': 'receipt',
          authorization: 'Bearer test',
        }),
      }),
    );
  });
  it('exposes a recoverable request ID when the connection or response body fails, without retrying', async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('lost'))
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.reject(new Error('body lost')),
      });
    vi.stubGlobal('fetch', fetch);
    const api = new FlowTraceApiClient();
    await expect(
      api.request('/requirements', { method: 'POST', body: { requestId: id } }),
    ).rejects.toThrow(id);
    await expect(
      api.request('/requirements', { method: 'POST', body: { requestId: id } }),
    ).rejects.toThrow('get_operation_result');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
