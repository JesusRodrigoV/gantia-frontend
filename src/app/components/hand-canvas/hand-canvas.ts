import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  viewChild,
  signal,
  computed,
} from '@angular/core';
import { DecimalPipe, DOCUMENT } from '@angular/common';
import { Tooltip } from 'primeng/tooltip';
import { Toast } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import * as THREE from 'three';
import { WINDOW } from '@core/tokens/window.token';
import { SensorSocket } from '@core/services/sensor-socket';
import { ThemeHandler } from '@core/utils/theme-handler';
import { HandOrientationTracker } from '@core/utils/hand-orientation';
import { getActionLabel } from '@core/models/glove-telemetry.model';
import { FLEX_STATE_LABELS } from '@core/models/gesture-config.model';
import { HandScene } from './hand-scene';

@Component({
  selector: 'app-hand-canvas',
  imports: [DecimalPipe, Tooltip, Toast],
  templateUrl: './hand-canvas.html',
  styleUrl: './hand-canvas.scss',
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class HandCanvas {
  private window = inject(WINDOW);
  private readonly document = inject(DOCUMENT);
  private destroyRef = inject(DestroyRef);
  protected sensorSocket = inject(SensorSocket);
  protected FLEX_STATE_LABELS = FLEX_STATE_LABELS;
  private themeHandler = inject(ThemeHandler);
  private messageService = inject(MessageService);
  private orientationTracker = new HandOrientationTracker();
  private scene3d: HandScene | null = null;

  private canvasRef = viewChild.required<ElementRef<HTMLDivElement>>('canvasContainer');

  protected modelLoaded = signal(false);
  protected modelError = signal(false);
  protected loadProgress = signal(0);

  private animationId: number | null = null;
  private lastTime = 0;
  private running = false;
  private autoRotate = true;
  private renderPending = true;
  private gestureFlash = 0;
  private effectPrevActionCount = 0;
  private animatePrevActionCount = 0;

  protected lastGestureLabel = signal('');
  protected isTransmitting = computed(() => {
    const t = this.sensorSocket.telemetry();
    return t?.button_pressed === 1;
  });

  protected showIdleHint = computed(() => {
    const t = this.sensorSocket.telemetry();
    return !!t && t.button_pressed !== 1 && this.modelLoaded();
  });

  constructor() {
    afterNextRender({
      write: () => {
        this.initScene();
      },
    });

    effect(() => {
      this.themeHandler.isDarkMode();
      this.renderPending = true;
      if (this.scene3d) {
        queueMicrotask(() => this.scene3d!.updateEnvironmentColors());
      }
    });

    effect(() => {
      const actions = this.sensorSocket.recentActions();
      if (actions.length > this.effectPrevActionCount && actions.length > 0) {
        const latest = actions[0];
        const label = getActionLabel(latest.action);
        this.lastGestureLabel.set(label);
        if (latest.action !== 'mouse_mode') {
          this.messageService.add({
            severity: 'info',
            summary: 'Gesto detectado',
            detail: label,
            life: 2000,
            icon: 'bx bx-flash',
            key: 'hand-toast',
          });
        }
        this.effectPrevActionCount = actions.length;
      }
    });
  }

  private initScene(): void {
    try {
      this.registerCleanup();

      const container = this.canvasRef().nativeElement;
      this.scene3d = new HandScene(container, this.window.devicePixelRatio);
      this.scene3d.init();

      this.scene3d.onOrbitStart(() => {
        this.autoRotate = false;
        this.renderPending = true;
      });
      this.scene3d.onOrbitChange(() => { this.renderPending = true; });

      this.rendererDom().addEventListener('dblclick', () => this.resetCamera());

      this.scene3d.updateEnvironmentColors();
      this.scene3d.loadHandModel(
        () => this.modelLoaded.set(true),
        (pct) => this.loadProgress.set(pct),
        () => this.modelError.set(true),
      );

      this.running = true;
      this.lastTime = performance.now();
      this.animate();
    } catch (error) {
      console.error('[HandCanvas] Failed to initialize Three.js scene:', error);
      this.scene3d?.dispose();
    }
  }

  private rendererDom(): HTMLElement {
    return this.scene3d!.renderer!.domElement;
  }

  private registerCleanup(): void {
    const resizeHandler = this.onWindowResize.bind(this);
    this.window.addEventListener('resize', resizeHandler);

    const visibilityHandler = () => {
      if (this.document.hidden) {
        this.running = false;
      } else {
        this.running = true;
        this.lastTime = performance.now();
        this.animate();
      }
    };
    this.document.addEventListener('visibilitychange', visibilityHandler);

    this.destroyRef.onDestroy(() => {
      this.running = false;
      if (this.animationId !== null) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
      this.window.removeEventListener('resize', resizeHandler);
      this.document.removeEventListener('visibilitychange', visibilityHandler);
      this.scene3d?.dispose();
    });
  }

  private animate(): void {
    if (!this.running || !this.scene3d?.renderer || !this.scene3d?.scene || !this.scene3d?.camera) return;

    this.animationId = requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    const s = this.scene3d;
    const telemetry = this.sensorSocket.telemetry();
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
      const actionCount = this.sensorSocket.recentActions().length;
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

  protected resetCamera(): void {
    this.scene3d?.resetCamera();
    this.autoRotate = true;
    this.renderPending = true;
  }

  private onWindowResize(): void {
    if (!this.scene3d) return;
    const container = this.canvasRef().nativeElement;
    this.scene3d.onResize(container.clientWidth, container.clientHeight);
    this.renderPending = true;
  }

  protected retryLoad(): void {
    this.modelError.set(false);
    this.loadProgress.set(0);
    if (this.scene3d) {
      this.scene3d.loadHandModel(
        () => this.modelLoaded.set(true),
        (pct) => this.loadProgress.set(pct),
        () => this.modelError.set(true),
      );
    }
  }
}
