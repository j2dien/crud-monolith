import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type {
  ApiErrorResponse,
} from "@crud/contracts/errors";

type ErrorDetails = Omit<
  ApiErrorResponse["error"],
  "requestId"
  >;

export function apiError<
    S extends ContentfulStatusCode,
  >(
    c: Context,
    status: S,
    details: ErrorDetails,
) {
  const requestId: unknown = c.get("requestId");

  const body: ApiErrorResponse = {
    error: {
      ...details,
      ...(typeof requestId === "string"
        ? { requestId }
        : {}),
    },
  };

  return c.json(body, status);
}

type ValidationIssue = {
  path: readonly PropertyKey[];
  message: string;
}

type ValidationResult = {
  success: boolean;
  error?: {
    issues: readonly ValidationIssue[];
  }
}

export function validationHook(
  result: ValidationResult,
  c: Context,
) {
  if (result.success) {
    return;
  }

  const fields: Record<string, string[]> = {};

  for (const issue of result.error?.issues ?? []) {
    const field =
      issue.path.map(String).join(".") || "_form";

    fields[field] ??= [];
    fields[field].push(issue.message);
  }

  return apiError(c, 400, {
    code: "VALIDATION_ERROR",
    message: "Input tidak valid",
    fields,
  });
}
