/**
 * Layer id → factory. Ids and order follow the catalogue in state/layers.ts.
 * Adding a layer = an entry in LAYERS + a factory here.
 */
import { LAYERS } from '../../state/layers';
import type { Dim, Layer, LayerFactory } from '../types';
import { AreaLayer } from './area';
import { AxesLayer } from './axes';
import { BasisLayer } from './basis';
import { EigenLayer } from './eigen';
import { GridLayer } from './grid';
import { ObjectsLayer } from './objects';

export const LAYER_FACTORIES: Readonly<Record<string, LayerFactory>> = {
  grid: () => new GridLayer(),
  area: () => new AreaLayer(),
  axes: () => new AxesLayer(),
  basis: () => new BasisLayer(),
  eigen: () => new EigenLayer(),
  objects: () => new ObjectsLayer(),
};

/** Fresh (un-initialised) layers for `dim`, in catalogue order. */
export function createLayers(dim: Dim): Layer[] {
  const out: Layer[] = [];
  for (const info of LAYERS) {
    if (!info.dims.includes(dim)) continue;
    const factory = LAYER_FACTORIES[info.id];
    if (factory) out.push(factory());
    else if (import.meta.env.DEV) console.warn(`No engine layer for catalogue id '${info.id}'`);
  }
  return out;
}
