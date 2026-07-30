import { inject, Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';

interface ErrorDetail {
  detail?: string;
  [key: string]: unknown;
}

function extractServerDetail(err: unknown): string | null {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as ErrorDetail | null;
    if (body?.detail) {
      return typeof body.detail === 'string' ? body.detail : null;
    }
    if (err.status === 0) return 'No se pudo conectar al servidor';
    if (err.status === 404) return 'El recurso solicitado no existe';
    if (err.status === 409) return 'El recurso ya existe o hay un conflicto';
    if (err.status >= 500) return 'Error interno del servidor. Intentá de nuevo más tarde.';
  }
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    if (obj['error'] && typeof obj['error'] === 'object') {
      const sub = obj['error'] as ErrorDetail;
      if (sub.detail) return typeof sub.detail === 'string' ? sub.detail : null;
    }
  }
  return null;
}

function extractErrorDetail(err: unknown, fallback: string): string {
  return extractServerDetail(err) || fallback;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly messageService = inject(MessageService);

  success(summary: string, detail: string, life = 3000, key?: string, icon?: string): void {
    this.messageService.add({ severity: 'success', summary, detail, life, key, icon });
  }

  info(summary: string, detail: string, life = 3000, key?: string, icon?: string): void {
    this.messageService.add({ severity: 'info', summary, detail, life, key, icon });
  }

  warn(summary: string, detail: string, life = 4000, key?: string, icon?: string): void {
    this.messageService.add({ severity: 'warn', summary, detail, life, key, icon });
  }

  error(summary: string, detail: string, life = 5000, key?: string, icon?: string): void {
    this.messageService.add({ severity: 'error', summary, detail, life, key, icon });
  }

  httpError(err: unknown, summary: string, fallback: string): void {
    const detail = extractErrorDetail(err, fallback);
    this.error(summary, detail);
  }
}
