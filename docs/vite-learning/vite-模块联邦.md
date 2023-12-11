# [陈同学i前端] 一起学Vite｜模块联邦——代码共享的终极解决方案

## 前言

大家好，我是陈同学，一枚野生前端开发者，感谢各位的**点赞、收藏、评论**

很高兴能和你一同学习～

近年来，前端领域技术更新迭代节奏较快，前端工程师们为了更好的进行项目开发、测试、构建、部署，开发出了各种各样的构建工具

像常见的`Webpack`、`Rollup`、`Esbuild`、`Vite`，每一类工具都有它的特点，均致力于提高前端领域的工程化水平

而工具出现的目标是**解决前端工程当中的一些影响通性问题**

常见的痛点（需求点）有：模块化需求（ESM）、兼容高级语法、代码质量测试、静态资源处理、代码压缩、开发效率等

本节我们继续进行`Vite`知识的学习，具体安排如下：

- 一起学Vite｜初识下一代的前端工具链
- 一起学Vite｜原来这玩意叫依赖预构建
- 一起学Vite｜实现第一个Vite插件
- 一起学Vite｜插件机制与流水线
- 一起学Vite｜HMR，你好[上]👋
- 一起学Vite｜HMR，你好[下]👋
- 一起学Vite｜模块联邦——代码共享的终极解决方案（本节）
- 一起学Vite｜简单手写开发服务器
- 一起学Vite｜简单手写打包器

本文阅读成本与收益如下：

阅读耗时：`10mins`

全文字数：`5k+`

## 预期效益

- `模块联邦`背景
- `模块联邦`应用
- `模块联邦`原理思路

## 背景

对于一个互联网产品来说，一般会有不同的细分应用，每个细分应用可能由不同的开发团队进行单独的开发和维护

所以会经常遇到一些`模块共享`的问题，也就是说不同应用中总会有一些共享的代码，比如`公共组件`、`公共工具函数`、`公共第三方依赖`等等

对于共享代码，我们很容易就能联想到常见的复用方式

- 发布 `NPM` 包
- `CDN引入`
- `Monorepo`

1. `NPM` 包

发布NPM包是一种最为常见的模块复用方式，即使到今天业界仍然以这种方式作为模块复用的基本做法

`更新共享模块`流程如下：

- 更新共享模块代码，发布新版本的包到 `NPM` 仓库
- 依赖共享模块代码的项目开发者安装新版本依赖包进行构建

不足点：

- 项目构建：共享代码需要打包到项目的生产环境产物当中，导致产物体积增大并对构建速度有一定的影响
- 开发效率：每次共享代码发生变更便需要进行新版本的发布，并要求关联当前包的项目安装`新版本依赖`，流程较为复杂

2. `CDN引入`

对于一些第三方依赖我们用了`external`标记不让其参与依赖预构建，而是通过`CDN`引入的方式进行加载

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/src/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite App</title>
  </head>
  <body>
    <div id="root"></div>
    <!-- 从 CDN 上引入第三方依赖的代码 -->
    <script src="https://cdn.jsdelivr.net/npm/react@17.0.2/index.min.js"><script>
    <script src="https://cdn.jsdelivr.net/npm/react-dom@17.0.2/index.min.js"><script>
  </body>
</html>
```

不足点：

- 体积问题：引用CDN地址即全量引用依赖的代码，无法通过`Shaking`掉一些无用代码，依赖体积较大导致性能受到一定程度的影响
- 兼容问题：不能保证所有的第三方依赖都拥有`UMD格式的产物`
- 依赖引入顺序问题：当A包依赖B包，则必须保证B包优先引入加载，否则可能导致A包无法正常初始化

3. `Monorepo`

在 `Monorepo` 架构下，多个项目可以放在同一个 `Git` 仓库中，各个互相依赖的子项目通过 `软链` 的方式进行调试，无需进行额外操作

![20230207172912](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230207172912.png)

不足点：

- 各模块项目必须放在同一个仓库：对老项目迁移有较高的潜在改造成本
- 项目构建问题：由于公共代码也在同一个仓库，统一构建时也需要对公共代码进行构建，构建时间增加，构建产物增大

---

每一种模块复用的方案都有它的优点与缺点，作为开发者需按照实际情况评估投入产出比后再作方案选择

那么接下来我们来看看 `Vite` 生态中的模块复用方案——`模块联邦`

## 模块联邦

模块联邦是一种前端的类微服务架构，它允许多个独立的应用程序之间共享代码和资源。在模块联邦中，每个应用程序被视为一个独立的模块，可以引入其他应用程序的模块并使用它们的功能。这种架构可以帮助开发人员更好地组织和管理复杂的前端应用程序。

模块联邦的原理是将应用程序拆分成多个小模块，每个模块都有自己的独立性和功能。这些模块可以被其他应用程序引用，从而实现代码共享和资源共享。模块联邦的实现需要解决以下问题：

1. 如何定义模块：模块需要有一个唯一的标识符，以便其他应用程序可以引用它。在Vite中，模块标识符由`插件`生成，可以使用插件提供的API来定义模块。

2. 如何共享代码和资源：模块联邦需要一个中心化的服务来管理模块的共享。在Vite中，这个服务由`vite-plugin-federation`插件提供，它可以将模块共享到其他应用程序中。

3. 如何加载共享的模块：当一个应用程序引用另一个应用程序的模块时，它需要加载这些模块。在Vite中，这个过程由`vite-plugin-federation`插件处理，它会根据模块标识符来加载对应的模块。

模块联邦中有两种模块：

- 本地模块：项目中的普通模块（如：JS模块），参与当前项目的构建流程
- 远程模块：远程服务端上的模块，本地模块运行时进行导入使用，不参与当前构建流程

> 每个模块既可以是`本地模块`，导入其它的`远程模块`，又可以作为`远程模块`，被其他的模块导入

![20230215112235](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230215112235.png)

在实践应用前，我们先来看看选择通过 `模块联邦` 实现模块共享能力能够带给我们的应用什么

- 模块能力按需加载（运行时）：当本地模块在运行时只需要使用到远程模块中的一个函数（如：testFn），只需在远程模块导出一个函数，然后在本地模块中`import`即可
- 构建产物体积：本地模块构建过程不涉及远程模块，能够减小产物体积
- 自控模块粒度：模块的粒度由开发者自行控制，可以为一个应用、一个组件、一个函数、一个NPM依赖
- 模块单独维护：远程模块拥有独立的项目仓库，本地模块的开发无需依赖远程模块的开发而要求开发者进行依赖更新，较为灵活方便

### 快速上手

- 快速使用`Vite`脚手架工具初始化两个项目(远程模块、本地模块)

```shell
npm create vite@latest remote_app
npm create vite@latest local_app
```

- 在两个项目中分别安装`@originjs/vite-plugin-federation`

```shell
npm install @originjs/vite-plugin-federation -D
```

- `Vite`配置

![20230216113450](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230216113450.png)

远程模块项目的src目录下新增一个`utils.ts`文件，内容：

```typescript
export const handleFilter = function (num: number) {
    if (num / 2 == 0) {
        return 200;
    }
    return 100;
}
```

在本地模块中`import`使用该方法

![20230216114426](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230216114426.png)

效果：

![20230216114510](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230216114510.png)

验证成功，本地模块成功调用远程模块中的方法

整体流程：

1. `远程模块`通过 `exposes` 注册导出的模块，`本地模块`通过 `remotes` 注册远程模块地址
2. 远程模块进行构建，并部署到云端
3. 本地通过 `import {} from '远程模块名称/xxx'` 的方式来引入远程模块，实现运行时加载

> `exposes` 和 `remotes` 参数其实并不冲突，一个模块既可以作为本地模块，又可以作为远程模块
> 由于 `Vite` 的插件机制与 `Rollup` 兼容，`vite-plugin-federation`方案在 `Rollup` 中也是完全可以使用

### 基本原理思路

接下来我们基于上述的例子，探索模块联邦实现的原理

现在我们把`远程模块`的`vite.config.ts`内容作出修改

```typescript
// 远程模块 vite.config.ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import federation from "@originjs/vite-plugin-federation";
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    federation({
      name: "remote_app",
      filename: "remoteEntry.js",
      exposes: {
        "./Button": "./src/components/Button.js",
        "./utils": "./src/utils.ts",
        "./HelloWorld": "./src/components/HelloWorld.vue",
      },
      shared: ["vue"],
    }),
  ],
  build: {
    target: "esnext",
    minify: false,
  },
});
```

并在远程模块保持有三个子模块`HelloWorld.vue`、`Button.js`、`utils.ts`

![20230506174436](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230506174436.png)

`本地模块`保持不变

```typescript
// 本地模块 vite.config.ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import federation from "@originjs/vite-plugin-federation";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    federation({
      remotes: {
        remote_app: "http://localhost:3001/assets/remoteEntry.js",
      },
      shared: ["vue"],
    }),
  ],
  build: {
    target: "esnext",
    minify: false,
  },
});
```

![20230506200548](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230506200548.png)

> 远程模块编译后的产物

![20230506201132](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230506201132.png)

根据产物目录可见，`exposes`对象属性中每一项都会对应生成一个JS模块bundle，用于给`本地模块`在运行时进行模块加载

另外`远程模块产物`这里还需要关注`remoteEntry.js`，本地模块加载远程模块前会先请求该JS资源，再通过`remoteEntry.js`提供的`get方法`来调用远程模块导出的模块，如图：

![20230508103227](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230508103227.png)

> 本地模块编译后的产物

单看JS类型的产物比较简单，就两个模块（主bundle和共享模块vue）

![20230508104905](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230508104905.png)

直接查看主bundle中查看会发现，我们在本地模块源代码中编写的形如`import { add } from "remote_app/utils";`的代码片段被编译为了`const __federation_var_remote_app${modName} = await __federation_method_getRemote("remote_app" , "./${modName}");`的形式，如图：

![20230508104802](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230508104802.png)

那么接下来就是一步一步的查看`__federation_method_getRemote`方法的调用链路，看看本地模块是如何最终调用到`远程模块`

> `__federation_method_getRemote`的第一个入参是远程模块的`name`（`remote_app`）、第二个入参是目标模块位于远程模块产物静态文件目录的相对路径（`./utils`）

![20230508112053](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230508112053.png)

![20230508112649](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230508112649.png)

最终被导入的模块就可以在应用初始化时注入到本地模块`运行时`当中进行使用

![20230508112928](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230508112928.png)

### 小结图示

![20230508114718](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20230508114718.png)

## 讲到最后

本小节我们学习了模块复用的常见解决方案、模块联邦方案以及`vite-plugin-federation`插件的使用及原理思路。

首先，我们对比了几种解决方案，包括`npm包`、`CDN引入`和`Monorepo`，分析了各自的优缺点。接着，我们引出了`Module Federation`的概念，并分析了它的基本特点：模块能力按需加载、减小构建产物体积、自控模块粒度、模块单独维护。然后，我们使用一个示例演示了如何在Vite中使用`vite-plugin-federation`插件来实现MF的模块引用。最后，我们从**本地模块和远程模块产物**的角度，详细讲解了MF的实现思路和逻辑。

需要注意的是，`模块联邦`虽然解决了模块复用的问题，但也存在一些**局限性和风险**，比如需要考虑`模块版本的兼容性`、`安全性问题`、`性能问题`等。因此，在实际使用模块联邦时，需要<u>仔细评估其适用性和风险</u>，并采取相应的措施来控制/降低风险。

希望本小节的内容能够帮助你进一步了解到`模块联邦`的概念和实现方式。

> 感谢各位看到这里，如果你觉得本节内容还不错的话，欢迎各位的**点赞、收藏、评论**，大家的支持是我做内容的最大动力

> 本文为作者原创，欢迎转载，但未经作者同意必须保留此段声明，且在文章页面明显位置给出原文链接，否则保留追究法律责任的权利

## 参考补充

[Vite官方文档](https://cn.vitejs.dev/)

[Rollup官方文档](https://rollupjs.org/guide/en/)

[Esbuild官方文档](https://esbuild.github.io/)

[掘金小册](https://juejin.cn/book/7050063811973218341)

[Vue3文档](https://cn.vuejs.org/)
