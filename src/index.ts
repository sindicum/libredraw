// LibreDraw - MapLibre GL JS polygon drawing and editing library
export { LibreDraw } from './LibreDraw';

// Public types
export type {
  Position,
  PolygonGeometry,
  FeatureProperties,
  LibreDrawFeature,
  ActionType,
  Action,
} from './types';

export type {
  LibreDrawEventMap,
  CreateEvent,
  UpdateEvent,
  DeleteEvent,
  SelectionChangeEvent,
  ModeChangeEvent,
} from './types';

export type {
  LibreDrawOptions,
  ToolbarOptions,
  ToolbarPosition,
  ToolbarControls,
} from './types';

export type {
  NormalizedInputEvent,
  InputType,
} from './types';

// Mode name type
export type { ModeName } from './core/ModeManager';

// Error class
export { LibreDrawError } from './core/errors';
