<!--
 * @Author: charlexchen charlexchen@tencent.com
 * @Date: 2022-08-18 11:36:18
 * @LastEditors: Charlex
 * @LastEditTime: 2022-08-20 12:31:26
 * @FilePath: \frontend_study\publish-article\vue3响应式系统-进阶.md
 * @Description: 手写Vue3 | 响应式系统-进阶
 * 
-->
# [陈同学i前端] 手写Vue3 | 响应系统-进阶

## 前言

大家好，我是陈同学，一枚野生前端开发者，感谢各位的点赞、收藏、评论

上一章节文章中我们学习了Vue3的响应系统基础，明白了核心工作原理，接下来在本文章中我们将提出若干问题，并一一解决

> 若尚未阅读第一章节的【响应系统-基础】滴同学，请点击此处传送门

本文阅读成本与收益如下：

阅读耗时：`7mins`
全文字数：`13k+`

## 预期效益
- 学习Vue3响应式系统完善优化方法
- computed、watch基本实现

## 响应系统优化与完善

通过以上内容我们已经可以搭建一个响应系统的基础框架，但这其中尚且存在一些问题需要解决

上一节代码：

```javascript
const data = {
    name: 'CTX',
    identify: 'student',
    age: 18
}
function track(target, key) {
    if (!activeEffect) {
        return ;
    }
    let keyMap = targetWeakMap.get(target);
    if (!keyMap) {
        targetWeakMap.set(target, (keyMap = new Map()));
    }
    let effectSet = keyMap.get(key);
    if (!effectSet) {
        keyMap.set(key, (effectSet = new Set()));
    }
    effectSet.add(activeEffect);
}
function trigger(target, key) {
    const keyMap = targetWeakMap.get(target);
    if (!keyMap) {
        return ;
    }
    let effectSet = keyMap.get(key);
    effectSet && effectSet.forEach(fn => {
        if (fn.options.scheduler) {
            fn.options.scheduler(fn);
        } else {
            fn();
        }
    });
}
const handler = {
    get(target, key, receiver) {
        track(target, key);
        // return target[key];
        return Reflect.get(target, key, receiver)
    },
    set(target, key, value, receiver) {
        // target[key] = value;
        Reflect.set(target, key, value, receiver)
        trigger(target, key);
    }
}
const dataProxy = new Proxy(data, handler);
function effect(fn, options = {
    scheduler: null,
    lazy: false
}) {
    const effectFn = function () { // change_1：这里进行小调整，在真正的副作用函数外面包一层函数，方便后面增添逻辑
        activeEffect = effectFn;
        fn();
    }
    effectFn.options = options;
    if (!options || !options.lazy) {
        effectFn();
    }
    return effectFn;
}

```

### 分支切换与cleanup

倘若代码当中出现了如下所示的三元运算符表达式，读者可以思考一下会有什么影响

```javascript
function mockUpdateView() {
    const ele = document.getElementById('container');
    ele.innerText = dataProxy.age >= 18 ? dataProxy.name : 'anonymous';// age初始值为18
    console.log('print:mockUpdateView');
}
effect(mockUpdateView);
dataProxy.age = 15;
dataProxy.name = 'CTX1'; // print:mockUpdateView
dataProxy.name = 'CTX2'; // print:mockUpdateView
dataProxy.name = 'CTX3'; // print:mockUpdateView
```

可见在包含三元运算符或条件语句的副作用函数内存在一种情况，当初始状态下程序执行满足条件A（age >= 18），getter逻辑将副作用函数（mockUpdateView）收集到了`dataProxy.name`对应的Set集合当中，但在将age设置为15后，副作用函数的调用逻辑中赋值给`ele.innerText`的便是`'anonymous'`，也就是说`dataProxy.name`没有被用到，但是此时继续改变`dataProxy.name`仍然会造成副作用函数的执行（函数中都没有用到，执行了也不会产生任何效果，但是会导致程序产生额外的开销），这肯定是我们优秀的程序员们所不允许的！

要解决这个问题其实并不难，<u>只要在trigger阶段真正副作用函数执行之前，将当前副作用函数从所有对应关联的Set集合当中进行移除</u>，待**真正副作用函数**执行时再**重新收集依赖**

要实现这个操作，我们需要在修改effect函数以及新增cleanup函数（用于将当前副作用函数从所有对应关联的Set集合当中进行移除）

```javascript

function effect(fn, options = {
    scheduler: null,
    lazy: false
}) {
    const effectFn = function () { // change_1：这里进行小调整，在真正的副作用函数外面包一层函数，方便后面增添逻辑
        cleanup(effectFn); // change_2：调用cleanup
        activeEffect = effectFn;
        fn();
    }
    effectFn.options = options;
    effectFn.deps = []; // change_1：用于保存包含当前副作用函数的Set集合引用
    if (!options || !options.lazy) {
        effectFn();
    }
    return effectFn;
}
function cleanup(effectFn) { // change_3：从所有Set集合中清理当前副作用函数的引用
    if (!effectFn.deps.length) {
        return false;
    }
    const deps = effectFn.deps;
    for (let ind in deps) {
        // deps[ind]:Set集合
        deps[ind].delete(effectFn);
    }
    effectFn.deps.length = 0;
}

```

经过改造后，当前响应系统就可以避免副作用函数产生遗留的问题，但此时会引发另外一个问题：`无限循环`

### 无限循环问题

在trigger函数当中有这样一段逻辑

```javascript

function trigger(target, key) {
    const keyMap = targetWeakMap.get(target);
    if (!keyMap) {
        return ;
    }
    let effectSet = keyMap.get(key);
    effectSet && effectSet.forEach(fn => {
        if (fn.options.scheduler) {
            fn.options.scheduler(fn);
        } else {
            fn();
        }
    });
}

```

遍历`effectSet集合`，每一次执行副作用函数调用时，都会触发我们上面改造新增的cleanup函数，但是在副作用函数执行完后又会因为getter中的track逻辑将副作用函数重新收集回到`effectSet集合`当中

由于不断有新的元素被添加到`effectSet`当中，形成了一个无限循环的程序

> forEach遍历时，如果有一个值已经被访问过，但该值被删除并重新添加到集合，forEach尚未结束的话，该值会重新被访问

解决方法：

```javascript

function trigger(target, key) {
    const keyMap = targetWeakMap.get(target);
    if (!keyMap) {
        return ;
    }
    let effectSet = keyMap.get(key);
    const effectRun = new Set(effectSet); // change_1：构造另一个Set集合，遍历的目标集合与原集合分离
    effectRun.forEach(fn => { // change_2：对新Set的遍历
        if (fn.options.scheduler) {
            fn.options.scheduler(fn);
        } else {
            fn();
        }
    });
}


```

### 嵌套effect

在我们的日常开发中不乏有以下的一种情况出现

```javascript
// 组件A
const ComponentA = {
    render(){
        // sth
    }
}
// 组件B
const ComponentB = {
    render(){
        return <A/>
    }
}
```

结合effect函数的注册

```javascript
effect(() => {
    // 注册B组件逻辑
    effect(() => {
        // 注册A组件逻辑
        console.log('>>inner');
        console.log(dataProxy.identify);
    });
    console.log('>>outer');
    console.log(dataProxy.age);
});
dataProxy.age++;
```
而对于以上代码在运行过程中我们会发现，`dataProxy.age++`语句执行后，控制台中只打印出了`inner`（外层副作用函数没被收集为依赖）

![20220819152557](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20220819152557.png)

这里的问题其实出在了`effect`函数具体实现上

```javascript
function effect(fn, options = {
    scheduler: null,
    lazy: false
}) {
    const effectFn = function () {
        cleanup(effectFn);
        activeEffect = effectFn;
        fn();
    }
    effectFn.options = options;
    effectFn.deps = [];
    if (!options || !options.lazy) {
        effectFn();
    }
    return effectFn;
}
```

我们可以发现在注册含有嵌套行为的副作用函数过程中，外层副作用函数会在`effect逻辑`当中优先被赋值到`activeEffect`当中，此时在还没有触发相应getter逻辑前发生了内部嵌套，导致内层副作用函数注册时覆盖了`activeEffect`原本的值，故而无论在后续的内层副作用函数触发getter进行依赖收集还是外层副作用函数触发getter进行依赖收集，最终只会收集到内层副作用函数（因为`activeEffect`已经指向了内层副作用函数）

作为一名有经验的研发者，我们遇到这类的嵌套问题时通常能关联到<u>递归、栈</u>等知识，而在这里，我们只需要构建一个简单的栈用于储存正在活跃的副作用函数就可以解决问题

```javascript
let activeEffect = null;
let effectStack = [];
function effect(fn, options = {
    scheduler: null,
    lazy: false
}) {
    const effectFn = function () {
        cleanup(effectFn)
        activeEffect = effectFn;
        effectStack.push(effectFn); // change_1：将当前副作用函数推入栈
        fn();
        effectStack.pop(); // change_2：将已运行完成的副作用函数pop出
        activeEffect = effectStack.length ? effectStack[effectStack.length-1] : null; // change_3：将栈顶副作用函数赋值给activeEffect
    }
    effectFn.options = options;
    effectFn.deps = [];
    if (!options || !options.lazy) {
        effectFn();
    }
    return effectFn;
}
```

最终得以解决问题，收获预期结果：

![20220819152725](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20220819152725.png)



## computed与watch

以上内容我们学习了Vue3响应系统在设计过程当中可能会遇到的问题以及相应的解决方案，目前经过优化后的响应系统代码变得更加可靠，接下来我们将继续学习`computed`以及`watch`的实现

### computed基本实现

这是一个日常开发学习工作生活当中使用频率较高功能

一般我们遇到需要对几个动态数据进行简单运算的结果展示的功能，就会想到computed计算属性

无论是Vue2当中的Options.computed还是Vue3的computed API

```javascript
// Vue2
export default {
    data() {
        return {
            num1: 1,
            num2: 2
        }
    },
    computed: {
        sum() {
            return this.num1 + this.num2;
        }
    }
}

// Vue3
const num1 = ref(1);
const num2 = ref(2);

const sum = computed(() => {
    return num1.value + num2.value;
});

```

都能够实现当函数内读取的代理对象属性值发生改变时，函数重新执行得到最新的结果

具体实现如下：

```javascript

function computed(getter) {
    let _dirty = true;
    let dep = new Set();
    let _value = null;
    let effectResFn = effect(getter, {
        scheduler: (cb) => {
            if (_dirty) return ;
            _dirty = true;
            // trigger逻辑
            dep.forEach((fn) => {
                if (fn.option.scheduler) {
                    fn.option.scheduler(fn);
                } else {
                    fn();
                }
            })
        }
    });
    return {
        get value() {
            // track逻辑
            if (!dep.has(activeEffect)) {
                dep.add(activeEffect);
            }
            // 只有在关联的属性值发生变动或初始化阶段时才能使_dirty为true
            if (_dirty) {
                _dirty = false;
                _value = effectResFn();
            }
            return _value
        }
    }
}

```

这里的逻辑实现会比较绕，建议读者进行实际操作尝试！（此处应当有一张图，但作者有点懒hhhhh，暂且给个说明）

说明：
- _dirty：标识符变量，用于标识对当前`getter`所依赖的数据是否有更新，若为`_dirty==false`则在读取sum时则直接使用上次计算结果
- _dep：用于收集<u>依赖当前sum结果</u>的**副作用函数**，当`getter`当中关联的对象属性变动时会导致`scheduler`函数的执行，将`_dirty`设置为`true`（以便其他依赖sum的函数可以在get value当中走一次重新计算的逻辑），之后再遍历调用依赖sum的副作用函数（dep中的函数）
- get value()：每次想要获取computed的数据计算结果必须调用的函数，在这里能进行依赖收集以及根据标识符`_dirty`更新当前缓存`_value`数值


### watch基本实现

watch用于监听目标属性值是否发生变动，若有变动则触发预设的回调函数

在实现watch功能之前，让我们来回顾一下`effect函数`的现在已经拥有的基本功能

```javascript
effect(() => {
    console.log(dataProxy.age);
}, {
    scheduler() {
        // dataProxy.age数值变化，执行scheduler调度函数
    }
});
```

相信大家看到这里已经基本上知道watch的代码逻辑的思路

以下为watch最简单的实现：

```javascript
function watch(source, cb) {
    effect(() => dataProxy.age, {
        scheduler() {
            cb();
        }
    })
}
```

在开发当中我们会这样使用

```javascript
const data = {
    name: 'CTX',
    identify: 'student',
    age: 18
}
const dataProxy = new Proxy(data, handler);
watch(dataProxy, () => {
    console.log('>>>data change');
});
dataProxy.age = 20;
```

当然这里的`watch函数`调用effect函数时采用了硬编码的方式进行，目前只能监听`dataProxy.age`的变更

为了提高watch函数的**通用性**，我们可以另外封装一个函数，用于根据传入`source`参数的类型，读取变量当中涉及的对象以及属性，最终触发`getter`以建立副作用函数和目标监听数据的关联

```javascript

function watchVisit(value, seen = new Set()) { // change_1：读取目标数据，以触发getter进行依赖收集
    if (typeof value != 'object' || value === null || seen.has(value)) return ;
    seen.add(value);
    for (const ind in value) {
        watchVisit(value, seen);
    }
    return value;
}
function watch(source, cb) {
    effect(
        () => watchVisit(dataProxy), // change_2：将需要监听的代理对象作为参数传入watchVisit
        {
            scheduler() {
                cb();
            }
        }
    )
}
```

另外考虑到在使用watch时，开发者可能直接将函数作为`source参数`传入到`watch函数`当中，这里我们简单做一下兼容

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
    effect(
        () => getter(),
        {
            scheduler() {
                cb();
            }
        }
    )
}

```

我：啊，终于写完了！（总感觉好像漏了点什么。。。）

有一个朋友：你的watch为什么不支持新值旧值的获取！！！

我：原来如此，那我们继续！

首先我们先理清楚两个问题：
- 获取到的新/旧数值如何交给开发者使用
- 新值旧值需要分别从哪里获取

```javascript
watch(
    () => dataProxy.age,
    (newValue, oldValue) => {
        console.log(newValue, oldValue); // 20, 18
    }
);
dataProxy.age = 20;
```

通过上面这个实例我们能够得到第一个问题的答案：在watch函数内调用第二个参数`cb`的回调时，将新、旧值作为第一第二个入参进行调用即可:

```javascript
function watch(source, cb) {
    let getter = null;
    if (typeof source == 'function') {
        getter = source;
    } else {
        getter = () => watchVisit(dataProxy);
    }
    effect(
        () => getter(),
        {
            scheduler() {
                // newValue, oldValue获取
                cb(newValue, oldValue);
            }
        }
    )
}
```

那么剩下需要拿到旧值与新值，这里就需要用到`effect`的`options.lazy`能力

在执行watch函数过程中通过手动调用副作用函数获得函数返回值作为旧值

```javascript
function watch(source, cb) {
    let getter = null;
    if (typeof source == 'function') {
        getter = source;
    } else {
        getter = () => watchVisit(dataProxy);
    }
    let oldValue, newValue; // change_1：声明两个变量用于存放新/旧值
    const effectFn = effect(
        () => getter(),
        {
            lazy: true,
            scheduler() {
                newValue = effectFn(); // change_2：监听数据发生变更，重新执行副作用函数获取新值
                cb(newValue, oldValue);
                oldValue = newValue; // change_3：将当前执行的新值作为旧值，为下一次数据变更做准备
            }
        }
    );
    oldValue = effectFn(); // change_4：注册副作用函数时首次运行副作用函数得到旧值
}
```

## 完整代码

```javascript
function computed(getter) {
    let _dirty = true;
    let dep = new Set();
    let _value = null;
    let effectResFn = effect(getter, {
        scheduler: (cb) => {
            if (_dirty) return ;
            _dirty = true;
            // trigger逻辑
            dep.forEach((fn) => {
                if (fn.option.scheduler) {
                    fn.option.scheduler(fn);
                } else {
                    fn();
                }
            })
        }
    });
    return {
        get value() {
            // track逻辑
            if (!dep.has(activeEffect)) {
                dep.add(activeEffect);
            }
            // 只有在关联的属性值发生变动或初始化阶段时才能使_dirty为true
            if (_dirty) {
                _dirty = false;
                _value = effectResFn();
            }
            return _value
        }
    }
}
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

const data = {
    name: 'CTX',
    identify: 'student',
    age: 18
}
// 此处还有handler、track、trigger、effect、activeEffect、targetWeakMap、effectStack
const dataProxy = new Proxy(data, handler);
// do like：effect()、computed()、watch()
dataProxy.age = 20;

```

## 小结

本节文章我们进一步学习了Vue3响应系统当中对数据依赖的处理以及常见问题

并且我们能够针对特定的问题加以思考给出解决方法，从一开始的分支切换问题，我们采用了cleanup清理副作用函数关联Set集合的方式解决，但改动代码后引发了无限循环问题，经过排查，我们发现是forEach循环过程中有不断有函数被放到了Set集合当中，导致循环一直执行没有停止，为了解决这个问题我们使用一个新的Set集合来隔离原本的依赖集合

接着在常见组件嵌套场景当中我们遇到副作用函数嵌套执行问题，通过引入了栈的数据结构缓存正在活跃的副作用函数进行避免副作用函数被覆盖的情况

最后我们介绍了`computed`以及`watch`的实现

## 讲到最后

以上我们已经完成了一个完整的响应系统，其中包括`track`、`trigger`、`effect`、`computed`、`watch`的核心函数实现，以及`activeEffect`、`targetWeakMap`、`effectStack`的关键变量设置

大家若能通过这两节文章（基础、进阶）的内容建立起对Vue3响应系统的整体理解，并将其中解决问题的思路进行消化，那将会是一件非常棒的事情！

后续关于【响应系统】还会有一节针对watch的实现补充，尽情各位留意～

谢谢大家，我们下节再见！！！

> 感谢各位看到这里，如果你觉得本节内容还不错的话，欢迎各位的**点赞、收藏、评论**，大家的支持是我做内容的最大动力

> 本文为作者原创，欢迎转载，但未经作者同意必须保留此段声明，且在文章页面明显位置给出原文链接，否则保留追究法律责任的权利

## 补充-Vue3传送门链接

[Vue3文档](https://cn.vuejs.org/)

[Vue3仓库](https://github.com/vuejs/core)



