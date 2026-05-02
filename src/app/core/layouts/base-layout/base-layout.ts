import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from '@components/header';

@Component({
  selector: 'app-base-layout',
  imports: [Header,  RouterOutlet],
  templateUrl: './base-layout.html',
  styleUrl: './base-layout.scss',
})
export default class BaseLayout {}
