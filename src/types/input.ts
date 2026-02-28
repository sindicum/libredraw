/**
 * The type of input device that generated an event.
 */
export type InputType = 'mouse' | 'touch';

/**
 * A normalized input event shared across mouse and touch handlers.
 */
export interface NormalizedInputEvent {
  /** The geographic coordinate at the event location. */
  lngLat: { lng: number; lat: number };
  /** The screen pixel coordinate at the event location. */
  point: { x: number; y: number };
  /** The original DOM event. */
  originalEvent: MouseEvent | TouchEvent;
  /** The input device type that generated this event. */
  inputType: InputType;
}
