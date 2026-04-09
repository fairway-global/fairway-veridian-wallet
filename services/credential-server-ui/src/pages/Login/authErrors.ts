const GOOGLE_ACCOUNT_NOT_FOUND_CODE = "GOOGLE_ACCOUNT_NOT_FOUND";
const GOOGLE_ACCOUNT_NOT_FOUND_MESSAGE = "No account found for this Google sign-in";

const getResponsePayload = (error: unknown): Record<string, unknown> | null => {
  if (
    !error ||
    typeof error !== "object" ||
    !("response" in error) ||
    !error.response ||
    typeof error.response !== "object" ||
    !("data" in error.response) ||
    !error.response.data ||
    typeof error.response.data !== "object"
  ) {
    return null;
  }

  return error.response.data as Record<string, unknown>;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  const responsePayload = getResponsePayload(error);
  if (
    responsePayload &&
    "error" in responsePayload &&
    typeof responsePayload.error === "string"
  ) {
    return responsePayload.error;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

const isGoogleAccountNotFoundError = (error: unknown): boolean => {
  const responsePayload = getResponsePayload(error);
  if (
    responsePayload &&
    "data" in responsePayload &&
    responsePayload.data &&
    typeof responsePayload.data === "object" &&
    "code" in responsePayload.data &&
    responsePayload.data.code === GOOGLE_ACCOUNT_NOT_FOUND_CODE
  ) {
    return true;
  }

  return (
    getErrorMessage(error, GOOGLE_ACCOUNT_NOT_FOUND_MESSAGE) ===
    GOOGLE_ACCOUNT_NOT_FOUND_MESSAGE
  );
};

export { getErrorMessage, isGoogleAccountNotFoundError };
