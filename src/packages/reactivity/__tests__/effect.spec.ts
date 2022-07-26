import { reactive, effect } from '../src'

describe('effect', () => {
  it('happy path', () => {
    const obj = { num: 1 }
    const proxyObj = reactive(obj)
    let newNum = 0
    const fn = jest.fn(() => {
      newNum = proxyObj.num
    })

    // 调用effect时，参数的函数会先被执行一次
    effect(fn)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(newNum).toBe(1)

    // 设置effect中访问的代理对象时，会触发该代理对象的依赖
    proxyObj.num++
    expect(fn).toHaveBeenCalledTimes(2)
    expect(newNum).toBe(2)
  })

  it('分支处理', () => {
    const obj1 = reactive({ num: 1 }),
      obj2 = reactive({ num: 2 })

    const fn = jest.fn(() => {
      obj1.num === 1 ? obj2.num : false
    })
    effect(fn)

    obj1.num++
    expect(fn).toHaveBeenCalledTimes(2)
    // 此时obj1.num!==1
    // 应该走false的分支，所以读取obj2.num理应不触发依赖
    obj2.num++
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('嵌套effect处理', () => {
    const obj1 = reactive({ num: 1 }),
      obj2 = reactive({ num: 2 })

    // 嵌套effect
    const fn2 = jest.fn(() => {
      console.log(obj2.num)
    })
    const fn1 = jest.fn(() => {
      effect(fn2)
      console.log(obj1.num)
    })
    effect(fn1)

    obj2.num++
    // 应该只触发fn2，且只触发一次
    expect(fn2).toHaveBeenCalledTimes(2)
    obj1.num++
    // 应该都触发一次
    expect(fn1).toHaveBeenCalledTimes(3)
    expect(fn2).toHaveBeenCalledTimes(3)
  })

  it('同一effect中set、get的处理', () => {
    const obj = reactive({ num: 1 })
    effect(() => {
      obj.num++
    })

    expect(obj).toBe(2)
    obj.num++
    expect(obj).toBe(4)
  })

  it('实现scheduler', () => {
    const obj = reactive({ num: 1 })

    const scheduler = jest.fn(() => {
      console.log('scheduler')
    })
    const runner = effect(
      () => {
        obj.num++
      },
      {
        scheduler
      }
    )

    expect(obj).toBe(2)
    obj.num++
    expect(scheduler).toHaveBeenCalledTimes(1)
    runner()
    expect(obj).toBe(3)
  })
})
