import { Room, WiserClient } from '@string-bean/drayton-wiser-client';

export interface BoostOptions {
  durationMinutes: number;
  temperatureIncrease: number;
}

// the client library doesn't support timed overrides, so we send them using
// its internal request method
interface RawWiserClient {
  request(
    endpoint: string,
    method: string,
    body: unknown,
  ): Promise<{ status: number }>;
}

/**
 * Overrides the set point of a room for a limited time, after which it
 * returns to its schedule.
 */
export async function boostRoom(
  client: WiserClient,
  roomId: number,
  setPoint: number,
  durationMinutes: number,
): Promise<Room> {
  const response = await (<RawWiserClient>(<unknown>client)).request(
    `domain/Room/${roomId}`,
    'PATCH',
    {
      RequestOverride: {
        Type: 'Manual',
        Originator: 'App',
        DurationMinutes: durationMinutes,
        SetPoint: Math.round(setPoint * 10),
      },
    },
  );

  if (response.status !== 200) {
    throw new Error('unexpected-response');
  }

  // wiser returns a stale room status so we need to re-request an update
  return client.roomStatus(roomId);
}
