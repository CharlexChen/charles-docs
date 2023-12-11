<!--
 * @Author: Charlex
 * @Date: 2022-07-20 21:58:24
 * @LastEditors: charlexchen charlexchen@tencent.com
 * @LastEditTime: 2022-08-19 16:46:29
 * @FilePath: /frontend_study_charles/publish-article/vue3响应式系统.md
 * @Description: Vue3 | 响应系统-基础
-->
# [陈同学i前端] 手写Vue3 | 响应式系统-基础

## 前言

大家好，我是陈同学，一枚野生前端开发者，感谢各位的**点赞、收藏、评论**

Vue3的正式发布已经有将近两年的时间，许多开源项目以及企业实际生产项目陆续采用Vue3作为渐进性开发框架，诚然它的架构设计值得我们每一位前端研发者学习，今天就来细聊一下`Vue3响应系统`的整体实现思路

本文阅读成本与收益如下：

阅读耗时：`10mins`

全文字数：`14k`

## 预期效益
- 掌握Vue3响应式系统实现核心原理思路
- lazy、scheduler基本实现

## 响应系统原理基础

### 视图-数据关联

先从一段例子开始

```html
<!-- index.html -->
<body>
    <div id="container"></div>
</body>
```

```javascript
// main.js
const data = {
    name: 'CTX',
    identify: 'student',
    age: 18
}

function updateView() {
    const ele = document.getElementById('container');
    ele.innerText = `${data.name}-${data.identify}-${data.age}` ;
}
updateView();
```
例子中涉及一个`index.html`文件（视图）以及一个`main.js`文件（逻辑）

updateView函数可以将data对象中的三个属性进行拼接并更新到视图当中

运行以上代码后页面中呈现效果如图

![image-20220815003738312](https://cr-pic-1257999694.cos.ap-guangzhou.myqcloud.com/markdown/image-20220815003738312.png)

现在这段代码只能实现初始化数据并渲染，若对data对象进行属性值修改，视图并不会发现变化

若我们想对data对象的属性值进行修改，并让修改效果最终能够在页面视图当中呈现，最简单的实现方式如下：

```javascript
// main.js
const data = {
    name: 'CTX',
    identify: 'student',
    age: 18
}

function updateView() {
    const ele = document.getElementById('container');
    ele.innerText = `${data.name}-${data.identify}-${data.age}` ;
}
updateView();
data.identify = 'teacher'; // 修改属性值
updateView(); // 手动调用更新函数
```

但很快我们又会发现，假设在项目当中有很多因素导致data对象的改变而并不能保证这些因素作用后都进行updateView的调用，故我们需要找到一个方法能够使得每次data对象发生变化都能执行我们编写的回调函数（调用`updateView`进行视图更新），这个方法就是-`代理`

### Proxy代理

有了解过Vue2、Vue3区别的同学知道，Vue2主要采用`Object.defineProperty`进行数据拦截代理，而Vue3则采用ECMAScript2015后的`Proxy`

对Proxy没有概念滴同学建议参考[MDN：Proxy](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Proxy)

通过使用Proxy对data对象进行的代理，我们便可以自定义访问、变更对象内容时的逻辑

```javascript
// main.js
const data = {
    name: 'CTX',
    identify: 'student',
    age: 18
}
const handler = {
    get(target, key, receiver) {
        return target[key];
        // return Reflect.get(target, key, receiver)
    },
    set(target, key, value, receiver) {
        target[key] = value;
        updateView();
        // Reflect.set(target, key, value, receiver)
    }
}
const dataProxy = new Proxy(data, handler);

function updateView() {
    const ele = document.getElementById('container');
    ele.innerText = `${dataProxy.name}-${dataProxy.identify}-${dataProxy.age}`;
}
updateView();
dataProxy.identify = 'teacher';

```
当将代理对象的`identify`修改为`teacher`，触发Proxy的set钩子，钩子内调用`updateView`方法来拼接数据并渲染到页面

![20220815200822](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20220815200822.png)

现在我们已经可以实现一个最简易的响应式视图，无论data对象当中哪一个属性值改变了，都能够通过`setter`劫持并重新调用updateView（trigger行为）

聪明滴小伙伴很快又会发现这里尚且存在一个痛点，`setter`当中只会调用updateView函数一次，倘若有其他updateView1、updateView2等函数用于更新页面中其它内容，还是要手动一个一个添加到`setter`当中，听起来就非常不友好，那么接下来我们思考如何解决这个问题

### 副作用函数

在解决以上问题之前我们需要补充一个概念：`副作用函数`

副作用: <u>计算结果的过程中，系统状态的一种变化，或者与外部世界进行的可观察的交互</u>

**副作用函数**：会产生一定作用效果(副作用)的函数

PS：即函数的运行，可能会影响到其他函数或变量，那么这种影响就是一种副作用

```javascript
function updateView() {
    const ele = document.getElementById('container');
    ele.innerText = `${dataProxy.name}-${dataProxy.identify}-${dataProxy.age}`;
}
```
此处的`updateView`便是一个典型的`副作用函数`，它的执行会导致视图的更新（副作用）

### effect函数

在了解了`副作用函数`以及`响应式数据视图`后，我们便可以解决上述所遇到的问题

接下来我们定义一个函数，用于记录当前需要执行的副作用函数并手动调用一次

```javascript
let activeEffect = null; // 用于临时保存当前活跃的副作用函数
let effectSet = new Set(); // 读者可以预先思考为什么这里需要有一个Set
function effect(fn) {
    activeEffect = fn;
    fn();
}
```

同时`main.js`当中的代码也需要进行变更

```javascript
// main.js
const data = {
    name: 'CTX',
    identify: 'student',
    age: 18
}
const handler = {
    get(target, key, receiver) {
        activeEffect && effectSet.add(activeEffect); // change_1: 向Set集合中添加当前正在调用的副作用函数
        return target[key];
        // return Reflect.get(target, key, receiver)
    },
    set(target, key, value, receiver) {
        target[key] = value;
        effectSet.forEach(fn => fn()); // change_2: 遍历Set集合，调用每一个副作用函数
        // Reflect.set(target, key, value, receiver)
    }
}
const dataProxy = new Proxy(data, handler);

function updateView() {
    const ele = document.getElementById('container');
    ele.innerText = `${dataProxy.name}-${dataProxy.identify}-${dataProxy.age}`;
}
effect(updateView); // change_3: 注册副作用函数

// 此处可以继续注册其他副作用函数：effect(func);

dataProxy.identify = 'teacher';

```

啊同学你好，如果看到这里感觉有点理解不了，别着急划走呀，待我慢慢解释给你听～

首先可以看到`main.js`变动的地方主要有三个:

- change_1：将当前activeEffect指向的副作用函数添加到Set集合当中，我们称这个操作为`依赖收集`或`依赖追踪`
- change_2：遍历Set集合，调用每一个副作用函数，此操作可以保证所有与**data代理对象**有关的副作用函数都能够在data属性发生变更时重新调用
- change_3：注册新的副作用函数，说白了就是将要调用的函数设置到`activeEffect`变量，方便在函数执行过程中getter逻辑将其添加到Set集合当中（依赖收集）

只要理解了这三个change的逻辑我们便算是学习到了响应系统最重要的工作机制实现思路！

### 使用map-set进行优化

目前的实现在功能上已经成型，但在性能上会有很大的优化空间

试想一下倘若现在有三个副作用函数A、B、C分别包含对data代理对象三个属性的访问读取，那么在将三个副作用函数都收集到Set集合当中

导致后续如果data代理对象其中一个属性（如：A属性）发生变更了，就会有三个副作用函数依次调用执行，即使另外两个属性对应的副作用函数没有必要调用（B属性、C属性没有发生变化，副作用函数调用产生额外开销）

为了避免这额外的函数调用开销，我们需要对收集副作用函数的集合结构进行重新设计

![20220816142702](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20220816142702.png)

采用`map-set`结构进行key与副作用函数集合的关联，每当一个key对应的value发生改变，仅会触发key所关联的所有副作用函数

```javascript
// main.js
let activeEffect = null; // 用于临时保存当前活跃的副作用函数
let keyMap = new Map(); // change_1：通过map建立key与依赖Set集合的联系
function effect(fn) {
    activeEffect = fn;
    fn();
}
const data = {
    name: 'CTX',
    identify: 'student',
    age: 18
}
const handler = {
    get(target, key, receiver) { // change_2：根据key从keyMap中获取Set集合，再将当前激活的副作用函数收集到Set集合
        if (!activeEffect) {
            return ;
        }
        let effectSet = keyMap.get(key);
        if (!effectSet) {
            keyMap.set(key, (effectSet = new Set()));
        }
        effectSet.add(activeEffect);
        // return target[key];
        return Reflect.get(target, key, receiver)
    },
    set(target, key, value, receiver) { // change_3：根据key从keyMap中获取Set集合，再遍历执行当前key关联的副作用函数
        // target[key] = value;
        Reflect.set(target, key, value, receiver)
        let effectSet = keyMap.get(key);
        effectSet && effectSet.forEach(fn => fn());
    }
}
const dataProxy = new Proxy(data, handler);

function updateView() {
    const ele = document.getElementById('container');
    ele.innerText = `${dataProxy.name}-${dataProxy.identify}-${dataProxy.age}`;
}
effect(updateView);

// 此处可以继续注册其他副作用函数：effect(func);

dataProxy.identify = 'teacher';
```

以上代码便可以用作实现`单一对象`的响应式系统

> Weakmap：只接受`对象`作为键名（null除外），不接受其他类型的值作为键名

Vue开发当中我们不可避免的会将业务拆分成多个组件分别进行开发，最后再进行组件的组合使用，以提高代码复用率

而每一个组件当中都会维护单独的一份data代理对象数据，这就出现了**多代理对象的响应式系统**的需要，这时我们只需要对目前收集副作用函数的集合结构进行多一层抽离就可以实现！

![20220816142557](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20220816142557.png)

- WeakMap
    - key：target（data代理对象）
    - value：Map
- Map（建立data代理对象的key和Set依赖集合的关联）
    - key：data代理对象的key
    - value：Set
- Set（副作用函数集合）
    - value：effect（副作用函数）

关于`Map`和`WeakMap`的区别：
- Map的键可以是任意类型，WeakMap只接受对象作为键而不接受其他类型的值
- Map的键实际上是跟内存地址绑定的，只要内存地址不一样，就视为两个键； WeakMap 的键是弱引用，键所指向的对象可以被垃圾回收，此时键是无效的
- Map可以被遍历，WeakMap不能被遍历

加上了WeakMap后我们这套响应式代码便可支持多代理对象的副作用函数依赖收集与触发，完整代码如下


```javascript
// main.js
let activeEffect = null; // 用于临时保存当前活跃的副作用函数
let targetWeakMap = new WeakMap(); // change_1：使用WeakMap以支持多代理对象的依赖收集
function effect(fn) {
    activeEffect = fn;
    fn();
}
const data = {
    name: 'CTX',
    identify: 'student',
    age: 18
}
const handler = {
    get(target, key, receiver) { // change_2
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
        // return target[key];
        return Reflect.get(target, key, receiver)
    },
    set(target, key, value, receiver) { // change_3
        // target[key] = value;
        Reflect.set(target, key, value, receiver)
        const keyMap = targetWeakMap.get(target);
        if (!keyMap) {
            return ;
        }
        let effectSet = keyMap.get(key);
        effectSet && effectSet.forEach(fn => fn());
    }
}
const dataProxy = new Proxy(data, handler);

function updateView() {
    const ele = document.getElementById('container');
    ele.innerText = `${dataProxy.name}-${dataProxy.identify}-${dataProxy.age}`;
}
effect(updateView);

// 此处可以继续注册其他副作用函数：effect(func);

dataProxy.identify = 'teacher';

```

为了方便后期扩展，我们将getter当中的**依赖收集/追踪**以及setter中的**依赖触发**抽离成两个独立的函数`track`、`trigger`

```javascript
// main.js
let activeEffect = null; // 用于临时保存当前活跃的副作用函数
let targetWeakMap = new WeakMap();
function effect(fn) {
    activeEffect = fn;
    fn();
}
// change_1：新增track依赖收集函数
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
// change_2：新增trigger依赖触发函数
function trigger(target, key) {
    const keyMap = targetWeakMap.get(target);
    if (!keyMap) {
        return ;
    }
    let effectSet = keyMap.get(key);
    effectSet && effectSet.forEach(fn => fn());
}
const data = {
    name: 'CTX',
    identify: 'student',
    age: 18
}
const handler = {
    get(target, key, receiver) {
        track(target, key); // change_3
        // return target[key];
        return Reflect.get(target, key, receiver)
    },
    set(target, key, value, receiver) {
        // target[key] = value;
        Reflect.set(target, key, value, receiver)
        trigger(target, key); // change_4
    }
}
const dataProxy = new Proxy(data, handler);

function updateView() {
    const ele = document.getElementById('container');
    ele.innerText = `${dataProxy.name}-${dataProxy.identify}-${dataProxy.age}`;
}
effect(updateView);

// 此处可以继续注册其他副作用函数：effect(func);

dataProxy.identify = 'teacher';

```

看到这里滴同学，恭喜你，已经达成**掌握响应系统基础**的成就

## scheduler与lazy

### Options中的scheduler

首先我们来看一段代码

```javascript
// identify初始值：student
function updateView() {
    // do sth
    let temp = dataProxy.identify;
    console.log(temp);
}
effect(updateView);

dataProxy.identify = 'teacher';

console.log('hello');

```

正常来说这段代码的执行结果应该是：

![20220816212551](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20220816212551.png)

此时假如我们想要实现'hello'输出先于'teacher'，这个时候就需要新增调度器功能（scheduler）

代码中的实现如下：

```javascript
function effect(fn, options = {
    scheduler: null
}) {
    activeEffect = fn;
    fn.options = options;
    fn();
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
// identify初始值：student
function updateView() {
    // do sth
    let temp = dataProxy.identify;
    console.log(temp);
}
effect(updateView, {
    scheduler: function (cb) {
        setTimeout(() => {
            cb();
        }, 1000);
    }
});
dataProxy.identify = 'teacher';
console.log('hello');

```

最终输出结果如下：

![20220816214606](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20220816214606.png)

成功实现了我们所需要的效果！

这里的原理比较容易理解，实际上在注册副作用函数时，在函数上绑定了一个options对象，options中包含一个scheduler的属性，当我们需要控制副作用函数在触发阶段的逻辑时，便可以通过定义一个函数并将其设置为scheduler的属性值

### Options中的lazy

理解了scheduler调度器的实现，lazy的实现便不是难点

直接上代码：

```javascript

function effect(fn, options = {
    lazy: false
}) {
    activeEffect = fn;
    fn.options = options;
    if (!options || !options.lazy) { // change_1: lazy判断逻辑
        fn();
    }
    return fn;
}
// identify初始值：student
function updateView() {
    // do sth
    let temp = dataProxy.identify;
    console.log(temp);
}
const resFn = effect(updateView, {
    lazy: true
});
dataProxy.identify = 'teacher'; // 由于还没有收集到副作用函数，这行不会引起副作用函数执行
resFn(); // 这行执行后才开始收集依赖（副作用函数）

```

通过简单地向options当中添加`lazy`属性以及在effect函数当中加多一个判断逻辑便可以实现`lazy`（延迟/手动收集依赖）的功能

## 本节内容完整代码

```html
<!-- index.html -->
<body>
    <div id="container"></div>
</body>
```

```javascript
const data = {
    name: 'CTX',
    identify: 'student',
    age: 18
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
let activeEffect = null;
let targetWeakMap = new WeakMap();
function effect(fn, options = {
    scheduler: null,
    lazy: false
}) {
    activeEffect = fn;
    fn.options = options;
    if (!options || !options.lazy) {
        fn();
    }
    return fn;
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
function updateView() {
    const ele = document.getElementById('container');
    ele.innerText = `${dataProxy.name}-${dataProxy.identify}-${dataProxy.age}`;
}
effect(updateView);
dataProxy.identify = 'teacher';
console.log('hello');
```

## 总结
本节文章从一个数据视图更新的小例子作为切入点，通过不断提出问题一点一点深入完善响应系统功能

从一开始的原始对象数据变动需要手动调用更新视图的逻辑到用Proxy将`原始对象`包装成`代理对象`并对属性的操作进行劫持，实现数据变更自动视图更新

接着考虑到可能存在一个代理对象关联多个副作用函数的情况，便使用`Set`数据结构用于存储副作用函数并实现了`effect函数`用于动态注册收集副作用函数到`Set集合`当中

后来又遇到单个key关联的副作用函数执行会引起其他key副作用函数的一并重新执行，造成性能损耗，则使用`map-set`结构进行优化；为了兼容多代理对象依赖收集的情景，我们引入`WeakMap`建立`代理对象`与`keyMap`的关联

最后我们还学习了Options当中`scheduler`和`lazy`属性，实现了**简单的调度器**以及**延迟手动加载**的功能

本节内容的学习，能一定程度加深我们对响应系统设计的理解程度，后续还会有进阶实现章节的文章，尽情期待～！

谢谢大家，我们下节再见！！！

> 感谢各位看到这里，如果你觉得本节内容还不错的话，欢迎各位的**点赞、收藏、评论**，大家的支持是我做内容的最大动力

> 本文为作者原创，欢迎转载，但未经作者同意必须保留此段声明，且在文章页面明显位置给出原文链接，否则保留追究法律责任的权利

## 补充-Vue3传送门链接

[Vue3文档](https://cn.vuejs.org/)

[Vue3仓库](https://github.com/vuejs/core)








