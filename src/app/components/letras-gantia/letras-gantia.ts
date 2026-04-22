import { Component, OnInit, signal } from '@angular/core';
import { gsap } from 'gsap';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';

gsap.registerPlugin(ScrambleTextPlugin);

@Component({
  selector: 'app-letras-gantia',
  imports: [],
  templateUrl: './letras-gantia.html',
  styleUrl: './letras-gantia.scss',
})
export class LetrasGantia implements OnInit {
  griego = "γαντια";
  normal = "Gantia"
  letrasGriegas = "γαντιαμπωψχφυυ";
  isvisible = signal(false);

  ngOnInit(): void {
    this.startSystem();
  }

  private startSystem(): void {
    this.isvisible.set(true);
  }

  onEnter(event: any): void {
    const el = event.target;

    gsap.fromTo(
      el,
      { opacity: 0 },
      {
        duration: 1.5,
        opacity: 1,
        scrambleText: {
          text: this.normal,
          chars: this.letrasGriegas,
          revealDelay: 0.2,
          speed: 0.75,
        },
        onComplete: () => event.animationComplete(),
      },
    );
  }

  onLeave(event: any): void {
    const el = event.target;

    gsap.to(el, {
      duration: 0.8,
      opacity: 0,
      x: -20,
      onComplete: () => event.animationComplete(),
    });
  }
}