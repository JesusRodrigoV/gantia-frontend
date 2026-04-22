import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import * as THREE from 'three';
import { WINDOW } from '@core/window.token';

@Component({
  selector: 'app-hand-canvas',
  imports: [],
  templateUrl: './hand-canvas.html',
  styleUrl: './hand-canvas.scss',
})
export class HandCanvas {
  private window = inject(WINDOW

  );
  private destroyRef = inject(DestroyRef);

  private canvasRef = viewChild.required<ElementRef<HTMLDivElement>>('canvasContainer');

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;

  private cube!: THREE.Mesh;

  private animationId: number = 0;

  constructor() {
    afterNextRender({
      write: () => {
        this.initThree();
        this.animate();
      },
    });
  }

  private initThree() {
    const container = this.canvasRef().nativeElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);

    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.set(5, 5, 5); // Un poco más alto
    this.camera.lookAt(0, 0, 0); 

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    const planeGeometry = new THREE.PlaneGeometry(10, 10);
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2; 
    this.scene.add(plane);

    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshNormalMaterial();
    this.cube = new THREE.Mesh(geometry, material); 
    this.cube.position.y = 0.5;
    this.scene.add(this.cube);
    const gridHelper = new THREE.GridHelper();

    this.scene.add(gridHelper);
    this.scene.add(new THREE.AxesHelper(2));

    const resizeHandler = this.onWindowResize.bind(this);
    this.window.addEventListener('resize', resizeHandler);

    this.destroyRef.onDestroy(() => {
      this.window.removeEventListener('resize', resizeHandler);
      cancelAnimationFrame(this.animationId);
      this.renderer.dispose();
      console.log('ThreeJS destruido limpiamente');
    });
  }

  private animate() {
    this.animationId = requestAnimationFrame(() => this.animate());

    if (this.cube) {
      this.cube.rotation.x += 0.01;
      this.cube.rotation.y += 0.01;
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
