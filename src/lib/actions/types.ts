export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };
export type FormAction = (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;

export const fail = (error: string): ActionResult => ({ ok: false, error });
export const ok = (message?: string): ActionResult => ({ ok: true, message });
