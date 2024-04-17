const fcMetadataKey = Symbol('fc')
function setMeta(target: any, key: string, value: any) {
  let existingMeta = Reflect.getOwnMetadata(fcMetadataKey, target) || {}
  // key is a dot separated path
  const keys = key.split('.')
  let current = existingMeta
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) {
      current[keys[i]] = {}
    }
    current = current[keys[i]] // 更新 current
  }
  current[keys[keys.length - 1]] = value
  Reflect.defineMetadata(fcMetadataKey, existingMeta, target) // 使用 existingMeta
}

function getMeta(target: any, key: string) {
  const existingMeta = Reflect.getOwnMetadata(fcMetadataKey, target) || {}
  const keys = key.split('.')
  let current = existingMeta
  for (let i = 0; i < keys.length; i++) {
    if (!current[keys[i]]) {
      return undefined
    }
    current = current[keys[i]]
  }
  return current
}

function getAllMeta(target: any) {
  return Reflect.getOwnMetadata(fcMetadataKey, target) || {}
}


export { setMeta, getMeta, getAllMeta, fcMetadataKey }
