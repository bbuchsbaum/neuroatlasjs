// #region helper
import { isAtlasError } from 'neuroatlasjs';
import type { AtlasErrorCode } from 'neuroatlasjs';

/** The AtlasError code thrown by `attempt`, or undefined. */
export function errorCode(
  attempt: () => unknown,
): AtlasErrorCode | undefined {
  try {
    attempt();
  } catch (error) {
    if (isAtlasError(error)) return error.code;
    throw error;
  }
  return undefined;
}
// #endregion helper
