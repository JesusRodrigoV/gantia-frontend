import { effect, Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ThemeHandler {
  isDarkMode = signal<boolean>(this.getInitialState());

  constructor() {
    effect(() => {
      const isDark = this.isDarkMode();

      const htmlElement = document.documentElement;

      if (isDark) {
        htmlElement.classList.add('app-dark');
        localStorage.setItem('theme', 'dark');
      } else {
        htmlElement.classList.remove('app-dark');
        localStorage.setItem('theme', 'light');
      }
    });
  }

  toggleTheme(): void {
    this.isDarkMode.update((current) => !current);
  }

  private getInitialState(): boolean {
    const storedPreference = localStorage.getItem('theme');

    if (storedPreference !== null) {
      return storedPreference === 'dark';
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
}