import {
  afterNextRender,
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
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { WINDOW } from '@core/window.token';
import { SensorSocket } from '@core/services/sensor-socket';
import { ThemeHandler } from '@core/services/theme-handler';
import { HandOrientationTracker } from '@core/services/hand-orientation';
import { getActionLabel } from '@core/models/glove-telemetry.model';

@Component({
  selector: 'app-hand-canvas',
  imports: [DecimalPipe, Tooltip, Toast],
  templateUrl: './hand-canvas.html',
  styleUrl: './hand-canvas.scss',
  providers: [MessageService],
})
export default class HandCanvas {
  private window = inject(WINDOW);
  private readonly document = inject(DOCUMENT);
  private destroyRef = inject(DestroyRef);
  protected sensorSocket = inject(SensorSocket);
  private themeHandler = inject(ThemeHandler);
  private messageService = inject(MessageService);
  private orientationTracker = new HandOrientationTracker();

  private canvasRef = viewChild.required<ElementRef<HTMLDivElement>>('canvasContainer');

  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private handModel: THREE.Group | null = null;
  private orbit: OrbitControls | null = null;
  protected modelLoaded = signal(false);
  protected modelError = signal(false);
  protected loadProgress = signal(0);

  private animationId: number | null = null;
  private lastTime = 0;
  private running = false;
  private autoRotate = true;

  private transmitLight: THREE.PointLight | null = null;
  private gestureRing: THREE.Mesh | null = null;
  private gestureFlash: number = 0;
  private prevActionCount = 0;
  private handMaterials: THREE.Material[] = [];
  private baseEmissive = new THREE.Color(0x000000);

  protected lastGestureLabel = signal('');
  protected isTransmitting = computed(() => {
    const t = this.sensorSocket.telemetry();
    return t?.button_pressed === 1;
  });

  constructor() {
    afterNextRender({
      write: () => {
        this.initScene();
      },
    });

    effect(() => {
      this.themeHandler.isDarkMode();

      if (this.scene) {
        queueMicrotask(() => this.updateEnvironmentColors());
      }
    });

    effect(() => {
      const actions = this.sensorSocket.recentActions();
      if (actions.length > this.prevActionCount && actions.length > 0) {
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
        this.prevActionCount = actions.length;
      }
    });
  }

  private initScene() {
    try {
      this.registerCleanup();

      const container = this.canvasRef().nativeElement;
      const width = container.clientWidth;
      const height = container.clientHeight;

      this.scene = new THREE.Scene();

      this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      this.camera.position.set(5, 7, 5);
      this.camera.lookAt(0, 0, 0);

      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(this.window.devicePixelRatio);
      container.appendChild(this.renderer.domElement);

      this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
      this.orbit.enableDamping = true;
      this.orbit.dampingFactor = 0.08;
      this.orbit.minDistance = 3;
      this.orbit.maxDistance = 20;

      this.orbit.addEventListener('start', () => { this.autoRotate = false; });

      this.renderer.domElement.addEventListener('dblclick', () => this.resetCamera());

      this.setupLights();
      this.setupFloor();
      this.updateEnvironmentColors();
      this.loadHandModel();

      this.running = true;
      this.lastTime = performance.now();
      this.animate();
    } catch (error) {
      console.error('[HandCanvas] Failed to initialize Three.js scene:', error);
      this.disposeAll();
    }
  }

  private registerCleanup() {
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
      this.disposeAll();
    });
  }

  private setupLights() {
    if (!this.scene) return;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
    directionalLight.position.set(0, 5, 0);
    this.scene.add(directionalLight);

    this.transmitLight = new THREE.PointLight(0x4f46e5, 0, 8, 2);
    this.transmitLight.position.set(0, 2, 3);
    this.scene.add(this.transmitLight);
  }

  private setupGestureRing() {
    if (!this.scene) return;

    const ringGeo = new THREE.TorusGeometry(2.5, 0.03, 16, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x4f46e5,
      transparent: true,
      opacity: 0,
    });
    this.gestureRing = new THREE.Mesh(ringGeo, ringMat);
    this.gestureRing.rotation.x = Math.PI / 2;
    this.gestureRing.position.y = 0.5;
    this.scene.add(this.gestureRing);
  }

  private setupFloor() {
    if (!this.scene) return;

    const planeGeometry = new THREE.PlaneGeometry(10, 10);
    const planeMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    this.scene.add(plane);

    this.scene.add(new THREE.GridHelper());
    this.scene.add(new THREE.AxesHelper(10));
  }

  private loadHandModel() {
    if (!this.scene) return;

    const loader = new GLTFLoader();
    loader.load(
      '/hand/scene.gltf',
      (gltf) => {
        if (!this.scene) return;
        this.handModel = gltf.scene;
        this.handModel.position.y = -1;
        this.scene!.add(this.handModel);

        this.handModel.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            for (const mat of mats) {
              if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
                this.handMaterials.push(mat);
                this.baseEmissive.copy(mat.emissive);
              }
            }
          }
        });

        this.setupGestureRing();
        this.modelLoaded.set(true);
      },
      (progress) => {
        if (progress.total > 0) {
          this.loadProgress.set(Math.round((progress.loaded / progress.total) * 100));
        }
      },
      (error) => {
        console.error('[HandCanvas] Failed to load hand model:', error);
        this.modelError.set(true);
      },
    );
  }

  private updateEnvironmentColors() {
    if (!this.scene) return;

    const rootStyle = getComputedStyle(document.documentElement);
    const backgroundColor = rootStyle.getPropertyValue('--p-surface-50').trim() || '#ffffff';
    const gridColor = rootStyle.getPropertyValue('--p-surface-500').trim() || '#808080';

    this.scene.background = new THREE.Color(backgroundColor);

    this.scene.traverse((child) => {
      if (child instanceof THREE.GridHelper) {
        child.material.color.set(new THREE.Color(gridColor));
        child.material.needsUpdate = true;
      }
    });
  }

  private animate() {
    if (!this.running || !this.renderer || !this.scene || !this.camera) return;

    this.animationId = requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    if (this.autoRotate && this.handModel && !this.sensorSocket.telemetry()) {
      this.handModel.rotation.y += dt * 0.4;
    }

    const telemetry = this.sensorSocket.telemetry();
    if (telemetry && this.handModel) {
      const orientation = this.orientationTracker.update(telemetry, dt);
      if (orientation) {
        this.handModel.rotation.set(orientation.pitch, orientation.yaw, orientation.roll, 'XYZ');
        this.handModel.scale.set(1, orientation.scaleY, 1);
      }

      const isTransmitting = telemetry.button_pressed === 1;
      if (this.transmitLight) {
        const pulse = isTransmitting ? (Math.sin(now * 0.005) * 0.3 + 0.7) : 0;
        this.transmitLight.intensity = THREE.MathUtils.lerp(this.transmitLight.intensity, pulse, 0.1);
        this.transmitLight.color.setHSL(0.65, 0.8, isTransmitting ? 0.5 : 0.2);
      }

      const flexIntensity = (telemetry.flex_index + telemetry.flex_middle) / 200;
      for (const mat of this.handMaterials) {
        if (mat instanceof THREE.MeshStandardMaterial) {
          const targetEmissive = isTransmitting ? 0.15 + flexIntensity * 0.2 : 0;
          const r = this.baseEmissive.r + (0.2 - this.baseEmissive.r) * targetEmissive;
          const g = this.baseEmissive.g + (0.15 - this.baseEmissive.g) * targetEmissive;
          const b = this.baseEmissive.b + (0.8 - this.baseEmissive.b) * targetEmissive;
          mat.emissive.setRGB(r, g, b);
        }
      }
    }

    if (this.gestureRing) {
      const actionCount = this.sensorSocket.recentActions().length;
      if (actionCount > this.prevActionCount) {
        this.gestureFlash = 1.0;
        this.prevActionCount = actionCount;
      }
      this.prevActionCount = actionCount;

      if (this.gestureFlash > 0) {
        this.gestureFlash = Math.max(0, this.gestureFlash - dt * 2.5);
        const flash = this.gestureFlash;
        const ringMat = this.gestureRing.material as THREE.MeshBasicMaterial;
        ringMat.opacity = flash * 0.8;
        const scale = 1 + (1 - flash) * 0.5;
        this.gestureRing.scale.set(scale, 1, scale);
        ringMat.color.setHSL(0.7 - flash * 0.2, 0.9, 0.5 + flash * 0.3);
      } else {
        (this.gestureRing.material as THREE.MeshBasicMaterial).opacity = 0;
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  protected resetCamera() {
    if (!this.camera || !this.orbit) return;
    this.camera.position.set(5, 7, 5);
    this.orbit.target.set(0, 0, 0);
    this.orbit.update();
    this.autoRotate = true;
  }

  private onWindowResize() {
    if (!this.renderer || !this.camera) return;

    const container = this.canvasRef().nativeElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  protected retryLoad(): void {
    this.modelError.set(false);
    this.loadProgress.set(0);
    this.loadHandModel();
  }

  private disposeAll() {
    this.orbit?.dispose();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
    if (this.gestureRing) {
      this.gestureRing.geometry.dispose();
      (this.gestureRing.material as THREE.Material).dispose();
      this.gestureRing = null;
    }
    this.handMaterials = [];
    this.scene = null;
    this.camera = null;
    this.handModel = null;
    this.orbit = null;
    this.transmitLight = null;
  }
}
