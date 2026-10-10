import { NeuroSpace, Int32NeuroVol, Float64NeuroVol, Float32NeuroVec, ClusteredNeuroVol } from 'neuroimjs';
import { VolumeAtlas, SurfaceAtlas } from '../src/index.js';
import type { Atlas, RegionSelector, VolumeLike, SeriesLike } from '../src/index.js';

const space = new NeuroSpace([2, 1, 1]);
const labels = new Int32NeuroVol(space, new Int32Array([1, 2]));
const regions = [{ id: 1, label: 'L' }, { id: 2, label: 'R' }] as const;
const atlas = new VolumeAtlas({ name: 'typed', volume: labels, regions });
const nativeSpace: NeuroSpace = atlas.space;
const output: Int32NeuroVol = atlas.toVolume(Int32NeuroVol);
const mapped: Float64NeuroVol = atlas.mapValues(atlas.values([{ id: 1, value: 1 }, { id: 2, value: 2 }]), Float64NeuroVol);
const input: VolumeLike = labels;
declare const clustered: ClusteredNeuroVol;
const clusterInput: VolumeLike = clustered;
const series: SeriesLike = new Float32NeuroVec(new NeuroSpace([2, 1, 1, 2]));
atlas.reduceSeries(series);

// @ts-expect-error Hemisphere must use the canonical vocabulary.
const badHemisphere: RegionSelector = { label: 'L', hemisphere: 'LH' };
// @ts-expect-error A selector cannot combine short and full label alternatives.
const ambiguousSelector: RegionSelector = { label: 'L', fullLabel: 'L_area' };
// @ts-expect-error An integer constructor cannot preserve projected floating-point values.
atlas.mapValues(atlas.values([{ id: 1, value: 1 }, { id: 2, value: 2 }]), Int32NeuroVol);
// @ts-expect-error Region metadata is immutable.
atlas.regions.items[0]!.label = 'changed';

function sample(a: Atlas): number {
  return a.kind === 'volume' ? a.size : a.vertexCount('left');
}
const surface = new SurfaceAtlas({ name: 'surface', regions, left: [1], right: [2] });
void [nativeSpace, output, mapped, input, clusterInput, badHemisphere, ambiguousSelector, sample(surface), sample(atlas)];
