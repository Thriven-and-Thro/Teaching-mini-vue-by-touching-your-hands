describe('reactive', () => {
    it('happy path', () => {
        const obj = { num: 1 }
        // 获得代理对象，即reactive响应式对象
        const proxyObj = reactive(obj)
        expect(proxyObj.num).toBe(1)
        expect(proxyObj).not.toBe(obj)
    })
})