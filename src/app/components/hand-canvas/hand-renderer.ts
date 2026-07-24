import * as THREE from 'three';
import { HandOrientationTracker } from '@core/utils/hand-orientation';
import { GloveTelemetry } from '@core/models/glove-telemetry.model';
import { HandScene } from './hand-scene';

export class HandRenderer {
  autoRotate = true;
  renderPending = true;

  private animationId: number | null = null;
  private lastTime = 0;
  private running = false;
  private gestureFlash = 0;
  private animatePrevActionCount = 0;
  private orientationTracker = new HandOrientationTracker();

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
  }

  stop(): void {
    this.running = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  animate(
    scene: HandScene,
    getTelemetry: () => GloveTelemetry | null,
    getActionCount: () => number,
  ): void {
    if (!this.running || !scene.renderer || !scene.scene || !scene.camera) return;

    this.animationId = requestAnimationFrame(() => this.animate(scene, getTelemetry, getActionCount));

    const now = performance.now();
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    const s = scene;
    const telemetry = getTelemetry();
    const hasTelemetry = !!telemetry;
    const needsRender = this.renderPending || hasTelemetry || this.autoRotate || this.gestureFlash > 0;

    if (!needsRender) return;
    this.renderPending = false;

    if (this.autoRotate && s.handModel && !hasTelemetry) {
      s.handModel.rotation.y += dt * 0.4;
    }

    if (telemetry && s.handModel) {
      const orientation = this.orientationTracker.update(telemetry, dt);
      if (orientation) {
        s.handModel.rotation.set(orientation.pitch, orientation.yaw, orientation.roll, 'XYZ');
      }

      const isTransmitting = telemetry.button_pressed === 1;
      if (s.transmitLight) {
        const pulse = isTransmitting ? (Math.sin(now * 0.005) * 0.3 + 0.7) : 0;
        s.transmitLight.intensity = THREE.MathUtils.lerp(s.transmitLight.intensity, pulse, 0.1);
        s.transmitLight.color.setHSL(0.65, 0.8, isTransmitting ? 0.5 : 0.2);
      }

      const flexIntensity = (telemetry.flex_index + telemetry.flex_middle) / 200;
      for (const mat of s.handMaterials) {
        if (mat instanceof THREE.MeshStandardMaterial) {
          const targetEmissive = isTransmitting ? 0.15 + flexIntensity * 0.2 : 0;
          const r = s.baseEmissive.r + (0.2 - s.baseEmissive.r) * targetEmissive;
          const g = s.baseEmissive.g + (0.15 - s.baseEmissive.g) * targetEmissive;
          const b = s.baseEmissive.b + (0.8 - s.baseEmissive.b) * targetEmissive;
          mat.emissive.setRGB(r, g, b);
        }
      }
    }

    if (s.gestureRing) {
      const actionCount = getActionCount();
      if (actionCount > this.animatePrevActionCount) {
        this.gestureFlash = 1.0;
        this.animatePrevActionCount = actionCount;
      }

      if (this.gestureFlash > 0) {
        this.gestureFlash = Math.max(0, this.gestureFlash - dt * 2.5);
        const flash = this.gestureFlash;
        const ringMat = s.gestureRing.material as THREE.MeshBasicMaterial;
        ringMat.opacity = flash * 0.8;
        const scale = 1 + (1 - flash) * 0.5;
        s.gestureRing.scale.set(scale, 1, scale);
        ringMat.color.setHSL(0.7 - flash * 0.2, 0.9, 0.5 + flash * 0.3);
      } else {
        (s.gestureRing.material as THREE.MeshBasicMaterial).opacity = 0;
      }
    }

    s.render();
  }

  resetCamera(scene: HandScene | null): void {
    scene?.resetCamera();
    this.autoRotate = true;
    this.renderPending = true;
  }
}
