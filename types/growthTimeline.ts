export type GrowthPhoto = {
  id: string;
  userPlantId: string;
  userId: string;
  note: string | null;
  photoUrl: string;
  loggedAt: string;
  createdAt: string;
};

export type GrowthTimelineErrorCode =
  | "auth_required"
  | "invalid_input"
  | "network_error"
  | "not_found"
  | "storage_error";

export type GrowthTimelineResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      code: GrowthTimelineErrorCode;
      message: string;
    };
