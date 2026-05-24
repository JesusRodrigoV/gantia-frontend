import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toast } from 'primeng/toast';

@Component({
  selector: 'app-public-layout',
  imports: [RouterOutlet, Toast],
  templateUrl: './public-layout.html',
})
export default class PublicLayout {

}