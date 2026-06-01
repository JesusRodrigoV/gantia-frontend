import { GloveTelemetry } from '@core/models/glove-telemetry.model';

const ALPHA = 0.96;
const BETA = 0.04;
const DEG_TO_RAD = Math.PI / 180;

export interface HandOrientation {
  pitch: number;
  roll: number;
  yaw: number;
}

export class HandOrientationTracker {
  private pitch = 0;
  private roll = 0;
  private yaw = 0;

  update(telemetry: GloveTelemetry, dt: number): HandOrientation | null {
    if (!telemetry.button_pressed) return null;

    const accelPitch = Math.atan2(
      telemetry.accel_y,
      Math.sqrt(telemetry.accel_x ** 2 + telemetry.accel_z ** 2),
    );
    const accelRoll = Math.atan2(-telemetry.accel_x, telemetry.accel_z);

    const gyroPitchRate = telemetry.gyro_x * DEG_TO_RAD;
    const gyroRollRate = telemetry.gyro_y * DEG_TO_RAD;
    const gyroYawRate = telemetry.gyro_z * DEG_TO_RAD;

    this.pitch = ALPHA * (this.pitch + gyroPitchRate * dt) + BETA * accelPitch;
    this.roll = ALPHA * (this.roll + gyroRollRate * dt) + BETA * accelRoll;
    this.yaw += gyroYawRate * dt;

    return { pitch: this.pitch, roll: this.roll, yaw: this.yaw };
  }

  reset(): void {
    this.pitch = 0;
    this.roll = 0;
    this.yaw = 0;
  }
}
