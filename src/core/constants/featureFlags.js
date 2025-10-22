const processEnv = typeof process !== 'undefined' ? process?.env ?? {} : {}
const globalEnv = typeof globalThis !== 'undefined' ? globalThis?.env ?? {} : {}
const globalFeatures = typeof globalThis !== 'undefined' ? globalThis?.HYPERFY_FEATURES ?? {} : {}

const rawEnableInstancedSkinning =
  processEnv.ENABLE_INSTANCED_SKINNING ??
  processEnv.PUBLIC_ENABLE_INSTANCED_SKINNING ??
  globalEnv.ENABLE_INSTANCED_SKINNING ??
  globalEnv.PUBLIC_ENABLE_INSTANCED_SKINNING ??
  globalFeatures.ENABLE_INSTANCED_SKINNING

export const ENABLE_INSTANCED_SKINNING = parseFlag(rawEnableInstancedSkinning)

function parseFlag(value) {
  if (value === undefined || value === null) return false
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true
    if (normalized === 'false' || normalized === '0' || normalized === 'no') return false
  }
  return Boolean(value)
}
