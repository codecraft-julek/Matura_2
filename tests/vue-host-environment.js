import { builtinEnvironments } from 'vitest/runtime'

// Compile client render functions for Vue's in-memory host renderer, without adding a DOM emulator.
export default { ...builtinEnvironments.node, name: 'vue-host', viteEnvironment: 'client' }
