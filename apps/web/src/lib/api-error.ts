import {
  apiErrorResponseSchema,
  type ApiErrorResponse,
} from "@crud/contracts/errors";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string[]>;
  readonly requestId: string | undefined;

  constructor(
    status: number,
    details: ApiErrorResponse["error"],
  ) {
    super(details.message);

    this.name = "ApiError";
    this.status = status;
    this.code = details.code;
    this.fields = details.fields ?? {};
    this.requestId = details.requestId;
  }
}

type ErrorResponse = {
  status: number;
  headers: Headers;
  json(): Promise<unknown>;
};

export async function throwApiError(
  response: ErrorResponse,
): Promise<never> {
  const body: unknown = await response
    .json()
    .catch(() => null);

  const parsed = apiErrorResponseSchema.safeParse(body);

  if (parsed.success) {
    throw new ApiError(response.status, {
      ...parsed.data.error,

      requestId:
        parsed.data.error.requestId ??
        response.headers.get("x-request-id") ??
        undefined,
    });
  }

  throw new ApiError(response.status, {
    code: "INVALID_ERROR_RESPONSE",
    message: `Request gagal (${response.status})`,

    requestId:
      response.headers.get("x-request-id") ??
      undefined,
  });
}