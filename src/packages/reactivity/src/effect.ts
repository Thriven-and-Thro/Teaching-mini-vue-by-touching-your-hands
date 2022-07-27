export let activeEffect: ReactiveEffect | undefined = undefined
const effectStack: ReactiveEffect[] = []

export class ReactiveEffect<T = any> {
  public deps: Set<ReactiveEffect>[] = []
  public scheduler?: () => any
  constructor(public fn: () => any) {}

  run() {
    activeEffect = this
    effectStack.push(activeEffect)
    const res = this.fn()
    effectStack.pop()
    activeEffect = effectStack[effectStack.length - 1]
    return res
  }
}

export function effect(fn, options?) {
  activeEffect = new ReactiveEffect(fn)
  if (options?.scheduler) {
    activeEffect.scheduler = options.scheduler
  }
  effectStack.push(activeEffect)
  fn()
  effectStack.pop()
  activeEffect = effectStack[effectStack.length - 1]
  return fn
}
