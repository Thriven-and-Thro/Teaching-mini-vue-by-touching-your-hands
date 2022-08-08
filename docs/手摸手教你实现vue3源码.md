今天先一起来实现响应式功能的基础：effect 和 reactive

首先写一下这部分的单元测试：

（对于大型复杂逻辑的项目，单元测试的存在是必不可少的。使用单元测试可以显而易见的测试出本次的改动是否影响之前的功能。除此之外，通过单元测试来驱动开发也有利于理清开发逻辑）

（当前使用的单元测试框架是jest，关于环境的安装网上教程很多，在此就不再赘述了）

（没接触过单元测试的也不影响阅读哦）


编写单元测试 reactive.spec.ts：

```ts
describe('reactive', () => {
  it('happy path', () => {
    const obj = { num: 1 }
    // 返回代理对象
    const proxyObj = reactive(obj)
    // 读取结果与原始对象一致
    expect(proxyObj.num).toBe(1)
    // 原始对象不等于代理对象
    expect(proxyObj).not.toBe(obj)
  })
})
```

由此单测可以得出 reactive 函数预计实现的功能：

- 参数为对象
- 返回代理对象
- reactive 对象不等于原对象
- 可以与原对象一样正常读取值

编写单元测试 effect.spec.ts：

```ts
describe("effect", () => {
  it('happy path', () => {
    const obj = { num: 1 }
    const proxyObj = reactive(obj)
    let newNum = 0
    const fn = jest.fn(() => {
      // 注意这里不能使用++
      newNum = proxyObj.num
    })

    // 调用effect时
    effect(fn)
    // 参数的函数会先被执行一次
    expect(fn).toHaveBeenCalledTimes(1)
    expect(newNum).toBe(1)

    // 设置effect中访问的代理对象时
    proxyObj.num++
    // 会触发该代理对象的依赖
    expect(fn).toHaveBeenCalledTimes(2)
    expect(newNum).toBe(2)
  })
});
```

effect 函数预计实现的功能：

- 参数为函数，使用该函数后其参数会直接执行一次
- 若其中引用了 reactive 对象属性，当 reactive 对象属性被修改时，会触发 effect 函数内的参数执行


好了，这部分的单元测试编写完成了。这时候你不妨可以先想一想，如果让你实现这部分的功能要怎么实现。



首先，先实现 reactive 函数。

通过上述的功能描述，我们可以简而言之地概括为一句话：**传入一个对象，返回一个和原对象不一样的对象，但拥有和原对象属性一样的读写操作**，并且根据响应式原理，还需**有对对象读写操作进行拦截的能力**。如果对 es6 熟悉的话，现在是不是可以联想到 **Proxy** 了。

而我们接下来 reactive 函数的实现就是要运用 Proxy：该函数接受一个对象作为参数，直接返回该对象的代理对象，在代理对象中使用 get、set 拦截器，并分别通过 Reflect 的 get、set 方法做读写。

在后续的描述中，将 reactive 函数返回的对象称为 reactive 对象。 

具体实现 reactive.js：

```ts
export function reactive<T extends Object>(target: T): T {
  return new Proxy(target, {
    get: (target, key) => {
      const res = Reflect.get(target, key);
      // TODO
      return res;
    },
    set: (target, key, value) => {
      const res = Reflect.set(target, key, value);
      // TODO
      return res;
    },
  });
}
```

编写完这段代码后，记得在  reactive.spec.ts 引入一下，这时候就会发现 reactive.spec.ts 的测试已经通过了。



可能这时候你会兴致勃勃地在 effect.spec.ts 中也引入一下。当然，effect.spec.ts 的测试是没有通过的。



不急，我们先来看一下 effect 函数要实现的功能。先看第二点：`若其中引用了 reactive 对象属性，当 reactive 对象属性被修改时，会触发 effect 函数内的参数执行`。看到这个功能，你会想到怎么实现呢？`当...被修改时，触发...`，这不就可以使用**发布订阅者模式**来实现吗？（关于发布订阅者模式，这里也不再赘述）

根据发布订阅者模式，我们可以设计一个 Set 来存放**依赖函数**（依赖函数即 effect 函数的参数，后文称为 **effectFn**），这个 Set 称为**依赖集合**。当 effectFn 中对对象做读操作时，将该 effectFn 存入依赖集合中（**依赖收集**）；当对象执行写操作时，将依赖集合中的 effectFn 取出执行（**触发依赖**）。这样就能简单地实现一个响应式系统。

所以接下来要考虑的是，在哪里依赖收集，在哪里触发依赖。这时候就要改进之前的 reactive 函数了，而这也是 vue3 使用 Proxy 的关键所在：通过 Proxy 可以在对代理对象属性读写的时候做拦截。

所以我们可以**在 get、set 拦截器中分别进行依赖收集和触发依赖**，并将依赖收集和触发依赖分别封装为 track 函数和 trigger 函数。

将 reactive 函数改进为：（track 和 trigger 函数在后续实现）

```ts
export function reactive<T extends Object>(target: T): T {
  return new Proxy(target, {
    get: (target, key, receiver) => {
      const res = Reflect.get(target, key, receiver);
      // 依赖收集
      track(target, key);
      return res;
    },
    set: (target, key, value, receiver) => {
      const res = Reflect.set(target, key, value, receiver);
      // 触发依赖
      trigger(target, key);
      return res;
    },
  });
}
```



首先实现 track 函数。在这里，只使用 Set 是远远不够的，还需要完善依赖收集的数据结构。

这时候回忆一下 vue3 响应式的功能，是不是修改对象属性，只会触发该对象属性对应的依赖呢？所以这个数据结构要使**对象属性和依赖集合对应起来**。

所以这个数据结构可以这样设计：

- **依赖集合 Set，设为 effectSet**；
- **每个 effectSet 与对应对象属性的映射 Map，设为 depMap**；
- **每个 depMap 与对应对象的映射 WeakMap，设为 targetMap**；

当执行 track 时，会先在 targetMap 中查找该对象的 depMap，不存在 depMap 则创建；然后在 depMap 中查找对象属性对应的 effectSet，不存在则创建。这样就取到了对象属性对应的依赖集合。

根据以上的思路，代码可以组织如下：

```ts
const targetMap = new WeakMap();
export function track(target, key) {
  let depMap = targetMap.get(target);
  if (!depMap) {
    depMap = new Map();
    targetMap.set(target, depMap);
  }
  let effectSet = depMap.get(key);
  if (!effectSet) {
    effectSet = new Set();
    depMap.set(key, effectSet);
  }
  // TODO
}
```

（targetMap 放在全局是因为该数据结构需要保存所有响应式对象及其映射）

现在有数据结构保存依赖了，接下来要考虑如何将依赖添加到 effectSet 里。

根据功能，我们要做的只需**把 effectFn 执行一遍，并将其添加到 effectSet 里**。在不传参的情况下，可以通过设置一个全局变量 activiteEffect 来保存 effectFn，之后在 track 函数中读取 activiteEffect 来获取当前的 effectFn。

effect 函数实现如下：

```ts
let activiteEffect;
export function effect(fn) {
  activiteEffect = fn
  fn();
}
```

改进一下 track 函数：

```ts
export function track(target, key) {
  let depMap = targetMap.get(target);
  if (!depMap) {
    depMap = new Map();
    targetMap.set(target, depMap);
  }
  let effectSet = depMap.get(key);
  if (!effectSet) {
    effectSet = new Set();
    depMap.set(key, effectSet);
  }
  effectSet.add(activiteEffect);
}
```

实现到了这里，单元测试中的这条语句应该已经能通过了：

```ts
    expect(nextAge).toBe(2);
```

最后实现一下 trigger 函数进行依赖触发。

如果上面的流程理解通透后，接下来是很简单的，不过是**找到对应的依赖并执行一下**：

```ts
export function trigger(target, key) {
  let depMap = targetMap.get(target);
  let effectSet = depMap.get(key);

  for (const effect of effectSet) {
    effect();
  }
}
```

好了，现在响应式原理的基本功能已经实现完毕了，单元测试也能全部通过。

但是别急，这里还需稍微改进一下。

首先是依赖需**通过一个类进行封装，并且创建依赖执行方法：run**：

```ts
class ActiviteEffect {
  _fn: any;

  constructor(fn) {
    this._fn = fn;
  }

  run() {
    activiteEffect = this;
    this._fn();
  }
}
```

所以之前的代码要做相应的调整，将所有依赖的执行通过调用 run 方法来实现：

```ts
export function effect(fn) {
  const activiteFn = new ActiviteEffect(fn);
  activiteFn.run();
}
```

```ts
export function trigger(target, key) {
  let depMap = targetMap.get(target);
  let effectSet = depMap.get(key);

  for (const effect of effectSet) {
    effect.run();
  }
}
```

至于为什么这样封装，请听下回分解。

至此，响应式原理的基本功能才算编写完毕。

最后我们来捋一捋单元测试里的执行流程：

1. 执行 reactive 函数，返回 reactive 对象
2. 执行 effect 函数，创建一个 ActiviteEffect 实例 activiteFn，保存参数为 _fn。调用 activiteFn.run 方法
3. 在 run 方法中将该实例 activiteFn 赋值给 activiteEffect，同时执行 _fn，此时 nextAge = 2
4. 其中使用了 user.age，触发 get 操作，进入 track 函数
5. 因为没有对应的数据结构，所以在 track 函数中进行创建，之后将 activiteEffect 的值添加进 effectSet
6. 执行 user.age++，触发 get、set 操作
7. 对于 get 操作，因为该语句不在 effect 函数中执行，故 activiteEffect 没有被赋值，无法添加进 effectSet
8. 对于 set 操作，会调用 trigger 函数，从 effectSet 中取出依赖执行，此时 nextAge = 3

 