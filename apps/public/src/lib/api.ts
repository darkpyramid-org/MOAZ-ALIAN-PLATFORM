import { configureApiClient } from "@moaz/api-client";
import { authClient } from "@/lib/auth";

configureApiClient(authClient);

export * from "@moaz/api-client";
export { configureApiClient } from "@moaz/api-client";
