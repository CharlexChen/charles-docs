# [陈同学i前端] 一起学Vite｜HMR，你好[下]👋

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
- 一起学Vite｜HMR，你好[上]👋
- 一起学Vite｜HMR，你好[下]👋（本节）
- 一起学Vite｜模块联邦——代码共享的终极解决方案
- 一起学Vite｜简单手写开发服务器
- 一起学Vite｜简单手写打包器

本文阅读成本与收益如下：

阅读耗时：`15mins`

全文字数：`10k+`

## 预期效益

- `Vite` 开发服务器HMR实现原理

## 环境

`Vite`版本：v3.2.3

`Node`版本：v16.16.0

`pnpm`版本：v7.9.0


## Vite 开发服务器HMR实现原理

如上节文章所说，`HMR`的出现主要是为了在**开发环境**下更新模块时尽可能地`避免刷新页面`和`保留页面状态数据`以提高开发效率与开发体验

那么接下来我们来学习一下 `Vite` 开发服务器实现 `HMR` 的技术原理

### 模块依赖图

首先，为了方便管理各个模块之间的依赖关系， `Vite` 在`开发服务器`中创建了`模块依赖图`的数据结构

创建依赖图步骤如下：

- 初始化依赖图实例（即由多个map类型属性组成的模块依赖映射关系对象）
- 创建依赖图节点（每个模块的描述对象）
- 绑定各个模块节点的依赖关系

#### 初始化依赖图实例

`Vite`在创建`开发服务器`的逻辑当中会先`初始化依赖图实例`

![20230130151729](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230130151729.png)

对应的`ModuleGraph`类型如下：

```typescript
export class ModuleGraph {
  urlToModuleMap = new Map<string, ModuleNode>() // 由原始请求 url 到模块节点的映射
  idToModuleMap = new Map<string, ModuleNode>() // 由模块 id 到模块节点的映射，其中 id 为原始请求 url 经过 resolveId 钩子解析后的结果
  // a single file may corresponds to multiple modules with different queries
  fileToModulesMap = new Map<string, Set<ModuleNode>>() // 由文件到模块节点的映射，由于单文件可能包含多个模块，如 .vue 文件，因此 Map 的 value 值为一个集合
  safeModulesPath = new Set<string>()
  constructor(
    private resolveId: (
      url: string,
      ssr: boolean,
    ) => Promise<PartialResolvedId | null>,
  ) {}
  // ...
}
// 模块节点对象类型
export class ModuleNode {
  /**
   * Public served url path, starts with /
   */
  url: string // 原始请求 url
  /**
   * Resolved file system path + query
   */
  id: string | null = null // 文件绝对路径 + query
  file: string | null = null // 文件绝对路径
  type: 'js' | 'css' // 模块类型
  info?: ModuleInfo // 模块信息
  meta?: Record<string, any> // resolveId 钩子返回结果中的元数据
  importers = new Set<ModuleNode>() // 该模块的引用方
  importedModules = new Set<ModuleNode>() // 该模块所依赖的模块
  acceptedHmrDeps = new Set<ModuleNode>() // 接受更新的模块
  acceptedHmrExports: Set<string> | null = null // 该模块所接收的HMR导出（新）
  importedBindings: Map<string, Set<string>> | null = null // 该模块所依赖的模块绑定（新）
  isSelfAccepting?: boolean // 是否为`接受自身模块`的更新
  transformResult: TransformResult | null = null // 经过 transform 钩子后的编译结果
  ssrTransformResult: TransformResult | null = null // SSR 过程中经过 transform 钩子后的编译结果
  ssrModule: Record<string, any> | null = null // SSR 过程中的模块信息
  ssrError: Error | null = null // SSR 过程中的error信息
  lastHMRTimestamp = 0 // 上一次热更新的时间戳
  lastInvalidationTimestamp = 0 // 上一次Invalidate的时间戳
  /**
   * @param setIsSelfAccepting - set `false` to set `isSelfAccepting` later. e.g. #7870
   */
  constructor(url: string, setIsSelfAccepting = true) {
    this.url = url
    this.type = isDirectCSSRequest(url) ? 'css' : 'js'
    if (setIsSelfAccepting) {
      this.isSelfAccepting = false
    }
  }
}
```

`ModuleGraph`主要由`urlToModuleMap`、`idToModuleMap`、`fileToModulesMap`、`safeModulesPath`四个映射关系属性以及若干方法组成

方便`开发服务器`根据`请求URL`、`处理后路径`、`文件路径`等字符串换取到对应的`模块节点对象`

了解了依赖图基本结构后我们就需要知道模块节点对象是何时生成的

#### 创建依赖图节点

又因为Vite的开发服务器基于`no-bundle`概念进行开发，故模块节点只会在用到的时候生成

这一点在`Vite`的中间件`transformMiddleware`中可以得到验证

![20230130160800](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230130160800.png)

查看`transformMiddleware`方法会发现其中的逻辑主要是对请求上下文(req)根据不同的`method`、`后缀`等信息进行对应的处理

![20230130160948](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230130160948.png)

接着关注到`transformRequest`方法的调用，进一步查看方法的逻辑代码

![c2544fd5-a45e-482c-a6a7-4fe2887badc8](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/企业微信截图_c2544fd5-a45e-482c-a6a7-4fe2887badc8.png)

![20230130164250](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230130164250.png)

> 补充 `ensureEntryFromUrl` 方法：通过调用此方法便可根据 `url` 实例化 `ModuleNode` 模块节点对象，并将`模块节点对象`存储到`依赖图`当中

```typescript
async function ensureEntryFromUrl(
  rawUrl: string,
  ssr?: boolean,
  setIsSelfAccepting = true
): Promise<ModuleNode> {
  const [url, resolvedId, meta] = await this.resolveUrl(rawUrl, ssr)
  let mod = this.idToModuleMap.get(resolvedId)
  if (!mod) {
    mod = new ModuleNode(url, setIsSelfAccepting) // 实例化 ModuleNode 模块节点对象
    if (meta) mod.meta = meta
    this.urlToModuleMap.set(url, mod)
    mod.id = resolvedId
    this.idToModuleMap.set(resolvedId, mod)
    const file = (mod.file = cleanUrl(resolvedId))
    let fileMappedModules = this.fileToModulesMap.get(file)
    if (!fileMappedModules) {
      fileMappedModules = new Set()
      this.fileToModulesMap.set(file, fileMappedModules)
    }
    fileMappedModules.add(mod)
  }
  // multiple urls can map to the same module and id, make sure we register
  // the url to the existing module in that case
  else if (!this.urlToModuleMap.has(url)) {
    this.urlToModuleMap.set(url, mod)
  }
  return mod
}
```

`Vite`处理请求并拿到最后返回的`模块节点对象`后，`Vite`会调用插件容器中的`transform`方法将模块源码进行转换，以获得最终实际返回的代码(result)，再将`result`更新到对应模块节点对象中的`transformResult`(or`ssrTransformResult`)属性当中

![20230130165107](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230130165107.png)

到这里我们已经了解了核心的`模块依赖图`的`初始化过程`以及`模块节点对象`是何时实例化并加入到`模块依赖图`当中的

但很快我们便会发现，此时的`模块依赖图`只是简单存储了`模块节点`的路径映射关系，尚未形成各个节点的依赖关系信息

#### 绑定各个模块节点的依赖关系

为了形成节点间的依赖关系，我们开始查阅`Vite`的内置插件：`vite:import-analysis`

而在该插件的`transform钩子`中绑定关系的核心逻辑为调用模块依赖图的方法`updateModuleInfo`

![20230130173312](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230130173312.png)

- `importerModule`: 当前模块的`模块节点对象`
- `importedUrls`: 当前模块的依赖模块 `url` 集合
- `importedBindings`: 模块路径`id`-导入`方法`or`属性`名的映射
- `normalizedAcceptedUrls`: 当前模块中通过 `import.meta.hot.accept` 声明的依赖模块 `url` 集合
- `acceptedExports`: HMR partial accept
- `isSelfAccepting`: 分析 `import.meta.hot.accept` 的用法，标记是否为接受自身更新的类型
- `ssr`: 标记是否为SSR

绑定依赖关系的逻辑主要由`ModuleGraph`对象的`updateModuleInfo`方法实现

```typescript
async function updateModuleInfo(
  mod: ModuleNode,
  importedModules: Set<string | ModuleNode>,
  acceptedModules: Set<string | ModuleNode>,
  isSelfAccepting: boolean
) {
  mod.isSelfAccepting = isSelfAccepting
  mod.importedModules = new Set()
  // 绑定节点依赖关系
  for (const imported of importedModules) {
    const dep =
      typeof imported === 'string'
        ? await this.ensureEntryFromUrl(imported)
        : imported
    dep.importers.add(mod)
    mod.importedModules.add(dep)
  }

  // 更新 acceptHmrDeps 信息
  const deps = (mod.acceptedHmrDeps = new Set())
  for (const accepted of acceptedModules) {
    const dep =
      typeof accepted === 'string'
        ? await this.ensureEntryFromUrl(accepted)
        : accepted
    deps.add(dep)
  }
}
```

随着越来越多的模块经过 `vite:import-analysis` 的 `transform` 钩子处理，很多模块之间的依赖关系会被记录下来，补充完整整个依赖图的信息

### 开发服务器收集更新模块

基于模块依赖图的构建成功结果，开发服务器可以很方便地实现对变更模块内容的边界进行精确定位

`Vite` 在开发服务器启动时会通过 `chokidar` 新建文件监听器

![20230131103058](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230131103058.png)

1. `watcher.on('change', fn)`

在监听文件发生变更修改操作事件时便会触发回调函数

回调函数入参为 `文件路径字符串` (file)

- 若为 `package.json` 发生变更，则清除 `packageCache` 对此文件的缓存数据
- 若为非 `package.json` 的文件发生变更，则调用 `moduleGraph.onFileChange` 使得当前文件对应在 `模块依赖图` 当中的 `模块节点对象` 失效(清缓存)，接着若`Vite`开发者用户没有配置`config.hmr = false`则调用 `handleHMRUpdate` 方法更新模块依赖图

> `handleHMRUpdate`方法:

根据传入的文件路径判断以进行不同的处理

- 若为 `Vite`配置文件/配置文件依赖/环境变量声明文件(.env)

重启开发服务器以加载最新的配置数据

- 若为 `dist/client/client.mjs` 客户端文件

通过`websocket`给客户端发送 `full-reload` 信号，使之刷新页面

```typescript
ws.send({
  type: 'full-reload',
  path: '*'
})
```

![20230131105552](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230131105552.png)

- 若非以上两种文件类型，即普通文件改动

调用 `moduleGraph.getModulesByFile` 获取模块依赖图中文件路径对应模块节点对象列表(mods)

> `moduleGraph.getModulesByFile`: 获取需要更新的模块

再结合 `mods` 初始化 `hmrContext` HMR上下文，将上下文传递给当前所有已注册 `handleHotUpdate` 钩子的 `Vite插件` 处理

![20230131143517](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230131143517.png)

接着调用 `updateModules` 更新受修改影响的 `模块节点对象` 属性（设空`transformResult`、更新`lastHMRTimestamp`）并找出`热更新边界模块`，将边界模块信息整理成一个数组(`updates`)

在定位到对应的边界后，开发服务器会通过 `WebSocket` 通知客户端相应的更新信息

```typescript
ws.send({
  type: 'update',
  updates
})
```

> `handleHotUpdate` 钩子常见场景：过滤和缩小受影响的模块列表，使 `HMR` 更准确; 返回一个空数组，并通过向客户端发送自定义事件来执行完整的自定义 `HMR` 处理


2. `watcher.on('add', fn)`、`watcher.on('unlink', fn)`

`add`与`unlink` 相对于 `update` 监听事件较为简单

![20230131113135](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230131113135.png)

主要逻辑为收集边界并更新模块依赖图

![20230131113206](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230131113206.png)


### 客户端感知与更新

> 可能有的同学看到这里会有点懵圈，这里的客户端指的是什么？

`Vite` 在开发阶段会默认在 `HTML` 中注入一段拉取`客户端代码`的脚本

![20230131144211](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230131144211.png)

![20230131144100](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230131144100.png)

对应请求下来的资源其实就是一段JS脚本，我们这里主要关注一个与`WebSocket消息监听处理`有关的方法

```typescript
function setupWebSocket(protocol, hostAndPath, onCloseWithoutOpen) {
    const socket = new WebSocket(`${protocol}://${hostAndPath}`,'vite-hmr');
    let isOpened = false;
    socket.addEventListener('open', ()=>{
        isOpened = true;
    }
    , {
        once: true
    });
    // Listen for messages
    socket.addEventListener('message', async({data})=>{
        handleMessage(JSON.parse(data));
    }
    );
    // ping server
    socket.addEventListener('close', async({wasClean})=>{
        if (wasClean)
            return;
        if (!isOpened && onCloseWithoutOpen) {
            onCloseWithoutOpen();
            return;
        }
        console.log(`[vite] server connection lost. polling for restart...`);
        await waitForSuccessfulPing(protocol, hostAndPath);
        location.reload();
    }
    );
    return socket;
}
async function handleMessage(payload) {
    switch (payload.type) {
        case 'connected':
            // ...
            break;
        case 'update':
            console.debug('vite:beforeUpdate', payload)
            notifyListeners('vite:beforeUpdate', payload);
            // 如果为第一次更新并有了一次错误覆盖，表示使用现有服务器编译错误打开的页面
            // 模块脚本加载失败(因为其中一个嵌套导入是500)，在这种情况下，正常的更新将不起作用，需要完全重新加载。
            if (isFirstUpdate && hasErrorOverlay()) {
                window.location.reload();
                return;
            } else {
                clearErrorOverlay();
                isFirstUpdate = false;
            }
            await Promise.all(payload.updates.map(async (update) => {
                if (update.type === 'js-update') {
                  // js-update逻辑
                  return queueUpdate(fetchUpdate(update)); // 客户端JS模块热更新核心逻辑
                }
                // css-update
                // this is only sent when a css file referenced with <link> is updated
                const { path, timestamp } = update;
                const searchUrl = cleanUrl(path);
                const el = Array.from(document.querySelectorAll('link')).find((e) => !outdatedLinkTags.has(e) && cleanUrl(e.href).includes(searchUrl));
                if (!el) {
                    return;
                }
                const newPath = `${base}${searchUrl.slice(1)}${searchUrl.includes('?') ? '&' : '?'}t=${timestamp}`;
                // 将创建一个新的link标签，而不是交换现有标签上的href。一旦加载了新的样式表，将删除现有的link标记
                return new Promise((resolve) => {
                    const newLinkTag = el.cloneNode();
                    newLinkTag.href = new URL(newPath, el.href).href;
                    const removeOldEl = () => {
                        el.remove();
                        console.debug(`[vite] css hot updated: ${searchUrl}`);
                        resolve();
                    };
                    newLinkTag.addEventListener('load', removeOldEl);
                    newLinkTag.addEventListener('error', removeOldEl);
                    outdatedLinkTags.add(el);
                    el.after(newLinkTag);
                });
            }));
            notifyListeners('vite:afterUpdate', payload);
            break;
        case 'custom': {
            notifyListeners(payload.event, payload.data);
            break;
        }
        case 'full-reload':
            notifyListeners('vite:beforeFullReload', payload);
            if (payload.path && payload.path.endsWith('.html')) {
                // 如果发生变更的html文件正在被浏览器访问则进行页面刷新
                const pagePath = decodeURI(location.pathname);
                const payloadPath = base + payload.path.slice(1);
                if (pagePath === payloadPath ||
                    payload.path === '/index.html' ||
                    (pagePath.endsWith('/') && pagePath + 'index.html' === payloadPath)) {
                    location.reload();
                }
                return;
            }
            else {
                location.reload();
            }
            break;
        case 'prune':
            // ...
            break;
        case 'error': {
            // ...
            break;
        }
        default: {
            const check = payload;
            return check;
        }
    }
}
```

如代码所示，`update.type`为`js-update`时即会根据服务器派发的`update`信息找到对应的边界模块的热更新回调并执行以完成最终的更新

`queueUpdate(fetchUpdate(update))`：

```typescript
/**
 * buffer multiple hot updates triggered by the same src change
 * so that they are invoked in the same order they were sent.
 * (otherwise the order may be inconsistent because of the http request round trip)
 */
async function queueUpdate(p: Promise<(() => void) | undefined>) {
  queued.push(p)
  if (!pending) {
    pending = true
    await Promise.resolve()
    pending = false
    const loading = [...queued]
    queued = []
    ;(await Promise.all(loading)).forEach((fn) => fn && fn())
  }
}
async function fetchUpdate({
  path,
  acceptedPath,
  timestamp,
  explicitImportRequired
}: Update) {
  // HMR 边界模块相关的信息
  const mod = hotModulesMap.get(path)
  if (!mod) {
    // In a code-splitting project,
    // it is common that the hot-updating module is not loaded yet.
    // https://github.com/vitejs/vite/issues/721
    return
  }

  let fetchedModule: ModuleNamespace | undefined
  const isSelfUpdate = path === acceptedPath

  // 整理需要执行的更新回调函数，mod.callbacks 为 import.meta.hot.accept 中绑定的更新回调函数
  const qualifiedCallbacks = mod.callbacks.filter(({ deps }) =>
    deps.includes(acceptedPath)
  )

  if (isSelfUpdate || qualifiedCallbacks.length > 0) {
    // 对将要更新的模块进行失活操作，并通过动态 import 拉取最新的模块信息
    const disposer = disposeMap.get(acceptedPath)
    if (disposer) await disposer(dataMap.get(acceptedPath))
    const [acceptedPathWithoutQuery, query] = acceptedPath.split(`?`)
    try {
      fetchedModule = await import(
        /* @vite-ignore */
        base +
          acceptedPathWithoutQuery.slice(1) +
          `?${explicitImportRequired ? 'import&' : ''}t=${timestamp}${
            query ? `&${query}` : ''
          }`
      )
    } catch (e) {
      warnFailedFetch(e, acceptedPath)
    }
  }
  // 返回一个函数，用来执行所有的更新回调，此函数最终在 queueUpdate 方法中被调度执行
  return () => {
    for (const { deps, fn } of qualifiedCallbacks) {
      fn(deps.map((dep) => (dep === acceptedPath ? fetchedModule : undefined)))
    }
    const loggedPath = isSelfUpdate ? path : `${acceptedPath} via ${path}`
    console.debug(`[vite] hot updated: ${loggedPath}`)
  }
}
```

理解客户端更新`js`的代码逻辑后我们能够发现，我们需要在客户端获取`热更新边界模块`信息，包括：

- 边界模块所接受(accept)的模块

如：`import.meta.hot.accept(['./foo.js', './bar.js'], () => {})` 中的第一个入参`接受模块路径的字符串数组`

- `accept` 模块触发更新后执行的回调

如：`import.meta.hot.accept(['./foo.js', './bar.js'], () => { console.log(123) })` 中的第二个入参`依赖模块更新执行的回调函数`

那么 `Vite` 是如何收集每个热更新边界模块通过`import.meta.hot.accept`注册到回调函数的呢

由于热更新实际影响页面响应的逻辑执行是发生在客户端的，所以我们把目光放到客户端所拉取下来的JS模块代码，查看一下Vite开发服务器实际响应的`边界JS模块`代码：

![20230131152213](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230131152213.png)

```typescript
function createHotContext(ownerPath) {
  if (!dataMap.has(ownerPath)) {
    dataMap.set(ownerPath, {})
  }
  // when a file is hot updated, a new context is created
  // clear its stale callbacks
  const mod = hotModulesMap.get(ownerPath)
  if (mod) {
    mod.callbacks = []
  }
  // clear stale custom event listeners
  const staleListeners = ctxToListenersMap.get(ownerPath)
  if (staleListeners) {
    for (const [event, staleFns] of staleListeners) {
      const listeners = customListenersMap.get(event)
      if (listeners) {
        customListenersMap.set(
          event,
          listeners.filter((l) => !staleFns.includes(l))
        )
      }
    }
  }
  const newListeners: CustomListenersMap = new Map()
  ctxToListenersMap.set(ownerPath, newListeners)
  // 以当前模块文件路径作为key将所有通过accept注册的回调函数收集到map当中
  function acceptDeps(deps: string[], callback: HotCallback['fn'] = () => {}) {
    // ownerPath：调用accept的模块路径
    const mod: HotModule = hotModulesMap.get(ownerPath) || {
      id: ownerPath,
      callbacks: []
    }
    // deps：接收热更新依赖模块路径字符串数组
    // fn：热更新回调方法
    mod.callbacks.push({
      deps,
      fn: callback
    })
    // 设置到 hotModulesMap 中
    hotModulesMap.set(ownerPath, mod)
  }
  const hot = {
      get data() {
          return dataMap.get(ownerPath);
      },
      accept(deps, callback) {
          if (typeof deps === 'function' || !deps) {
              // self-accept: hot.accept(() => {})
              acceptDeps([ownerPath], ([mod])=>deps === null || deps === void 0 ? void 0 : deps(mod));
          } else if (typeof deps === 'string') {
              // explicit deps
              acceptDeps([deps], ([mod])=>callback === null || callback === void 0 ? void 0 : callback(mod));
          } else if (Array.isArray(deps)) {
              acceptDeps(deps, callback);
          } else {
              throw new Error(`invalid hot.accept() usage.`);
          }
      },
      acceptExports(_, callback) {
        // ...
      },
      dispose(cb) {
        // ...
      },
      prune(cb) {
        // ...
      },
      decline() {},
      invalidate(message) {
        // ...
      },
      on(event, cb) {
        // ...
      },
      send(event, data) {
        // ...
      },
  };
  return hot;
}
```

## 小结

要实现`HMR`首先需要建立`模块依赖图`来存储各路径到`模块节点对象`的映射并建立`模块节点`之间的关系(关键：`importers`、`importedModules`属性)

接着在开发服务器侧，需要设置一个文件监听器用于监听项目目录下的文件变更，若发生变更情况则执行对应的回调方法进行`模块节点`与`模块依赖图`的更新，而后若变更文件符合客户端热更新条件，则将信息整理到一个对象当中，序列化后通过`WebSocket`通信传递给客户端的`WebSocket`实例

客户端接收到对应热更新消息后，从`hotModulesMap`中取出热更新模块已注册的回调函数依次执行，最终实现`HMR`的开发体验

## 讲到最后

本节文章我们学习了`Vite-HMR`的实现原理

不得不说，`Vite-HMR`的设计真的非常的巧妙，为了提升开发者的开发体验做了不少的细节设计与优化

通过对`Vite-HMR`的学习，我们能够对 `Vite` 开发服务器有一个更加深刻的认识，其中运用到的设计思想也能够丰富我们的技术认知

作为读者的你能看到这里，说明也是一枚对技术有着极致追求的小伙伴

非常感谢大家耐心阅读完本篇文章，若文章中存在不足或需要改进的地方，欢迎在评论区提出

> 感谢各位看到这里，如果你觉得本节内容还不错的话，欢迎各位的**点赞、收藏、评论**，大家的支持是我做内容的最大动力

> 本文为作者原创，欢迎转载，但未经作者同意必须保留此段声明，且在文章页面明显位置给出原文链接，否则保留追究法律责任的权利

## 参考补充

[Vite官方文档](https://cn.vitejs.dev/)

[Rollup官方文档](https://rollupjs.org/guide/en/)

[Esbuild官方文档](https://esbuild.github.io/)

[掘金小册](https://juejin.cn/book/7050063811973218341)

[Vue3文档](https://cn.vuejs.org/)

