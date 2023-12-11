# [陈同学i前端] 一起学Vite｜HMR，你好[上]👋

## 前言

大家好，我是陈同学，一枚野生前端开发者，感谢各位的**点赞、收藏、评论**

很高兴能和你一同学习～

近年来，前端领域技术更新迭代节奏较快，前端工程师们为了更好的进行项目开发、测试、构建、部署，开发出了各种各样的构建工具

像常见的Webpack、Rollup、Esbuild、Vite，每一类工具都有它的特点，均致力于提高前端领域的工程化水平

而工具出现的目标是**解决前端工程当中的一些影响通性问题**

常见的痛点（需求点）有：模块化需求（ESM）、兼容高级语法、代码质量测试、静态资源处理、代码压缩、开发效率等

本节我们继续进行`Vite`知识的学习，具体安排如下：

- 一起学Vite｜初识下一代的前端工具链
- 一起学Vite｜原来这玩意叫依赖预构建
- 一起学Vite｜实现第一个Vite插件
- 一起学Vite｜插件机制与流水线
- 一起学Vite｜HMR，你好[上]👋（本节）
- 一起学Vite｜HMR，你好[下]👋
- 一起学Vite｜模块联邦——代码共享的终极解决方案
- 一起学Vite｜简单手写开发服务器
- 一起学Vite｜简单手写打包器

本文阅读成本与收益如下：

阅读耗时：`20mins`

全文字数：`10k+`

## 预期效益

- `HMR` 背景
- `Vite`的常用`HMR-API`与简单应用

## 环境

`Vite`版本：v3.2.3

`Node`版本：v16.16.0

`pnpm`版本：v7.9.0

## HMR背景

`代码变更后查看更新后的页面效果`一直以来都是前端工程师的工作流程当中出现频率最高的环节

在前端界还没有大量工具与解决方案的时代，工程师们一度是通过`手动/自动刷新页面`的方式来解决应对这个开发环节

但随着互联网的发展，对前端产品的要求越来越高，一个项目里出现越来越多的模块，前端工程逐渐变得庞大，`手动/自动刷新页面`会很大程度上影响开发体验与效率

那有没有什么方法能够做到将页面实时动态更新成我们修改代码后的效果，而**避免刷新页面和丢失状态数据**呢

那就是我们今天要学习(复习)的`HMR`技术！

`HMR`(Hot Module Replacement)：模块热替换，即自动将页面中发生变化的模块替换为新的模块，并且不影响其它模块的正常工作

其核心实现了两个重要能力：

- 局部刷新（边界模块更新）
- 状态保存（不刷新以维持状态数据）

## Vite 的 HMR API

在`Vite`中的`HMR-API`类型如下：

```typescript
interface ImportMeta {
  url: string
  readonly hot?: ViteHotContext // HMR 依赖 hot 属性
  readonly env: ImportMetaEnv
  glob: import('./importGlob').ImportGlobFunction
  globEager: import('./importGlob').ImportGlobEagerFunction
}

export interface ViteHotContext {
  readonly data: any // 共享数据
  // 模块作为热更新边界，注册模块热更新（监听目标的模块文件更新）时的回调函数
  accept(): void
  accept(cb: (mod: ModuleNamespace | undefined) => void): void
  accept(dep: string, cb: (mod: ModuleNamespace | undefined) => void): void
  accept(
    deps: readonly string[],
    cb: (mods: Array<ModuleNamespace | undefined>) => void
  ): void
  dispose(cb: (data: any) => void): void // 注册模块更新or卸载时需要执行的回调函数
  acceptExports(
    exportNames: string | readonly string[],
    cb?: (mod: ModuleNamespace | undefined) => void
  ): void // HMR partial accept
  prune(cb: (data: any) => void): void // 注册一个回调，当模块在页面上不再被导入时调用
  decline(): void // 方法调用之后，相当于表示此模块不可热更新
  invalidate(message?: string): void // 一个接收自身的模块可以在运行时意识到它不能处理 HMR 更新，因此需要将更新强制传递给导入者
  on<T extends string>(
    event: T,
    cb: (payload: InferCustomEventPayload<T>) => void
  ): void // 监听 HMR 的自定义事件
  send<T extends string>(event: T, data?: InferCustomEventPayload<T>): void // 发送自定义事件到 Vite 开发服务器，如果在连接前调用，数据会先被缓存、等到连接建立好后再发送
}
```

> `import.meta`对象为现代浏览器原生的一个内置对象

通过查看上述的 `import.meta.hot` 类型，我们可以发现有一个属性方法存在有四个重载类型（`accept`）

而 `accept` 属性方法也正是 `Vite` 实现 `HMR` 的关键API

### `import.meta.hot.accept`

`accept`：用于接受模块更新，并调用**更新影响范围对应**的回调函数(通过accept注册的回调函数)

> "接受" 热更新的模块被认为是 `HMR` 边界

根据类型描述我们可以得知 `accept` 有两种使用方法：

- 接收模块自身的热更新信息

```typescript
// render.ts
export const renderPage = () => {
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.innerHTML = `
      <h1>This is a demo for Vite-HMR</h1>
      <p target="_blank">hmr is a excellent tool</p>
    `;
};
if (import.meta.hot) {
  // 通过accept方法注册当前模块(模块自身为HMR边界)热更新时的回调函数，开发者每次保存对该模块文件(render.ts)的修改时，所注册的回调函数自动执行
  import.meta.hot.accept((newModule) => {
    newModule?.renderPage()
  })
}
```

![20230110141148](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230110141148.png)

- 接受直接依赖项的更新

```typescript
import { renderPage } from './render.ts'
import { foo } from './foo.ts'

renderPage()
foo()

if (import.meta.hot) {
  import.meta.hot.accept('./render.ts', (newModule) => {
    // 回调函数接收到更新后的'./render.ts' 模块
    newModule?.renderPage()
  })
}
```

![20230110141207](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230110141207.png)

当然当模块文件作为多个依赖项的HMR边界时，accept方法也支持传入依赖模块的字符串数组

```typescript
import { renderPage } from './render.ts'
import { foo } from './foo.ts'

renderPage()
foo()

if (import.meta.hot) {
  // 可以接受一个依赖模块的数组
  import.meta.hot.accept(
    ['./foo.ts', './render.ts'],
    ([newFooModule, newRenderModule]) => {
      // 只有当所更新的模块非空时，回调函数接收一个数组
      // 如果更新不成功（例如语法错误），则该数组为空
      newFooModule.foo()
      newRenderModule.renderPage()
    }
  )
}
```

![20230110141223](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230110141223.png)

### `import.meta.hot.dispose`

模块销毁时逻辑：用于注册在模块更新、旧模块销毁时的回调处理函数

现在我们通过为`render.ts`模块文件增加定时器的逻辑来感受一下这个API的应用

```typescript
// render.ts
let timer: any;
if (import.meta.hot) {
  import.meta.hot.accept((newMod: any) => {
    newMod.renderPage();
  })
  // >>>change_1: 通过dispose方法注册模块更新or卸载时需要执行的回调函数
  import.meta.hot.dispose(() => {
    console.log('>>>dispose')
    if (timer) {
      clearInterval(timer);
    }
  })
  // >>>change_1
}

export const renderPage = () => {
  // >>>change_2: 设置一个1秒的定时器，每秒钟在控制台打印一下count变量当前的数值
  let count = 0;
  console.log('>>>setInterval-1')
  timer = setInterval(() => {
    console.log(count++)
  }, 1000);
  // >>>change_2
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.innerHTML = `
      <h1>This is a demo for Vite-HMR</h1>
      <p target="_blank">hmr is a excellent tool</p>
    `;
};
```

按照以上逻辑执行`vite`启动开发服务器打开页面控制台

在第三秒时将`console.log('>>>setInterval-1')`修改为`console.log('>>>setInterval-2')`，即会在控制台看到如下的情况

![20230125131602](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230125131602.png)


蓝色框执行于文件修改保存时刻，对应`dispose`注册回调函数的执行时机

可见后续计时器内打印的count变量数值被重置了，那有没有什么办法可以保持count的当前数据呢(保持当前状态数据)，接下来我们学习下一个`HMR-API`

### `import.meta.hot.data`

细心的小伙伴当看到上文中的类型`ViteHotContext`结构时可能会留意到当中有且仅有一个只读属性`data`，它被用于在不同的模块实例间共享存储一些状态数据

> `import.meta.hot.data` 对象在同一个更新模块的不同实例之间持久化。它可以用于将信息从模块的前一个版本传递到下一个版本

我们可以将原来通过普通变量`count`保存的数值放在`import.meta.hot.data.count`上，每次使用变量的时候也从这个只读属性对象里取出来，这样就实现了基本的`保持状态数据能力`

```typescript
// render.ts
let timer: any;
if (import.meta.hot) {
  // >>>change_1: 初始化共享数据属性中的数值
  if (!import.meta.hot.data?.count) {
    import.meta.hot.data.count = 0
  }
  import.meta.hot.accept((newMod: any) => {
    newMod.renderPage();
  })
  import.meta.hot.dispose(() => {
    console.log('>>>dispose')
    if (timer) {
      clearInterval(timer)
    }
  })
}
export const renderPage = () => {
  // >>>change_2: 在HMR更新执行的函数中添加 将共享数据恢复的逻辑
  const getCount = () => {
    const data = import.meta.hot?.data || {
      count: 0
    }
    data.count = data.count + 1
    return data.count
  }
  console.log('>>>setInterval-1')
  timer = setInterval(() => {
    console.log(getCount())
  }, 1000);
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.innerHTML = `
      <h1>This is a demo for Vite-HMR</h1>
      <p target="_blank">hmr is a excellent tool</p>
    `;
};
```

在第三秒时将`console.log('>>>setInterval-1')`修改为`console.log('>>>setInterval-2')`，即会在控制台看到如下的情况

![20230125134408](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230125134408.png)

可见此时的`count`数值并没有被重置，实现了HMR处理下的状态数据保留(实际上是在初始化函数中加入了将共享数据恢复的逻辑)

### `import.meta.hot.on`

监听 `HMR` 的自定义事件，内部事件如下：

`vite:beforeUpdate`:当更新即将被应用时（例如，一个模块将被替换）
`vite:afterUpdate`:当更新已经被应用时（例如，一个模块已被替换）
`vite:beforeFullReload`:当完整的重载即将发生时
`vite:beforePrune`:当不再需要的模块即将被剔除时
`vite:invalidate`:当使用 import.meta.hot.invalidate() 使一个模块失效时
`vite:error`:当发生错误时（例如，语法错误）

自定义事件可以通过Vite插件钩子函数进行发送:

```typescript
// Vite插件Hook
handleHotUpdate({ server }) {
  server.ws.send({
    type: 'custom',
    event: 'custom-eventName',
    data: {}
  })
  return []
}
// 模块监听逻辑
import.meta.hot.on('custom-eventName', (data) => {
  // 自定义更新逻辑
})
```


### `import.meta.hot.invalidate`

一个接收自身的模块可以在运行时意识到它不能处理 `HMR` 更新，因此需要将更新强制传递给导入者。通过调用 `import.meta.hot.invalidate()`，`HMR` 服务将使调用方的导入失效，就像调用方不是接收自身的一样。这会同时在浏览器控制台和命令行中打印出一条信息，你可以传入这条信息，对发生失效的原因给予一些上下文

应该总调用 `import.meta.hot.accept`，即使你打算随后立即调用 `invalidate`，否则 `HMR` 客户端将不会监听未来对接收自身模块的更改。为了清楚地表达你的意图，我们建议在 `accept` 回调中调用 `invalidate`，例如：

```typescript
import.meta.hot.accept((module) => {
  // 你可以使用新的模块实例来决定是否使其失效。
  if (cannotHandleUpdate(module)) {
    import.meta.hot.invalidate()
  }
})
```

### import.meta.hot.prune

注册一个回调，当模块在页面上不再被导入时调用。与 `hot.dispose` 相比，如果源代码更新时自行清理了副作用，你只需要在模块从页面上被删除时，使用此方法进行清理。`Vite` 目前在 `.css` 导入上使用此方法

```typescript
function setupOrReuseSideEffect() {}
setupOrReuseSideEffect()
if (import.meta.hot) {
  import.meta.hot.prune((data) => {
    // 清理副作用
  })
}
```

## 讲到最后

本篇文章简要介绍了`HMR`技术出现的背景以及`Vite-HMR`的简单应用，大致认识了常用的 `HMR-API`

下届文章我们将继续学习`Vite-HMR`的实现原理

非常感谢大家耐心阅读完本篇文章，若文章中存在不足或需要改进的地方，欢迎在评论区提出

> 感谢各位看到这里，如果你觉得本节内容还不错的话，欢迎各位的**点赞、收藏、评论**，大家的支持是我做内容的最大动力

> 本文为作者原创，欢迎转载，但未经作者同意必须保留此段声明，且在文章页面明显位置给出原文链接，否则保留追究法律责任的权利

## 参考补充

[Vite官方文档](https://cn.vitejs.dev/)

[Rollup官方文档](https://rollupjs.org/guide/en/)

[Esbuild官方文档](https://esbuild.github.io/)

[掘金小册](https://juejin.cn/book/7050063811973218341)

[Vue3文档](https://cn.vuejs.org/)

