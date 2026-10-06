import { scenePalette, type ObjectColorKey } from '../theme/palette';

/** Valid `SceneObject.colorKey` values, in palette order. */
export const OBJECT_COLOR_KEYS: readonly ObjectColorKey[] = Object.keys(
  scenePalette.objects,
) as ObjectColorKey[];

export function isObjectColorKey(key: unknown): key is ObjectColorKey {
  return typeof key === 'string' && (OBJECT_COLOR_KEYS as readonly string[]).includes(key);
}

/** Colour for the n-th object added, cycling through the palette. */
export function colorKeyFor(index: number): ObjectColorKey {
  return OBJECT_COLOR_KEYS[index % OBJECT_COLOR_KEYS.length];
}
