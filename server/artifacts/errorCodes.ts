// Structured error codes for the artifact + delivery pipeline. Every failure
// stage carries one of these so the model can speak a single concise result
// (never multiple speculative explanations) and logs stay greppable.

export type ArtifactErrorCode =
  | "artifact_not_returned"
  | "artifact_parse_failed"
  | "artifact_outside_allowed_root"
  | "artifact_missing"
  | "artifact_changed"
  | "artifact_type_media_unsupported"
  | "artifact_publish_failed"
  | "twilio_media_rejected"
  | "twilio_fetch_failed"
  | "attachment_button_not_found"
  | "native_picker_not_detected"
  | "go_to_folder_failed"
  | "file_not_found_in_picker"
  | "upload_incomplete"
  | "attachment_filename_mismatch"
  | "send_confirmation_missing";

export const ARTIFACT_ERROR_MESSAGE: Record<ArtifactErrorCode, string> = {
  artifact_not_returned: "The file was found but its exact location could not be captured for delivery.",
  artifact_parse_failed: "The located file could not be read as a valid attachment.",
  artifact_outside_allowed_root: "That file is outside the folders Kylian is allowed to send from.",
  artifact_missing: "The file could not be found on disk when preparing to send it.",
  artifact_changed: "The file changed on disk since it was located; please try again.",
  artifact_type_media_unsupported: "That file type can't be sent as WhatsApp media; sending a download link instead.",
  artifact_publish_failed: "Kylian could not prepare a secure link for the file.",
  twilio_media_rejected: "WhatsApp rejected the media message.",
  twilio_fetch_failed: "WhatsApp could not fetch the file.",
  attachment_button_not_found: "The attachment button could not be found in the app.",
  native_picker_not_detected: "The file chooser did not open.",
  go_to_folder_failed: "The file chooser could not navigate to the folder.",
  file_not_found_in_picker: "The file could not be selected in the chooser.",
  upload_incomplete: "The attachment did not finish uploading.",
  attachment_filename_mismatch: "The attached file's name did not match the expected file.",
  send_confirmation_missing: "The app did not confirm the message was sent.",
};

export class ArtifactPipelineError extends Error {
  constructor(readonly code: ArtifactErrorCode, message?: string) {
    super(message ?? ARTIFACT_ERROR_MESSAGE[code]);
    this.name = "ArtifactPipelineError";
  }
}
