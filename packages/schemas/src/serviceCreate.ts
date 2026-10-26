import { z } from "zod";
import { serviceInputSchema } from "./service.js";
import { noteTextSchema } from "./serviceLog.js";

/**
 * `POST /api/services`: the service, and the text of its optional intake note
 * (the device's condition at intake, see GLOSSARY.md). As multipart, the
 * intake note's photos travel as files beside it and the device ids as
 * `deviceIds[]` fields; with no text and no photos, there is no intake note.
 */
export const serviceCreateInputSchema = serviceInputSchema.extend({
  intakeNote: noteTextSchema,
});

export type ServiceCreateInputValues = z.input<typeof serviceCreateInputSchema>;
export type ServiceCreateInput = z.output<typeof serviceCreateInputSchema>;
