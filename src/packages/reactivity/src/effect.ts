export let activeEffect: ReactiveEffect | undefined = undefined
const effectStack: ReactiveEffect[] = []

export class ReactiveEffect<T = any> {
  public deps: Set<ReactiveEffect>[] = []
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

export function effect(fn) {
  activeEffect = new ReactiveEffect(fn)
  effectStack.push(activeEffect)
  fn()
  effectStack.pop()
  activeEffect = effectStack[effectStack.length - 1]
}