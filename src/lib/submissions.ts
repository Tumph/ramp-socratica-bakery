import { createAdminClient } from "./supabase/admin";

export const SUBMISSION_MEDIA_BUCKET = "submission-media";

export function submissionImageUrl(path: string) {
  return createAdminClient().storage.from(SUBMISSION_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}
