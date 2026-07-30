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
import { fromEvent } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WINDOW } from '@core/tokens/window.token';
import { SensorSocket } from '@core/services/sensor-socket';
import { ToastService } from '@core/services/toast.service';
import { ThemeHandler } from '@core/utils/theme-handler';
import { getActionLabel } from '@core/models/glove-telemetry.model';
import { FLEX_STATE_LABELS } from '@core/models/gesture-config.model';
import { HandScene } from './hand-scene';
import { HandRenderer } from './hand-renderer';

@Component({
  selector: 'app-hand-canvas',
  imports: [DecimalPipe, Tooltip, Toast],
  templateUrl: './hand-canvas.html',
  styleUrl: './hand-canvas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class HandCanvas {
  private window = inject(WINDOW);
  private readonly document = inject(DOCUMENT);
  private destroyRef = inject(DestroyRef);
  protected sensorSocket = inject(SensorSocket);
  protected FLEX_STATE_LABELS = FLEX_STATE_LABELS;
  private themeHandler = inject(ThemeHandler);
  private toast = inject(ToastService);
  private scene3d: HandScene | null = null;
  private renderer = new HandRenderer();

  private canvasRef = viewChild.required<ElementRef<HTMLDivElement>>('canvasContainer');

  protected modelLoaded = signal(false);
  protected modelError = signal(false);
  protected loadProgress = signal(0);

  private effectPrevActionCount = 0;

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
      this.renderer.renderPending = true;
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
          this.toast.info('Gesto detectado', label, 2000, 'hand-toast', 'bx bx-flash');
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
        this.renderer.autoRotate = false;
        this.renderer.renderPending = true;
      });
      this.scene3d.onOrbitChange(() => { this.renderer.renderPending = true; });

      fromEvent(this.rendererDom(), 'dblclick')
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.resetCamera());

      this.scene3d.updateEnvironmentColors();
      this.scene3d.loadHandModel(
        () => this.modelLoaded.set(true),
        (pct) => this.loadProgress.set(pct),
        () => this.modelError.set(true),
      );

      this.renderer.start();
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
        this.renderer.stop();
      } else {
        this.renderer.start();
        this.animate();
      }
    };
    this.document.addEventListener('visibilitychange', visibilityHandler);

    this.destroyRef.onDestroy(() => {
      this.renderer.stop();
      this.window.removeEventListener('resize', resizeHandler);
      this.document.removeEventListener('visibilitychange', visibilityHandler);
      this.scene3d?.dispose();
    });
  }

  private animate(): void {
    this.renderer.animate(
      this.scene3d!,
      () => this.sensorSocket.telemetry(),
      () => this.sensorSocket.recentActions().length,
    );
  }

  protected resetCamera(): void {
    this.renderer.resetCamera(this.scene3d);
  }

  private onWindowResize(): void {
    if (!this.scene3d) return;
    const container = this.canvasRef().nativeElement;
    this.scene3d.onResize(container.clientWidth, container.clientHeight);
    this.renderer.renderPending = true;
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
