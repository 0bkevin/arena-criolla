// Crown to sole in raw-v1, before independent cell packing. A waist bow lowers
// the head; it must never enlarge the actor to fill an upright bounding box.
export const GEORGE_BODY_HEIGHTS: Record<string, number> = {
  present: 506,
  incline: 470,
  bow: 379,
  recover: 463,
};
export const GEORGE_POSE_SCALE: Record<string, number> = {
  present: 1,
  incline: 1,
  bow: 1,
  recover: 506 / 463,
};
