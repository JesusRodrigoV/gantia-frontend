import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import {
  GloveTelemetry,
  ActionEvent,
  isActionMessage,
  GestureDetectedEvent,
  isGestureDetected,
} from '@core/models/glove-telemetry.model';
import { env } from '../../../environments/environment';
import { AuthStore } from '@core/stores/auth.store';

const MAX_RECENT_ACTIONS = 30;
const DATA_TIMEOUT_MS = 3000;
const MAX_RETRIES = 10;
const BASE_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const PING_INTERVAL = 30000;
const PONG_TIMEOUT = 10000;

function isTokenExpired(token: string): boolean {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

@Injectable({
  providedIn: 'root',
})
export class SensorSocket implements OnDestroy {
  private readonly authStore = inject(AuthStore);
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private dataTimeout: ReturnType<typeof setTimeout> | null = null;
  private waitingTimer: ReturnType<typeof setTimeout> | null = null;
  private refCount = 0;
  private shouldBeConnected = false;
  private reconnectAttempts = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimeout: ReturnType<typeof setTimeout> | null = null;
  private _isConnecting = false;
  private _reconnectScheduled = false;

  public readonly telemetry = signal<GloveTelemetry | null>(null);
  public readonly connectionStatus = signal<
    'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'
  >('disconnected');
  public readonly actionEvent = signal<ActionEvent | null>(null);
  public readonly recentActions = signal<ActionEvent[]>([]);
  public readonly gestureDetected = signal<GestureDetectedEvent | null>(null);
  public readonly retryCount = signal(0);
  public readonly maxRetries = signal(MAX_RETRIES);
  public readonly lastConnectedAt = signal<number | null>(null);

  private lastMouseModeValue: unknown = null;
  public readonly mouseModeActive = signal(false);
  public readonly currentMode = signal<string>('GLOBAL');
  public readonly dataFlowing = signal(false);
  public readonly waitingForDevice = signal(false);

  // Absolute pointer state
  public readonly absolutePointerEnabled = signal(false);

  private resetDataTimeout(): void {
    if (this.dataTimeout) clearTimeout(this.dataTimeout);
    this.dataFlowing.set(true);
    this.dataTimeout = setTimeout(() => {
      this.dataFlowing.set(false);
    }, DATA_TIMEOUT_MS);
  }

  connect(): void {
    const firstConnection = this.refCount === 0;
    this.refCount++;

    if (!firstConnection) return;

    this.shouldBeConnected = true;
    this.establishConnection();
  }

  private checkToken(): void {
    const token = this.authStore.token();
    if (!token || !this.authStore.isAuthenticated()) {
      this.authStore.logout();
      return;
    }

    if (isTokenExpired(token)) {
      this.authStore.logout();
      return;
    }

    this.establishConnection();
  }

  private establishConnection(): void {
    if (this._isConnecting) return;
    this._isConnecting = true;

    const token = this.authStore.token();
    if (!token) {
      console.warn('[SensorSocket] No hay token disponible');
      this.connectionStatus.set('error');
      this._isConnecting = false;
      return;
    }

    if (!this.authStore.isAuthenticated() || isTokenExpired(token)) {
      console.warn('[SensorSocket] Token expirado o sesión cerrada, redirigiendo a login');
      this.authStore.logout();
      this._isConnecting = false;
      return;
    }

    this.clearReconnectTimer();
    this.connectionStatus.set('connecting');
    this.socket = new WebSocket(`${env.wsUrl}/ws/dashboard?token=${token}`);

    this.socket.onopen = () => {
      this._isConnecting = false;
      this.resetRetryState();
      this.startPingTimer();
      this.waitingForDevice.set(false);
      this.waitingTimer = setTimeout(() => {
        if (!this.telemetry()) {
          this.waitingForDevice.set(true);
        }
      }, 7000);
    };

    this.socket.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'pong') {
          if (this.pongTimeout) {
            clearTimeout(this.pongTimeout);
            this.pongTimeout = null;
          }
          return;
        }

        if (data.type === 'ping') {
          this.socket?.send(JSON.stringify({ type: 'pong' }));
          return;
        }

        if (isGestureDetected(data)) {
          this.gestureDetected.set(data);
          return;
        }

          if (isActionMessage(data)) {
            const msg = data as any;
            const evt: ActionEvent =
              msg.action === 'action_triggered'
                ? { action: String(msg.action_key ?? ''), action_value: msg.action_value }
                : data;

            this.actionEvent.set(evt);

            this.recentActions.update((prev) => [evt, ...prev].slice(0, MAX_RECENT_ACTIONS));

            if (evt.action === 'mouse_mode') {
              const newVal = data.action_value;
              if (newVal !== this.lastMouseModeValue) {
                this.lastMouseModeValue = newVal;
                this.mouseModeActive.set(newVal === true || newVal === 'ON');
              }
            }

            if (evt.action === 'mode_changed') {
              this.currentMode.set(String(evt.action_value).toUpperCase());
            }

            return;
          }

          // Absolute pointer status message
          if (data && data.type === 'absolute_pointer_status') {
            this.absolutePointerEnabled.set(data.enabled === true);
            return;
          }

        if (data && typeof data.accel_x !== 'undefined') {
          this.scheduleTelemetryUpdate(data as GloveTelemetry);
          this.cancelWaitingTimer();
          this.waitingForDevice.set(false);
          this.resetDataTimeout();
        }
      } catch (error) {
        console.warn('[SensorSocket] Failed to parse WebSocket message:', event.data);
      }
    };

    this.socket.onerror = () => {
      this._isConnecting = false;
      this.connectionStatus.set('error');
      this.telemetry.set(null);
      this.dataFlowing.set(false);
      if (this.shouldBeConnected) {
        this.scheduleReconnect();
      }
    };

    this.socket.onclose = () => {
      this._isConnecting = false;
      this.connectionStatus.set('disconnected');
      this.dataFlowing.set(false);
      this.waitingForDevice.set(false);
      this.cancelWaitingTimer();
      this.clearPingTimer();
      if (this.dataTimeout) clearTimeout(this.dataTimeout);

      if (this.shouldBeConnected) {
        this.scheduleReconnect();
      }
    };
  }

  private scheduleReconnect(): void {
    if (this._reconnectScheduled) return;
    this._reconnectScheduled = true;
    this.clearReconnectTimer();
    this.reconnectAttempts++;
    this.retryCount.set(this.reconnectAttempts);

    if (this.reconnectAttempts > MAX_RETRIES) {
      this.connectionStatus.set('disconnected');
      console.warn('[SensorSocket] Max retries alcanzado, desconectado permanentemente');
      return;
    }

    this.connectionStatus.set('reconnecting');
    const delay = Math.min(
      BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts - 1),
      MAX_RECONNECT_DELAY,
    );
    this.reconnectTimer = setTimeout(() => {
      this._reconnectScheduled = false;
      this.checkToken();
    }, delay);
  }

  private resetRetryState(): void {
    this.reconnectAttempts = 0;
    this.retryCount.set(0);
    this.lastConnectedAt.set(Date.now());
    this.connectionStatus.set('connected');
  }

  private startPingTimer(): void {
    this.clearPingTimer();
    this.pingTimer = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'ping' }));
        this.pongTimeout = setTimeout(() => {
          this.connectionStatus.set('reconnecting');
          this.clearPingTimer();
          this.socket?.close();
        }, PONG_TIMEOUT);
      }
    }, PING_INTERVAL);
  }

  private clearPingTimer(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  private clearAllTimers(): void {
    this.clearReconnectTimer();
    this.clearPingTimer();
    this.cancelWaitingTimer();
    if (this.dataTimeout) {
      clearTimeout(this.dataTimeout);
      this.dataTimeout = null;
    }
  }

  disconnect(): void {
    if (this.refCount > 0) this.refCount--;

    if (this.refCount > 0) return;

    this.shouldBeConnected = false;
    this.clearAllTimers();
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
      this.socket = null;
    }
    this.connectionStatus.set('disconnected');
  }

  ngOnDestroy(): void {
    this.shouldBeConnected = false;
    this.refCount = 0;
    this.clearAllTimers();
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
      this.socket = null;
    }
  }

  private cancelWaitingTimer(): void {
    if (this.waitingTimer !== null) {
      clearTimeout(this.waitingTimer);
      this.waitingTimer = null;
    }
  }

  private lastTelemetryUpdate = 0;
  private readonly TELEMETRY_THROTTLE_MS = 33;

  private scheduleTelemetryUpdate(data: GloveTelemetry): void {
    const now = Date.now();
    if (now - this.lastTelemetryUpdate >= this.TELEMETRY_THROTTLE_MS) {
      this.telemetry.set(data);
      this.lastTelemetryUpdate = now;
    }
  }

  sendToggleAbsolutePointer(enabled: boolean): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'toggle_absolute_pointer', enabled }));
    }
  }

  private clearReconnectTimer(): void {
    this._reconnectScheduled = false;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
