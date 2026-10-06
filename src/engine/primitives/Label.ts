/**
 * CSS2D text labels. Styled by engine/labels.css (CSS variables from styles/tokens.css only).
 */
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export class Label {
  readonly object: CSS2DObject;
  private readonly el: HTMLDivElement;
  private text = '';
  private color = '';

  constructor(text: string, className: string) {
    this.el = document.createElement('div');
    this.el.className = `ltv-label ${className}`;
    this.el.setAttribute('aria-hidden', 'true');
    this.object = new CSS2DObject(this.el);
    this.setText(text);
  }

  /** Only touches the DOM when the text actually changes. */
  setText(text: string): void {
    if (text === this.text) return;
    this.text = text;
    this.el.textContent = text;
  }

  /** Inline colour from the scene palette (for colours without a CSS token, e.g. objects). */
  setColor(css: string): void {
    if (css === this.color) return;
    this.color = css;
    this.el.style.color = css;
  }

  set visible(v: boolean) {
    this.object.visible = v;
  }

  get visible(): boolean {
    return this.object.visible;
  }

  dispose(): void {
    this.object.removeFromParent();
    this.el.remove();
  }
}

/** '#rrggbb' for a 0xRRGGBB palette value. */
export function cssHex(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}
