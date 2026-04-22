import { NgOptimizedImage } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LetrasGantia } from '@components/letras-gantia/letras-gantia';

@Component({
  selector: 'app-header',
  imports: [NgOptimizedImage, LetrasGantia, RouterLink],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  links=[
    {label: "Dashboard", route: "dashboard"},
    {label: "Telemetria", route: "telemetria"},
    {label: "Dispositivos", route: "dispositivos"},
  ]
}
