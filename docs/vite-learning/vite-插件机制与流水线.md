<!--
 * @LastEditTime: 2023-01-03 15:33:18
 * @FilePath: /frontend_study_charles/publish-article/Vite专栏/vite-插件流水线.md
 * @Description: desc
 * 
-->
# [陈同学i前端] 一起学Vite｜插件机制与流水线

## 前言

大家好，我是陈同学，一枚野生前端开发者，感谢各位的**点赞、收藏、评论**

近年来，前端领域技术更新迭代节奏较快，前端工程师们为了更好的进行项目开发、测试、构建、部署，开发出了各种各样的构建工具

像常见的Webpack、Rollup、Esbuild、Vite，每一类工具都有它的特点，均致力于提高前端领域的工程化水平

而工具出现的目标是**解决前端工程当中的一些影响通性问题**

常见的痛点（需求点）有：模块化需求（ESM）、兼容高级语法、代码质量测试、静态资源处理、代码压缩、开发效率等

本节我们继续进行`Vite`知识的学习，具体安排如下：

- 一起学Vite｜初识下一代的前端工具链
- 一起学Vite｜原来这玩意叫依赖预构建
- 一起学Vite｜实现第一个Vite插件
- 一起学Vite｜插件机制与流水线（本节）
- 一起学Vite｜HMR，你好👋
- 一起学Vite｜模块联邦——代码共享的终极解决方案
- 一起学Vite｜简单手写开发服务器
- 一起学Vite｜简单手写打包器

本文阅读成本与收益如下：

阅读耗时：`7mins`

全文字数：`7k+`

## 预期效益

- 了解`Vite`插件机制
- 了解`Vite`插件钩子分类
- `Vite`插件钩子执行顺序
- `Vite`插件流水线顺序

## `Vite`插件机制

`Vite` 的插件机制是与 `Rollup` 兼容的，但它在开发和生产环境下的实现稍有差别

- 生产环境: `Vite` 直接调用 `Rollup` 进行打包
- 开发环境: `Vite` 模拟了 `Rollup` 的插件机制，通过 `PluginContainer` 插件容器对象调度执行各个插件

![20230103104033](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230103104033.png)

如上图所示，`Vite` 插件机制是通过 mock `Rollup`插件机制进行实现，核心实现主要基于两个部分：

- `PluginContainer插件容器`：实现开发环境下`Rollup插件钩子调度`
- `PluginContext上下文对象`：实现插件钩子内部执行时**共享上下文信息**

```typescript
export interface PluginContainer {
  options: InputOptions
  getModuleInfo(id: string): ModuleInfo | null
  buildStart(options: InputOptions): Promise<void>
  resolveId(
    id: string,
    importer?: string,
    options?: {
      assertions?: Record<string, string>
      custom?: CustomPluginOptions
      skip?: Set<Plugin>
      ssr?: boolean
      /**
       * @internal
       */
      scan?: boolean
      isEntry?: boolean
    }
  ): Promise<PartialResolvedId | null>
  transform(
    code: string,
    id: string,
    options?: {
      inMap?: SourceDescription['map']
      ssr?: boolean
    }
  ): Promise<SourceDescription | null>
  load(
    id: string,
    options?: {
      ssr?: boolean
    }
  ): Promise<LoadResult | null>
  close(): Promise<void>
}

type PluginContext = Omit<
  RollupPluginContext,
  // not supported
  | 'load'
  // not documented
  | 'cache'
  // deprecated
  | 'moduleIds'
>
```

### 插件容器

`插件容器`实际上是一个包含多种插件钩子调度执行方法的对象，每种钩子的调度执行方法有着独特的调度特点以及逻辑

```typescript
const plugins = [pluginA, pluginB, pluginC, pluginD, pluginE] // plugins为Vite根据用户配置已经整理好的插件数组，每个元素都为一个插件对象
const container = {
  // 异步串行钩子
  options: await (async () => {
    let options = rollupOptions
    for (const plugin of plugins) {
      if (!plugin.options) continue
      options =
        (await plugin.options.call(minimalContext, options)) || options
    }
    return options;
  })(),
  // 异步并行钩子，此处省略了sequential情况处理
  async buildStart() {
    await Promise.all(
      plugins.map((plugin) => {
        if (plugin.buildStart) {
          return plugin.buildStart.call(
            new Context(plugin) as any,
            container.options as NormalizedInputOptions
          )
        }
      })
    )
  },
  // 异步优先钩子
  async resolveId(rawId, importer, options) {
    // 上下文对象，后文介绍
    const ctx = new Context()
    let id: string | null = null
    const partial: Partial<PartialResolvedId> = {}
    for (const plugin of plugins) {
      const result = await plugin.resolveId.call(
        ctx as any,
        rawId,
        importer,
        {
            // ...
        }
      )
      if (!result) continue;
      return result;
    }
  }
  // 异步优先钩子
  async load(id, options) {
    const ctx = new Context()
    for (const plugin of plugins) {
      const result = await plugin.load.call(ctx as any, id, {
        // ...
      })
      if (result != null) {
        return result
      }
    }
    return null
  },
  // 异步串行钩子
  async transform(code, id, options) {
    const inMap = options?.inMap
    const ssr = options?.ssr
    const ctx = new TransformContext(id, code, inMap as SourceMap)
    ctx.ssr = !!ssr
    for (const plugin of plugins) {
      let result: TransformResult | string | undefined
      try {
        result = await plugin.transform.call(ctx as any, code, id, { ssr })
      } catch (e) {
        ctx.error(e)
      }
      if (!result) continue;
      // 省略 SourceMap 合并的逻辑
      code = result;
    }
    return {
      code,
      map: ctx._getCombinedSourcemap()
    }
  },
  async close() {
    if (closed) return
    const ctx = new Context()
    await hookParallel(
        'buildEnd',
        () => ctx,
        () => []
    )
    await hookParallel(
        'closeBundle',
        () => ctx,
        () => []
    )
    closed = true
  }
}
```

有了插件容器，`Vite`便可以在适当的时候调用对应的插件容器方法进行各个插件钩子逻辑的调度执行

开发者只需要按照约定开发好一个插件，在`Vite`配置的`plugins`属性添加插件对象，后续的此插件内的逻辑执行时机便由`Vite插件容器`进行控制

> 这里为了加深理解，通过`load`钩子进行说明

![20230103145423](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230103145423.png)

`load`属于异步优先钩子函数，在每个`传入模块请求`(import)时被调用

在`Vite`依次调度每个插件的`load`实现逻辑过程中，只要有一个插件的`load`方法实现能够正确处理并返回结果，则忽略后续插件实现的`load`方法逻辑

### 插件上下文

Vite中的`插件上下文`指的是在插件容器的某一钩子（如：load）管道开始执行时，新创建用于记录每一个异步钩子管道当前状态的对象，以便可以并发安全地跟踪该管道中的活动插件，并提供一些工具方法进一步提高插件钩子函数的灵活性

故在各种插件中的钩子被调用的时候，`Vite`插件容器的调度逻辑会强制为钩子函数的 `this` 绑定一个上下文对象

上下文对象类型结构如图所示：

![20230103152218](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230103152218.png)

## `Vite`插件钩子

### 独有钩子与属性

- enforce: `pre` 或 `post` ， `pre` 先执行
- apply: `build` 或 `serve` 或 `函数`，标记当前插件仅在 `build` 或 `serve` 执行环境下使用
- config(config, env): 在 `Vite` 配置被解析之前修改 `Vite` 的相关配置。钩子函数接收 `config`(原始用户配置) 和 `env`(描述配置环境的变量)入参
- configResolved(resolvedConfig): 在解析 `Vite` 配置后调用。使用这个钩子读取和存储`最终解析的配置`
- configureServer(server): 主要用来 `配置开发服务器`
  - 注入前置中间件：钩子函数在内部中间件被安装前调用，可为 `dev-server` 添加自定义的前置中间件
  - 注入后置中间件：钩子函数返回值为一个函数（定义后置中间件）时，可为 `dev-server` 添加自定义的后置中间件
  - 存储服务器访问引用：实现`其他插件钩子`能够访问开发服务器实例
- transformIndexHtml(html): 转换 `index.html` 的专用钩子。钩子接收`当前的 HTML 字符串`和`转换上下文`。上下文在开发期间暴露`ViteDevServer实例`，在构建期间暴露 `Rollup` 输出的包
- handleHotUpdate(ctx): 执行`自定义HMR更新`，可以通过`ws`往客户端发送自定义的事件

### 通用钩子-构建阶段

- options(options): 在服务器启动时被调用-获取、操纵 `Rollup` 选项，（严格意义上来讲，它执行于构建阶段之前）
- buildStart(options): 开始构建流程时调用
- resolveId(source, importer, options): 在每个`传入模块请求`(import)时被调用，用于处理传入模块文件的路径
- load(id): 在每个`传入模块请求`(import)时被调用，通过自定义加载器，可定制返回的自定义格式内容
- transform(code, id): 在每个`传入模块请求`(import)时被调用，用于转换单个模块文件内容
- buildEnd(error?: Error): 在构建阶段结束后被调用

### 通用钩子-输出阶段

- outputOptions(options): 接收输出参数
- renderStart(outputOptions, inputOptions): `bundle.generate` 和 `bundle.write` 调用时都会被触发
- augmentChunkHash(chunkInfo): 为 `chunk` 增加自定义格式的 `hash`
- renderChunk(code, chunk, options): 转译单个的 `chunk` 时触发。`Rollup` 输出每一个 `chunk` 文件的时候都会调用
- generateBundle(options, bundle, isWrite): 在调用 `bundle.write` 之前立即触发这个 `hook`
- writeBundle(options, bundle): 在调用 `bundle.write` 后，所有的 `chunk` 都写入文件后，最后会调用一次 `writeBundle`
- closeBundle(): 服务器关闭时调用

### 插件钩子执行顺序

![20230103213158](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230103213158.png)

## 插件流水线生成顺序

`Vite` 所有的插件都通过`resolvePlugins`被收集起来

```typescript
export async function resolvePlugins(
  config: ResolvedConfig, // 经过处理后的配置
  prePlugins: Plugin[], // 用户插件数组｜enforce: 'pre'
  normalPlugins: Plugin[], // 用户插件数组｜未设置enforce
  postPlugins: Plugin[] // 用户插件数组｜enforce: 'post'
): Promise<Plugin[]> {
  const isBuild = config.command === 'build'
  // 收集生产环境构建的插件
  const buildPlugins = isBuild
    ? (await import('../build')).resolveBuildPlugins(config)
    : { pre: [], post: [] }

  return [
    // 1. 别名插件
    isBuild ? null : preAliasPlugin(),
    aliasPlugin({ entries: config.resolve.alias }),
    // 2. 用户插件(enforce: 'pre')
    ...prePlugins,
    // 3. Vite 核心构建插件
    // ...
    // 4. 用户插件（不带 enforce 属性）
    ...normalPlugins,
    // 5. Vite 生产环境插件
    definePlugin(config),
    cssPostPlugin(config),
    ...buildPlugins.pre,
    // 6. 用户插件(enforce: 'post')
    ...postPlugins,
    ...buildPlugins.post,
    // 7. 一些开发阶段特有的插件
    ...(isBuild
      ? []
      : [clientInjectionsPlugin(config), importAnalysisPlugin(config)])
  ].filter(Boolean) as Plugin[]
}
```

通过`resolvePlugins`处理后，我们能总结出`Vite`的插件执行顺序：

- 别名处理：`Alias`
- 设置`enforce: 'pre'`的用户插件
- `Vite` 核心插件
- 未设置`enforce`的用户插件
- `Vite` 生产环境构建插件
- 设置`enforce: 'post'`的用户插件
- `Vite` 生产环境构建后置插件(`minify`, `manifest`, `reporting`)
- 一些开发阶段特有的插件

即在每一个需要调度插件钩子能力的时机，`Vite`便会按照以上的顺序进行插件钩子函数的调用

## 讲到最后

在上一节文章中我们简单实现了一个`Vite插件`掌握了基本的插件开发技巧

本节我们开始对`Vite`的插件机制进行学习，首先我们明确了`Vite`插件机制是与`Rollup`兼容的，在生产环境下`Vite`直接调用`Rollup`API进行打包，而在开发环境下`Vite`通过`插件容器`以及`插件上下文`模拟 `Rollup` 的插件机制，从而可以实现在开发环境下兼容`Rollup插件机制`的同时扩展`Vite`独有的能力

接着我们尝试理解插件容器内调度钩子函数的行为，发现每一种钩子函数有着对应的调度时机、特点以及逻辑，并且在调用插件容器内`异步钩子管道方法`时会创建一个上下文对象，记录每一个异步钩子管道当前状态的对象

最终我们通过查看`resolvePlugins`方法，了解到插件流水线生成顺序

阅读完本篇文章，希望大家都能够对`Vite插件`有一个更深层次的认知

谢谢大家，我们下节再见！！！

> 感谢各位看到这里，如果你觉得本节内容还不错的话，欢迎各位的**点赞、收藏、评论**，大家的支持是我做内容的最大动力

> 本文为作者原创，欢迎转载，但未经作者同意必须保留此段声明，且在文章页面明显位置给出原文链接，否则保留追究法律责任的权利

## 参考补充

[Vite官方文档](https://cn.vitejs.dev/)

[Rollup官方文档](https://rollupjs.org/guide/en/)

[Esbuild官方文档](https://esbuild.github.io/)

[掘金小册](https://juejin.cn/book/7050063811973218341)

[Vue3文档](https://cn.vuejs.org/)




