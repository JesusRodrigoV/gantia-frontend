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
import { $dt } from '@primeuix/themes';
import { ThemeHandler } from '@core/services/theme-handler';

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

  private canvasRef = viewChild.required<ElementRef<HTMLDivElement>>('canvasContainer');

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private handModel: THREE.Group | null = null;
  private orbit: OrbitControls | null = null;

  private animationId: number = 0;
  private lastTime: number = 0;

  private currentPitch: number = 0;
  private currentRoll: number = 0;
  private currentYaw: number = 0;

  constructor() {
    afterNextRender({
      write: () => {
        this.initThree();
        this.lastTime = performance.now();
        this.animate();
      },
    });

    effect(() => {
      this.themeHandler.isDarkMode();

      if (this.scene) {
        setTimeout(() => {
          this.updateEnvironmentColors();
        }, 0);
      }
    });
  }

  private updateEnvironmentColors() {
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

  private initThree() {
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

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
    directionalLight.position.set(0, 5, 0);
    this.scene.add(directionalLight);

    const dLightHelper = new THREE.DirectionalLightHelper(directionalLight, 5);
    this.scene.add(dLightHelper);

    const planeGeometry = new THREE.PlaneGeometry(10, 10);
    const planeMaterial = new THREE.MeshStandardMaterial({
      color: 0x808080,
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    this.scene.add(plane);

    const gridHelper = new THREE.GridHelper();
    this.scene.add(gridHelper);
    this.scene.add(new THREE.AxesHelper(10));

    this.updateEnvironmentColors();

    const loader = new GLTFLoader();
    loader.load(
      '/hand/scene.gltf',
      (gltf) => {
        this.handModel = gltf.scene;
        this.handModel.position.y = -1;
        this.scene.add(this.handModel);
      },
      undefined,
      (error) => {
        console.error(error);
      },
    );

    const resizeHandler = this.onWindowResize.bind(this);
    this.window.addEventListener('resize', resizeHandler);

    this.destroyRef.onDestroy(() => {
      this.window.removeEventListener('resize', resizeHandler);
      cancelAnimationFrame(this.animationId);
      this.renderer.dispose();
    });
  }

  private animate() {
    this.animationId = requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    const telemetry = this.sensorSocket.telemetry();

    if (telemetry && telemetry.is_active && this.handModel) {
      const accelPitch = Math.atan2(
        telemetry.accel_y,
        Math.sqrt(telemetry.accel_x ** 2 + telemetry.accel_z ** 2),
      );
      const accelRoll = Math.atan2(-telemetry.accel_x, telemetry.accel_z);

      const gyroPitchRate = telemetry.gyro_x * (Math.PI / 180);
      const gyroRollRate = telemetry.gyro_y * (Math.PI / 180);
      const gyroYawRate = telemetry.gyro_z * (Math.PI / 180);

      this.currentPitch = 0.96 * (this.currentPitch + gyroPitchRate * dt) + 0.04 * accelPitch;
      this.currentRoll = 0.96 * (this.currentRoll + gyroRollRate * dt) + 0.04 * accelRoll;
      this.currentYaw = this.currentYaw + gyroYawRate * dt;

      this.handModel.rotation.set(this.currentPitch, this.currentYaw, this.currentRoll, 'XYZ');

      const scaleY = Math.max(0.1, 1 - telemetry.flex_index / 100);
      this.handModel.scale.set(1, scaleY, 1);
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
}
