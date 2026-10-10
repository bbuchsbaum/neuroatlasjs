import { same } from './_check.js';
import { errorCode } from './error-code.js';
import { atlas } from './visual-atlas.js';

// #region catch
import { AtlasError } from 'neuroatlasjs';
import type { Region } from 'neuroatlasjs';

// Resolve a short label typed by a user; report ambiguity
// instead of failing, and let every other error through.
function lookup(label: string): Region | 'ambiguous' {
  try {
    return atlas.regions.resolve({ label });
  } catch (error) {
    const ambiguous = error instanceof AtlasError
      && error.code === 'AMBIGUOUS_REGION';
    if (ambiguous) return 'ambiguous';  // ask which hemisphere
    throw error;
  }
}

lookup('vermis');  // { id: 99, label: 'vermis', … }
lookup('V1');      // 'ambiguous'
// lookup('V2') throws an AtlasError with code 'UNKNOWN_REGION'
// #endregion catch
same(lookup('vermis'), atlas.regions.get(99));
same([(lookup('vermis') as Region).id, (lookup('vermis') as Region).label], [99, 'vermis']);
same(lookup('V1'), 'ambiguous');
same(errorCode(() => lookup('V2')), 'UNKNOWN_REGION');
