import { activeEffect, type ReactiveEffect } from './effect'

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
    effectSet = new Set<ReactiveEffect>()
    depMap.set(key, effectSet)
  }

  // 在依赖函数记录一下依赖集合
  if (activeEffect) {
    activeEffect.deps.push(effectSet)
    effectSet.add(activeEffect)
  }
}

function trigger(target, key) {
  const depMap = bucket.get(target)
  const effectSet = depMap.get(key)
  // 在循环中同时给集合增加和删除元素会造成无限循环
  const effectToRun = new Set<ReactiveEffect>()
  effectSet.forEach(effect => {
    if (effect !== activeEffect) {
      effectToRun.add(effect)
    }
  })
  effectToRun.forEach(effect => {
    // 对触发的依赖的依赖集合进行清空
    // 注意要先清空
    cleanup(effect)
    if(effect.scheduler) {
      effect.scheduler()
    }else {
      effect.run()
    }
    
  })
}

function cleanup(effect) {
  const { deps } = effect
  deps.forEach(dep => {
    dep.delete(effect)
  })
  deps.length = 0
}
