import {
  afterNextRender,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { WINDOW } from '@core/window.token';
import { SensorSocket } from '@core/services/sensor-socket';
import { ThemeHandler } from '@core/services/theme-handler';
import { HandOrientationTracker } from '@core/services/hand-orientation';

@Component({
  selector: 'app-hand-canvas',
  imports: [],
  templateUrl: './hand-canvas.html',
  styleUrl: './hand-canvas.scss',
})
export default class HandCanvas {
  private window = inject(WINDOW);
  private destroyRef = inject(DestroyRef);
  private sensorSocket = inject(SensorSocket);
  private themeHandler = inject(ThemeHandler);
  private orientationTracker = new HandOrientationTracker();

  private canvasRef = viewChild.required<ElementRef<HTMLDivElement>>('canvasContainer');

  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private handModel: THREE.Group | null = null;
  private orbit: OrbitControls | null = null;

  private animationId: number | null = null;
  private lastTime = 0;
  private running = false;

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

    this.destroyRef.onDestroy(() => {
      this.running = false;
      if (this.animationId !== null) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
      this.window.removeEventListener('resize', resizeHandler);
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
        this.handModel = gltf.scene;
        this.handModel.position.y = -1;
        this.scene!.add(this.handModel);
      },
      undefined,
      (error) => {
        console.error('[HandCanvas] Failed to load hand model:', error);
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

    const telemetry = this.sensorSocket.telemetry();
    if (telemetry && this.handModel) {
      const orientation = this.orientationTracker.update(telemetry, dt);
      if (orientation) {
        this.handModel.rotation.set(orientation.pitch, orientation.yaw, orientation.roll, 'XYZ');
        this.handModel.scale.set(1, orientation.scaleY, 1);
      }
    }

    this.renderer.render(this.scene, this.camera);
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

  private disposeAll() {
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
    this.scene = null;
    this.camera = null;
    this.handModel = null;
    this.orbit = null;
  }
}
