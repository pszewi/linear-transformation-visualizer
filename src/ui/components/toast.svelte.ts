/** App-wide toast queue. Call `showToast` from anywhere; <Toast /> renders the queue. */

export type ToastTone = 'info' | 'success' | 'error';

export interface ToastItem {
  readonly id: number;
  readonly message: string;
  readonly tone: ToastTone;
}

const MAX_VISIBLE = 3;
let nextId = 1;
let items = $state<ToastItem[]>([]);

export const toasts = {
  get items(): readonly ToastItem[] {
    return items;
  },
};

export function dismissToast(id: number): void {
  items = items.filter((t) => t.id !== id);
}

export function showToast(message: string, tone: ToastTone = 'info', durationMs = 2800): number {
  const id = nextId++;
  items = [...items.slice(-(MAX_VISIBLE - 1)), { id, message, tone }];
  setTimeout(() => dismissToast(id), durationMs);
  return id;
}
