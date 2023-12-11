# [陈同学i前端] 一起学Vite｜原来这玩意叫依赖预构建

## 前言

大家好，我是陈同学，一枚野生前端开发者，感谢各位的**点赞、收藏、评论**

近年来，前端领域技术更新迭代节奏较快，前端工程师们为了更好的进行项目开发、测试、构建、部署，开发出了各种各样的构建工具

像常见的Webpack、Rollup、Esbuild、Vite，每一类工具都有它的特点，均致力于提高前端领域的工程化水平

而工具出现的目标是**解决前端工程当中的一些影响通性问题**

常见的痛点（需求点）有：模块化需求（ESM）、兼容高级语法、代码质量测试、静态资源处理、代码压缩、开发效率等

本节我们继续进行`Vite`知识的学习，具体安排如下：

- 一起学Vite｜初识下一代的前端工具链
- 一起学Vite｜原来这玩意叫依赖预构建（本节）
- 一起学Vite｜实现第一个Vite插件
- 一起学Vite｜插件流水线
- 一起学Vite｜HMR，你好👋
- 一起学Vite｜模块联邦——代码共享的终极解决方案
- 一起学Vite｜简单手写开发服务器
- 一起学Vite｜简单手写打包器

本文阅读成本与收益如下：

阅读耗时：`7mins`

全文字数：`5k+`

## 预期效益

- `Vite`为什么需要预构建
- 如何使用`Vite`预构建功能
- `Vite`预构建功能相关的配置
- `Vite`预构建流程

## 环境

`Vite`版本：v3.2.3

`Node`版本：v16.16.0

`pnpm`版本：v7.9.0

## 为什么要进行依赖预构建

由于Vite的开发服务是基于浏览器原生`ES`模块处理能力来实现的，故在使用开发服务器加载的模块资源理应全都为ESM格式的模块

![20221126101942](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20221126101942.png)

### 问题

1. 第三方依赖（node_modules）可能存在无ES格式产物的情况

这种情况下在使用开发服务器时这类型的第三方依赖（无ES格式产物）便无法被解析执行

2. 请求瀑布流问题

当第三方依赖的运行需要了很多其它依赖，所涉及`import`模块的数量较多时会触发大量的请求

而像Chrome限制了同一域名下最多只能并发6个HTTP请求，最终导致性能下降

### 解决

为了解决以上两个问题，依赖预构建做了两件事情：

- 将非 `ESM` 格式(如CommonJS)的产物转换为 `ESM` 格式，使其能被浏览器通过`<script type="module"><script>`的方式加载

- 把第三方库打包成一个模块文件（多个JS文件—>单个JS文件），项目源码中每`import`一个第三方库仅会发起一个请求，从而优化了 `HTTP` 请求数量

> 依赖预构建仅会在开发模式下应用，并会使用 Esbuild 将依赖转为 ESM 模块。在生产构建中则会使用 @rollup/plugin-commonjs

## 如何使用`Vite`预构建功能

查看源码`initServer`（初始化开发服务器）可知，当我们在`Vite`配置文件中完全不提供`optimizeDeps`的属性对象时，`isDepsOptimizerEnabled`方法的返回值为true，即会调用`initDepsOptimizer`方法进行依赖预构建流程（scan、pre-bundle）

![20221129084904](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20221129084904.png)

![20221129085126](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20221129085126.png)

![20221129084342](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20221129084342.png)

官方文档当中提示`首次启动 vite 时，你可能会注意到打印出了以下信息`，但查阅源码后发现该段打印信息已经不复存在，执行`vite`命令后并不会打印相关信息

![20221129085916](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20221129085916.png)

若需要获取依赖scan、bundle的日志信息，可以执行

`npx vite --debug --force`

![20221129091243](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20221129091243.png)

预构建完成后可于`node_modules/.vite/deps`目录查看到构建产物

![20221129091432](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20221129091432.png)

第一次启动项目后，后续的开发服务器启动默认会直接使用已有的缓存文件

若需要使缓存文件失效并重新进行预构建，则可以从以下几个方面进行

1. `package.json` 的 `dependencies` 字段（即增删改第三方依赖）并执行`npm install`，从而更新 `lock` 文件内容
2. `optimizeDeps` 、 `mode` 、 `root` 、 `resolve` 、 `buildTarget` 、 `assetsInclude` 、 `plugins` 等配置内容
3. 命令`npx vite --force`或在配置中`optimizeDeps.force = true`（强制清除原缓存预构建产物并重新生成）

## `Vite`预构建功能相关的配置

`Vite`将与预构建相关的配置全都收敛到了`config.optimizeDeps`当中

`optimizeDeps`属性对应的TS类型为`DepOptimizationOptions`，如下：

```typescript
export declare type DepOptimizationOptions = DepOptimizationConfig & {
    /**
     * By default, Vite will crawl your `index.html` to detect dependencies that
     * need to be pre-bundled. If `build.rollupOptions.input` is specified, Vite
     * will crawl those entry points instead.
     *
     * If neither of these fit your needs, you can specify custom entries using
     * this option - the value should be a fast-glob pattern or array of patterns
     * (https://github.com/mrmlnc/fast-glob#basic-syntax) that are relative from
     * vite project root. This will overwrite default entries inference.
     */
    // 当默认扫描 HTML 入口文件的行为无法满足需求，比如项目入口为vue格式文件时，可以配置此项
    entries?: string | string[];
    /**
     * Force dep pre-optimization regardless of whether deps have changed.
     * @experimental
     */
    // 是否开启强制进行依赖预构建行为
    force?: boolean;
};
export declare interface DepOptimizationConfig {
    /**
     * Force optimize listed dependencies (must be resolvable import paths,
     * cannot be globs).
     */
    // 用于提前预构建打包异步import（如：const a = import('xxx')）的第三方依赖
    include?: string[];
    /**
     * Do not optimize these dependencies (must be resolvable import paths,
     * cannot be globs).
     */
    // 将某些依赖从预构建的过程中排除
    exclude?: string[];
    /**
     * Force ESM interop when importing for these dependencies. Some legacy
     * packages advertise themselves as ESM but use `require` internally
     * @experimental
     */
    // 实验功能：应对一些第三方依赖声明了ESM格式但却使用require语法
    needsInterop?: string[];
    /**
     * Options to pass to esbuild during the dep scanning and optimization
     *
     * Certain options are omitted since changing them would not be compatible
     * with Vite's dep optimization.
     *
     * - `external` is also omitted, use Vite's `optimizeDeps.exclude` option
     * - `plugins` are merged with Vite's dep plugin
     *
     * https://esbuild.github.io/api
     */
    // 自定义esbuild相关的配置
    esbuildOptions?: Omit<BuildOptions_2, 'bundle' | 'entryPoints' | 'external' | 'write' | 'watch' | 'outdir' | 'outfile' | 'outbase' | 'outExtension' | 'metafile'>;
    /**
     * List of file extensions that can be optimized. A corresponding esbuild
     * plugin must exist to handle the specific extension.
     *
     * By default, Vite can optimize `.mjs`, `.js`, `.ts`, and `.mts` files. This option
     * allows specifying additional extensions.
     *
     * @experimental
     */
    // 扩展的可处理文件后缀名，但必须提供对应的esbuild插件进行处理
    extensions?: string[];
    /**
     * Disables dependencies optimizations, true disables the optimizer during
     * build and dev. Pass 'build' or 'dev' to only disable the optimizer in
     * one of the modes. Deps optimization is enabled by default in dev only.
     * @default 'build'
     * @experimental
     */
    // 实验功能：在某一模式下禁用依赖预构建，默认值：build
    disabled?: boolean | 'build' | 'dev';
}

```

## `Vite`预构建流程

> 源码参考学习：https://github.com/vitejs/vite/blob/v3.2.3/packages/vite/src/node/optimizer/index.ts

### 缓存判断

由于在`Vite`v2.9版本前，默认的Vite预构建产物缓存目录为`node_modules/.vite`，故在v2.9后的`Vite`版本预构建前置行为中会判断是否存在旧版本缓存目录

具体判断条件：在`node_modules/.vite`目录下是否存在`_metadata.json`文件，若存在则直接清空`node_modules/.vite`目录

![20221203120850](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20221203120850.png)

之后获取新版本下的`缓存目录`路径(node_modules/.vite/deps)，在缓存目录中找到`_metadata.json`并进行解析读取

将<u>`_metadata.json`文件中解析出来的`hash`值</u>与<u>`Vite`根据项目中包含的`lock`文件内容以及相关配置项信息进行hash得到的值</u>进行比较

若相同，则说明上次预构建产物结果无需进行变更，跳过预构建流程

![20221203121617](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20221203121617.png)

若不相同，则表示关联的依赖信息有更新或已过期，需要进行依赖预构建

![20221203230957](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20221203230957.png)

图示黄色区域为最近（2022-11）新增的`Vite`缓存判断的新逻辑，主要是为了支持在判断预构建缓存是否有效时，加入第三方依赖的`patch`代码用于`hash`，这样一来如果开发者修改了`patch`代码，则可使得预构建产物失效，从而重新触发预构建流程（`patch代码`指的是开发者修改第三方依赖所产生的代码）

![20221129093723](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20221129093723.png)

### 依赖扫描

如果没有找到符合的预构建产物缓存，`Vite` 将为预构建行为进行源码扫描

#### 处理配置包含依赖

首先`Vite`先对已经知道需要进行预构建的依赖（`optimizeDeps.include`字符串数组）进行路径`resolve`

![20221204165138](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20221204165138.png)

图示黄框标注逻辑：提取`optimizeDeps.include`数组，遍历每一个元素，将字符串通过`normalizeId`方法进行格式化，然后检查依赖字符串是否已经存在，若不存在则进行`resolve`路径解析，最后将解析出来的模块路径`entry`作为`value`，以经过`normalizeId`方法处理的`id`（字符串）作为`key`存入`deps`对象

![20221204165819](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20221204165819.png)

准备好的`deps`格式如：（此处使用了pnpm，若使用npm路径关系上有区别）

```javascript
{
  pinia: '/Users/xxx/code/nodeProject/node_modules/.pnpm/pinia@2.0.26_mgnvym7yiazkylwwogi5r767ue/node_modules/pinia/dist/pinia.mjs'
}
```

接着我们遍历`deps`对象获取到每一个依赖模块文件，通过`es-module-lexer`解析出每个依赖文件的`imports, exports, facade`信息，将这些信息封装成一个`Promise<ExportsData>`类型对象作为`exportsData`属性并联同`id`、`file`、`src`、`browserHash`属性组成`discovered`对象返回

![20221204171028](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20221204171028.png)

最终将`discovered`存储到元信息对象当中

![20221204202202](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20221204202202.png)

#### 入口文件扫描依赖

默认行为是扫描目录下的所有HTML文件（若提供了入口文件则对入口文件进行扫描），自动寻找关联的依赖项

![20221129100128](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20221129100128.png)

在`scanImports`方法内部主要会使用`Promise.all`并行执行 `build` 方法（Esbuild）处理多个入口文件（若有多个）

![20221129100536](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20221129100536.png)

> 这里的依赖扫描过程主要由`esbuildScanPlugin`插件处理各种case的模块文件，插件对各种模块文件的内容加载时进行的介入处理，比如：对于HTML文件，插件会识别出所有引入的module以及内联脚本代码，并将导入导出语句拼接成`js`字符串变量用于后面的逻辑
> ![20221204203233](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20221204203233.png)
> ![20221204204212](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20221204204212.png)

最后将这些依赖项作为预构建依赖的入口点，而预构建通过 `Esbuild` (Go语言)执行，所以执行耗时短

在服务器已经启动之后，如果遇到一个新的依赖关系导入，而这个依赖关系还没有在缓存中，`Vite` 将重新运行依赖构建进程并重新加载页面

### 依赖打包

根据依赖扫描后得到的信息进行依赖打包

在打包之前`Vite`会先去寻找一个**临时缓存目录**（processingCacheDir），这个目录的作用在于`Vite`在执行Esbuild bundle流程时的输入目录指定为**临时缓存目录**

从而与最终的**缓存目录**相隔离，即使最终bundle过程中出现了问题也不会对开发服务器启动后使用的最终**缓存目录**造成影响

处理逻辑：判断是否已经存在**临时缓存目录**，若已存在则清空目录内容，若不存在则创建**临时缓存目录**

而后还会在**临时缓存目录**写入一个`package.json`文件，让所有存在于缓存目录中的模块文件最终都能够被识别为`ESM`

![20221202174818](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20221202174818.png)

接下来`Vite`为依赖预构建`flatIdDeps`对象，对象的key为需要预构建的模块文件**标识字符串**，value则为在依赖扫描阶段提前处理好的由export、import语句构成的虚拟模块字符串

最终将对象传递给`esbuildDepPlugin`插件，最终插件执行于`Esbuild`中build-API的逻辑当中，进行关联第三方依赖的bundle

![20221202175006](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20221202175006.png)

### 元信息持久化

构建完成`Esbuild`根据`outDir`将产物输出到了前面逻辑所创建的临时缓存目录`processingCacheDir`当中，`Vite`拿到依赖预构建产生的`metadata信息`并将其写入到`node_modules/.vite/deps/_metadata.json`文件

![20221202175935](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20221202175935.png)

### 覆盖缓存目录

最终移除原本的缓存目录（depsCacheDir:`.vite/deps_temp`），并将临时缓存目录重命名为缓存目录`.vite/deps`,

![20221202175909](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20221202175909.png)

致此，**依赖预构建**全流程就结束了

## 讲到最后

本节文章讲述了`Vite`**依赖预构建**相关的知识

一开始我们简单了解了一下为什么会有**依赖预构建**的出现，它的出现解决了什么样的问题，然后我们便可以带着这些问题看看`Vite`是如何解决的

接着在了解预构建实现流程原理之前，我们先学习了如何简单使用依赖预构建使用，另外也对预构建的配置项做了一定的了解

而**依赖预构建**的基本流程：缓存判断、依赖扫描、依赖打包、元信息持久化、覆盖缓存目录

我们逐个流程拆分，分别进行学习，`Vite`进行**依赖预构建**是建立在`Esbuild`构建能力基础上的，而`Vite`框架为了能够通过Esbuild的能力提升构建时性能，故通过编写`Esbuild`的插件用于构建过程，构建完成后需要保存本次预构建的元信息以及更新缓存目录

阅读完本篇文章，希望大家都能够对`依赖预构建`有一个更多深层次的认知

谢谢大家，我们下节再见！！！

> 感谢各位看到这里，如果你觉得本节内容还不错的话，欢迎各位的**点赞、收藏、评论**，大家的支持是我做内容的最大动力

> 本文为作者原创，欢迎转载，但未经作者同意必须保留此段声明，且在文章页面明显位置给出原文链接，否则保留追究法律责任的权利

## 参考补充

[Vite官方文档](https://cn.vitejs.dev/)

[Rollup官方文档](https://rollupjs.org/guide/en/)

[Esbuild官方文档](https://esbuild.github.io/)

[掘金小册](https://juejin.cn/book/7050063811973218341)

[Vue3文档](https://cn.vuejs.org/)





