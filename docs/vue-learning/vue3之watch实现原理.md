<!--
 * @Author: Charlex
 * @Date: 2022-08-20 12:13:15
 * @LastEditors: charlexchen charlexchen@tencent.com
 * @LastEditTime: 2022-08-24 10:51:48
 * @FilePath: /frontend_study_charles/publish-article/vue3之watch实现原理.md
 * @Description: 描述内容
-->

# [陈同学i前端] 手写Vue3 | 响应式系统-watch

## 前言

大家好，我是陈同学，一枚野生前端开发者，感谢各位的点赞、收藏、评论

上一章节文章中我们学习了Vue3的响应系统，接下来我们将基于Vue3-watch的简单实现进行优化，通过本篇文章你能快速掌握watch通用特性的实现思路与竞态问题的解决方式

> 若尚未阅读第一章节的【响应系统】滴同学，请点击此处传送门

本文阅读成本与收益如下：

阅读耗时：`7mins`
全文字数：`7k+`

## 预期效益
- 学习Vue3响应系统watch实现原理以及优化

## watch基本实现与优化

上一节内容我们已经将watch的基本实现完成，而watch的本质其实就是对effect函数的二次封装，以下为简单的实现代码：

```javascript
function watchVisit(value, seen = new Set()) {
    if (typeof value != 'object' || value === null || seen.has(value)) return ;
    seen.add(value);
    for (const ind in value) {
        watchVisit(value, seen);
    }
    return value;
}
function watch(source, cb) {
    let getter = null;
    if (typeof source == 'function') {
        getter = source;
    } else {
        getter = () => watchVisit(dataProxy);
    }
    let oldValue, newValue;
    const effectFn = effect(
        () => getter(),
        {
            lazy: true,
            scheduler() {
                newValue = effectFn();
                cb(newValue, oldValue);
                oldValue = newValue;
            }
        }
    );
    oldValue = effectFn();
}
```

但很快我们会发现在日常使用watch时会允许传入第三个参数options以便设置自定义效果行为

但就目前实现并不支持，因此我们本节关注并实现watch的两个特性：

- 立即执行回调函数
- 回调函数的执行时机

### 第一个特性-`立即执行函数`

```javascript
watch(() => {
    console.log('>>>changed');
}, {
    immediate: true
});
```

预期效果为，回调函数会在watch创建时立即执行一次

明确目标效果后我们开始对watch实现进行改造

```javascript
function watch(source, cb， options = {}) { // change_1：新增options参数
    let getter = null;
    if (typeof source == 'function') {
        getter = source;
    } else {
        getter = () => watchVisit(dataProxy);
    }
    let oldValue, newValue;
    const schedule = () => { // change_2：提取scheduler逻辑
        newValue = effectFn();
        cb(newValue, oldValue);
        oldValue = newValue;
    }
    const effectFn = effect(
        () => getter(),
        {
            lazy: true,
            scheduler: schedule // change_3：将提取逻辑作为回调设置为scheduler
        }
    );
    if (options.immediate) { // change_4：判断options.immediate为true时立即执行回调函数
        schedule();
    } else {
        oldValue = effectFn();
    }
}

```

### 第二个特性-`回调函数的执行时机`

```javascript
watch(() => {
    console.log('>>>changed');
}, {
    flush: 'post' // 'pre' | 'post' | 'sync'
});
```

`flush参数`本质上时指定调度函数的执行先机

- pre：回调函数会在watch注册时调用一次
- post：调度函数需要将副作用函数放入微任务队列当中（等待DOM更新结束再执行）

```javascript
function watch(source, cb， options = {}) {
    let getter = null;
    if (typeof source == 'function') {
        getter = source;
    } else {
        getter = () => watchVisit(dataProxy);
    }
    let oldValue, newValue;
    const schedule = () => {
        newValue = effectFn();
        cb(newValue, oldValue);
        oldValue = newValue;
    }
    const effectFn = effect(
        () => getter(),
        {
            lazy: true,
            scheduler: () => { //change_1：根据flush属性决定schedule函数执行时机
                if (options.flush === 'post') {
                    const p = Promise.resolve();
                    p.then(schedule);
                } else {
                    schedule();
                }
            }
        }
    );
    if (options.immediate) {
        schedule();
    } else {
        oldValue = effectFn();
    }
}
```

以上模拟实现了flush：post的逻辑，pre与sync的模拟实现，大家可以自行思考应该如何设计（其实是小编lazy为true了hhh）

## 过期的副作用

作为一名技术研发者，在多进程或多线程编程当中，我们偶尔会碰到`竞态问题`

> **竞态问题**：指的是一个系统或者进程（线程）的输出依赖于不受控制的事件出现顺序或时机（又称竞态条件）

例子如下：

```javascript
let resp = null;
watch(dataProxy, async () => {
    const res = await axios.get('/path/to/request');
    resp = res;
});
```

监听`dataProxy`代理对象，若其中有属性发生改变，则发送一个请求并将请求结果赋值给`resp`变量

代码实现逻辑上表面看确实没有什么问题，但在实际业务当中存在连续多次改变`dataProxy`代理对象的可能

假设现在有两次变动，引起了两次请求A、B（A先于B发出），因为网络传输、服务分发等各种原因，我们无法保证请求A最快收到响应

若请求B响应快于请求A的响应，则会造成resp变量在两次请求结束后所保存的数据内容并非最新版本

![image-20220821173731163](https://cr-pic-1257999694.cos.ap-guangzhou.myqcloud.com/markdown/image-20220821173731163.png)

用更加专业性的角度来看，请求A是副作用函数第一次执行所产生的副作用，请求B是第二次执行所产生的副作用

请求B后发生，所以它对应的副作用是**最新**的，而请求A的副作用是**过期**的

所以我们需要一个使得副作用"过期"的方式，而在Vue3中，这个方法就是<u>通过onInvalidate函数注册回调，当副作用函数的执行过期时进行标记</u>

接下来我们需要完成两件事情：

- 学习如何注册过期回调钩子函数
- watch机制中如何实现注册钩子函数的功能

首先是注册过期钩子函数，这个步骤比较简单，只需要简单修改一下上面的代码逻辑即可实现

```javascript
let resp = null;
watch(dataProxy, async (newValue, oldValue, onInvalidate) => {
    let isExpired = false;
    onInvalidate(() => { // change_1：注册副作用函数过期时的钩子函数
        isExpired = true;
    })
    const res = await axios.get('/path/to/request');
    if (!isExpired) { // change_2：副作用函数尚未过期，执行结果保存覆盖
        resp = res;
    }
});
```

以上在原本的回调函数当中新增了第三个入参onInvalidate函数，在回调内直接调用onInvalidate注册一个钩子函数，这个钩子函数能够在下次回调函数执行前被watch的逻辑调用标志上一次运行回调所造成的副作用已经过期

对于onInvalidate的实现需要再次对watch函数进行改造，新增的内容有：

- cleanupFn：用于保存注册的过期回调钩子函数
- onInvalidate：定义注册函数内部的逻辑
- 在schedule内判断cleanupFn存在并调用钩子函数以标识上次执行结果已失效

```javascript
function watch(source, cb， options = {}) {
    let getter = null;
    if (typeof source == 'function') {
        getter = source;
    } else {
        getter = () => watchVisit(dataProxy);
    }
    let oldValue, newValue;
    let cleanupFn; // change_1：保存watch使用者注册的过期回调钩子函数
    function onInvalidate(fn) { // change_2：定义用于注册过期钩子函数的注册函数
        cleanupFn = fn;
    }
    const schedule = () => {
        newValue = effectFn();
        if(cleanupFn) { // change_3：执行首次执行的副作用函数所注册的过期钩子函数
            cleanupFn();
        }
        cb(newValue, oldValue, onInvalidate); // change_4：将注册函数传递给开发者定义的cb回调函数
        oldValue = newValue;
    }
    const effectFn = effect(
        () => getter(),
        {
            lazy: true,
            scheduler: () => {
                if (options.flush === 'post') {
                    const p = Promise.resolve();
                    p.then(schedule);
                } else {
                    schedule();
                }
            }
        }
    );
    if (options.immediate) {
        schedule();
    } else {
        oldValue = effectFn();
    }
}
```



![摘自：Vue.js设计与实现](https://cr-pic-1257999694.cos.ap-guangzhou.myqcloud.com/markdown/image-20220821183747785.png)



## 小结

本节文章我们进一步学习了Vue3响应系统当中watch实现的优化思路

基于watch的简单实现，我们讨论继续依照Vue3中watch的能力特性进行完善

关于立即执行函数，我们将函数是否立即执行的控制权交回给开发者，只需要传递`options.immediate`为true即可使得注册的回调函数立刻执行；当然在前端开发当中我们时常会遇到函数执行时机控制的场景（如：DOM渲染后再执行相应的函数以操作新的DOM元素），此时我们提供一个额外的选项`options.flush`用于控制回调函数应当执行的时机

而关于过期副作用函数，我们提供一个注册函数，允许开发者传递取消过期副作用影响的钩子函数

可以发现，本节内容都是通过将原本watch内部的逻辑进行扩展并暴露函数或选项参数的形式将执行逻辑的控制权交给开发者进行业务定制，有过设计模式学习工作经验的同学应该会有更加深刻的体会

## 讲到最后

本节文章是Vue3响应系统最后一篇！

[Vue3响应系统-基础](https://juejin.cn/post/7133079431454654494)
[Vue3响应系统-进阶](https://juejin.cn/post/7133508821250473998)

后续关于【响应系统】若还有内容补充会在评论区会以原文更新的方式通知，敬请各位留意～

谢谢大家，我们下节再见！！！

> 感谢各位看到这里，如果你觉得本节内容还不错的话，欢迎各位的**点赞、收藏、评论**，大家的支持是我做内容的最大动力

> 本文为作者原创，欢迎转载，但未经作者同意必须保留此段声明，且在文章页面明显位置给出原文链接，否则保留追究法律责任的权利

## 补充-Vue3传送门链接

[Vue3文档](https://cn.vuejs.org/)

[Vue3仓库](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fvuejs%2Fcore)

















