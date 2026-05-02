import { InjectionToken } from '@angular/core';

export const WINDOW = new InjectionToken<Window>('Gloval Window Object', {
  providedIn: 'root',
  factory: () => window,
});
