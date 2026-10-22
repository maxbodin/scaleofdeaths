import type { ViewState } from '../../shared/url-state.ts';

/**
 * Applies a change made with a control to the view state.
 *
 * @param patch Changed state fields.
 */
export type Patch = (patch: Partial<ViewState>) => void;

/**
 * Updates a control so it shows the given view state.
 *
 * @param state View state to show.
 */
export type Sync = (state: ViewState) => void;
