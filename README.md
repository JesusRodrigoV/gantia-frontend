# Gantia

Gantia es un sistema de control por gestos que permite interactuar con una computadora usando un guante IoT. El usuario mueve la mano, flexiona los dedos y el sistema traduce esos movimientos en acciones: controlar el volumen, navegar presentaciones, mover el mouse, abrir aplicaciones y mucho más.

## Cómo funciona

Un guante equipado con acelerómetro, giroscopio y sensores de flexión captura los movimientos de la mano en tiempo real. Un backend procesa esa información, reconoce los gestos configurados y envía los comandos correspondientes a la computadora.

Este frontend es el panel de control donde el usuario:

- **Monitorea** los sensores del guante en vivo con gráficos y una mano 3D que replica la orientación de su mano real.
- **Configura** qué gesto ejecuta qué acción, organizados por contexto (multimedia, presentaciones, navegación, general).
- **Calibra** los sensores de flexión de cada dedo para adaptarse a cada usuario.
- **Aprende** nuevos gestos al sistema con un wizard que captura muestras y analiza consistencia.
- **Ajusta** parámetros de sensibilidad, velocidad del mouse y el dispositivo objetivo (PC o celular).
- **Revisa** el histórico de sensores y acciones ejecutadas.

## Inicio rápido

```bash
bun install
bun run start
```

Se necesita el backend corriendo en `localhost:8000`.

## Stack

Angular 21 · PrimeNG · Three.js · uPlot · GSAP · @ngrx/signals · Bun
