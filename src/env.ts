import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_SITE_URL: z.string().url().default("https://ivasik-k7.github.io"),
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
});
