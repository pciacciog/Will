import { Will } from "@shared/schema";

interface DailyRoom {
  id: string;
  name: string;
  api_created: boolean;
  privacy: string;
  url: string;
  created_at: string;
  config: {
    start_video_off: boolean;
    start_audio_off: boolean;
    exp: number;
  };
}

interface CreateRoomOptions {
  willId: number;
  scheduledStart: Date;
  durationMinutes?: number;
}

export class DailyService {
  private apiKey: string;
  private baseUrl = 'https://api.daily.co/v1';

  constructor() {
    if (!process.env.DAILY_API_KEY) {
      throw new Error('DAILY_API_KEY environment variable is required');
    }
    this.apiKey = process.env.DAILY_API_KEY;
    console.log('[DailyService] Initialized with API key:', this.apiKey ? this.apiKey.substring(0, 8) + '...' : 'NOT SET');
  }

  async createEndRoom({ willId, scheduledStart, durationMinutes = 30 }: CreateRoomOptions): Promise<DailyRoom> {
    const roomName = `will-${willId}-endroom-${Date.now()}`;
    const expireTime = Math.floor(scheduledStart.getTime() / 1000) + (durationMinutes * 60);

    console.log('[DailyService] Creating room with config:', { roomName, expireTime });
    
    const response = await fetch(`${this.baseUrl}/rooms`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: roomName,
        privacy: 'public',
        properties: {
          start_video_off: false,
          start_audio_off: false,
          enable_chat: true,
          enable_screenshare: true,
          enable_recording: false,
          max_participants: 10,
          exp: expireTime,
          enable_knocking: false,
          enable_prejoin_ui: false,
          enable_network_ui: false,
          enable_people_ui: true,
          owner_only_broadcast: false,
          enable_mesh_sfu: false,
          sfu_switchover: 0.5,
          eject_at_room_exp: true,
          eject_after_elapsed: 1800,
          lang: 'en',
          geo: 'us-west-2',
          enable_dialin: false,
          enable_sip: false,
          signaling_impl: 'ws',
          ice_transport_policy: 'all'
        }
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create Daily room: ${response.status} - ${error}`);
    }

    const room: DailyRoom = await response.json();
    return room;
  }

  async deleteRoom(roomName: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/rooms/${roomName}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Failed to delete Daily room ${roomName}: ${response.status} - ${error}`);
      // Don't throw here - room deletion is not critical
    }
  }

  async getRoomInfo(roomName: string): Promise<DailyRoom | null> {
    const response = await fetch(`${this.baseUrl}/rooms/${roomName}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const error = await response.text();
      throw new Error(`Failed to get Daily room info: ${response.status} - ${error}`);
    }

    const room: DailyRoom = await response.json();
    return room;
  }

  calculateEndRoomTime(willEndDate: Date): Date {
    // Schedule End Room for 1 hour after will ends (within the 48-hour window)
    const endRoomTime = new Date(willEndDate);
    endRoomTime.setHours(endRoomTime.getHours() + 1);
    return endRoomTime;
  }

  isValidEndRoomTime(willEndDate: Date, proposedTime: Date): boolean {
    const willEnd = willEndDate.getTime();
    const proposed = proposedTime.getTime();
    const maxDelay = 48 * 60 * 60 * 1000; // 48 hours in milliseconds

    return proposed > willEnd && proposed <= willEnd + maxDelay;
  }
}

export const dailyService = new DailyService();