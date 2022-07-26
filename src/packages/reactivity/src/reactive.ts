let activeEffect = null

export function reactive(obj) {
  return new Proxy(obj, {
    get(target, key) {
      track(target, key)
      return Reflect.get(target, key)
    },
    set(target, key, value) {
      // 注意要先set，因为顺序应该是：修改值 => 触发依赖
      const res = Reflect.set(target, key, value)
      trigger(target, key)
      return res
    }
  })
}

const bucket = new WeakMap()
function track(target, key) {
  let depMap = bucket.get(target)
  if (!depMap) {
    depMap = new Map()
    bucket.set(target, depMap)
  }
  let effectSet = depMap.get(key)
  if (!effectSet) {
    effectSet = new Set()
    depMap.set(key, effectSet)
  }

  effectSet.add(activeEffect)
}

function trigger(target, key) {
  const depMap = bucket.get(target)
  const effectSet = depMap.get(key)
  effectSet.forEach(effect => {
    effect && effect()
  })
}

export function effect(fn) {
  activeEffect = fn
  fn()
  activeEffect = null
}
