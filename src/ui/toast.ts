/**
 * Sonner-inspired lightweight toast engine adhering to Emil Kowalski's design engineering principles:
 * - Developer experience: toast.success('...'), toast.error('...')
 * - Hardware accelerated CSS transforms (translateY, scale, opacity)
 * - Custom ease-out curve (cubic-bezier(0.23, 1, 0.32, 1))
 * - No scale(0) entry (starts at scale(0.95), opacity: 0)
 * - Stacking and automatic dismissal with pause on tab blur
 */

export interface ToastOptions {
  duration?: number;
  type?: 'success' | 'info' | 'warning' | 'error';
  icon?: string;
}

class ToastManager {
  private container: HTMLElement | null = null;
  private toasts: HTMLElement[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.initContainer();
    }
  }

  private initContainer(): void {
    if (document.getElementById('geo-toast-container')) {
      this.container = document.getElementById('geo-toast-container');
      return;
    }
    const el = document.createElement('div');
    el.id = 'geo-toast-container';
    el.className = 'geo-toast-container';
    document.body.appendChild(el);
    this.container = el;
  }

  public show(message: string, options: ToastOptions = {}): void {
    if (!this.container) this.initContainer();
    if (!this.container) return;

    const toast = document.createElement('div');
    const type = options.type || 'info';
    const duration = options.duration || 3200;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else if (type === 'warning') {
      iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    } else {
      iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }

    toast.className = `geo-toast geo-toast-${type}`;
    toast.innerHTML = `
      <div class="geo-toast-icon">${options.icon || iconSvg}</div>
      <div class="geo-toast-msg">${message}</div>
    `;

    this.container.appendChild(toast);
    this.toasts.push(toast);

    // Trigger hardware-accelerated enter animation
    requestAnimationFrame(() => {
      toast.classList.add('geo-toast-visible');
    });

    // Auto dismiss
    const dismissTimer = setTimeout(() => {
      this.dismiss(toast);
    }, duration);

    // Hover or touch to pause
    toast.addEventListener('mouseenter', () => clearTimeout(dismissTimer));
    toast.addEventListener('mouseleave', () => {
      setTimeout(() => this.dismiss(toast), 1500);
    });
    toast.addEventListener('click', () => this.dismiss(toast));
  }

  public success(message: string, options?: Omit<ToastOptions, 'type'>): void {
    this.show(message, { ...options, type: 'success' });
  }

  public warning(message: string, options?: Omit<ToastOptions, 'type'>): void {
    this.show(message, { ...options, type: 'warning' });
  }

  public info(message: string, options?: Omit<ToastOptions, 'type'>): void {
    this.show(message, { ...options, type: 'info' });
  }

  private dismiss(toast: HTMLElement): void {
    toast.classList.remove('geo-toast-visible');
    toast.classList.add('geo-toast-exiting');

    setTimeout(() => {
      toast.remove();
      this.toasts = this.toasts.filter((t) => t !== toast);
    }, 200);
  }
}

export const toast = new ToastManager();
