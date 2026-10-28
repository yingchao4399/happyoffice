import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Password protection round-trips use PBKDF2 and can exceed 20s on
    // constrained CI/desktop workers; keep the test meaningful without making
    // a valid implementation fail due to host speed.
    testTimeout: 60000,
  },
})
