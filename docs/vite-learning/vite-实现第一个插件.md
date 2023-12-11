# [陈同学i前端] 一起学Vite｜实现第一个插件

## 前言

大家好，我是陈同学，一枚野生前端开发者，感谢各位的**点赞、收藏、评论**

近年来，前端领域技术更新迭代节奏较快，前端工程师们为了更好的进行项目开发、测试、构建、部署，开发出了各种各样的构建工具

像常见的Webpack、Rollup、Esbuild、Vite，每一类工具都有它的特点，均致力于提高前端领域的工程化水平

而工具出现的目标是**解决前端工程当中的一些影响通性问题**

常见的痛点（需求点）有：模块化需求（ESM）、兼容高级语法、代码质量测试、静态资源处理、代码压缩、开发效率等

本节我们继续进行`Vite`知识的学习，具体安排如下：

- 一起学Vite｜初识下一代的前端工具链
- 一起学Vite｜原来这玩意叫依赖预构建
- 一起学Vite｜实现第一个Vite插件（本节）
- 一起学Vite｜插件流水线
- 一起学Vite｜HMR，你好👋
- 一起学Vite｜模块联邦——代码共享的终极解决方案
- 一起学Vite｜简单手写开发服务器
- 一起学Vite｜简单手写打包器

本文阅读成本与收益如下：

阅读耗时：`5mins`

全文字数：`6k+`

## 预期效益

- `Vite`插件开发环境准备
- `Vite`插件提供形式
- 实现`Vite`插件并发布到NPM仓库

## 插件开发环境准备

- 本地开发机`node`、`npm`环境

- 一个`Vite`驱动的项目

若没有`Vite`驱动的项目，则使用命令`npm create vite@latest`初始化一个项目

## `Vite`插件提供形式

首先要说明的是我们开发的插件，最终是以一个对象的方式传入到`Vite`配置的`plugin`数组当中

![20221212210634](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20221212210634.png)

故无论我们是通过暴露一个函数(函数内部执行后返回一个对象)还是说直接提供一个对象字面量到`Vite`配置中都是可行的

### 简单的插件对象

如现在我们需要在构建应用后的`HTML`中的`body`标签里增加一个`script`标签，标签内部有一条`console.log`语句打印`HelloWorld`字符串到控制台当中，我们便可简单定义一个对象用于实现该功能

```typescript
type IndexHtmlTransformResult =
  | string
  | HtmlTagDescriptor[] // 注入到现有 HTML 中的标签描述符对象数组
  | {
      html: string
      tags: HtmlTagDescriptor[]
    }
const printPlugin = {
    name: 'vite-plugin-simple-print',
    transformIndexHtml(html): IndexHtmlTransformResult {
        const htmlStr = `console.log('HelloWorld')`
        return [
            {
                tag: 'script',
                children: htmlStr,
                injectTo: 'body'
            },
        ]
    }
}
// vite.config.ts
export default defineConfig({
  plugins: [vue(), printPlugin],
})
```

这样我们就开发好了一个简单的插件并将其提供给了`Vite`，`Vite`在构建阶段便会在特定的时机执行我们提供好的钩子方法（`transformIndexHtml`）

说明：
- [name]插件名称（Vite插件要以`vite-plugin-`开头）：vite-plugin-simple-print
- [transformIndexHtml(html)]钩子函数：转换 `index.html` 的专用钩子，钩子接收当前的 `HTML` 字符串和`转换上下文`

该钩子函数支持不同的返回类型：
1. 返回 `HTML字符串`：即使用经过转换的 `HTML` 字符串作为最终产物的`HTML`结果
2. 返回元素（标签元素）为`HtmlTagDescriptor`类型的数组：即遍历数组每一个标签元素，通过元素里的属性描述对产物`HTML`作修改，每个标签元素可以指定标签应该被注入到哪里
3. 返回以上两种类型组成的对象：能够同时实现`HTML自定义`以及`标签元素的构建时动态变更`

![20221213110701](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20221213110701.png)

最终呈现给用户的HTML中便会包含一个用于打印字符串的`script标签`

![20221213111900](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20221213111900.png)

![20221213111926](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20221213111926.png)

## 实现`Vite`插件并发布到NPM仓库

以上我们已经实现了一个以对象字面量形式提供的`Vite`插件

但若我们希望所开发的插件能够支持接收`插件使用者`提供的配置属性参数以实现按需启用构建行为的能力

我们便不能直接提供`插件对象`，而是提供一个函数，由函数接收用户提供的入参经过处理并形成闭包作用域后返回一个`插件对象`

### 插件对象生成函数

```javascript
const printPlugin = function (printTxt = '') {
  const txt = 'Welcome ' + printTxt
  return {
    name: 'vite-plugin-simple-print',
    transformIndexHtml(html): IndexHtmlTransformResult {
        const htmlStr = `console.log('${txt}')`
        return [
            {
                tag: 'script',
                children: htmlStr,
                injectTo: 'body'
            },
        ]
    }
  }
}

// vite.config.ts
export default defineConfig({
  plugins: [vue(), printPlugin('charlex')], // 函数执行后返回一个插件对象
})
```

将`printPlugin`改造成一个函数后，它便可以接收入参，并根据入参影响插件钩子函数内的行为

![20221213113606](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20221213113606.png)

这样一来将使得我们所开发的插件变得更加的灵活、可扩展

接下来我们为插件新增一个能力，支持通过入参选项的属性来控制是否去读取`package.json`中的`name`、`version`、`author`信息并打印到控制台中

```typescript
// change_1: 读取package.json文件并拼接成js逻辑字符串
const handlePkgInfo = function () {
    // 读取项目目录下的package.json
    const pkg: any = readFileSync(process.cwd() + '/package.json', 'utf-8')
    const { name, version, author } = JSON.parse(pkg)
    // 组装即将插入到HTML的字符串
    const htmlStr = `
        const styles = [
            'padding: 5px',
            'font-size: 15px',
            'background: #bfbfbf',
            'color: white',
        ].join(';');
        console.log('Hello, ${inputName}')
        console.log('%cPackageInfo:${name}-${version}-${author}', styles)
    `
    return htmlStr
}
// change_2: 新增函数入参options用于控制部分插件能力
const printPlugin = function (printTxt = '', options = {
    printPkgInfo: false,
}) {
  const txt = 'Welcome ' + printTxt
  return {
    name: 'vite-plugin-simple-print',
    transformIndexHtml(html): IndexHtmlTransformResult {
        let htmlStr = `console.log('${txt}')`
        // change_3: 条件判断-由入参控制的能力
        if (options.printPkgInfo) {
            htmlStr += handlePkgInfo()
        }
        return [
            {
                tag: 'script',
                children: htmlStr,
                injectTo: 'body'
            },
        ]
    }
  }
}
```

变更后的插件支持在调用函数生成插件对象时，由开发者自行决定是否开启`package.json`信息的读取并打印到控制台的能力（默认关闭）

![20221213142207](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20221213142207.png)

在函数入参将`options.printPkgInfo`设置为`true`后，插件便启用额外能力

![20221213142642](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20221213142642.png)

![20221213142659](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20221213142659.png)

### 打包插件并发布到NPM仓库

现在我们已经开发好了一个插件，下一步就需要为该插件初始化一个项目用于将其发布成一个NPM的第三方依赖包

当其它项目需要进行使用时，就可以直接通过依赖安装后将插件对象生成函数导入到`Vite`配置文件中使用

![20221213144917](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20221213144917.png)

- `package.json`内容：

```json
{
  "name": "vite-plugin-simple-print",
  "version": "1.0.0",
  "description": "简单版控制台打印Vite插件",
  "main": "dist/index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "dev": "tsc -w -p .",
    "build": "rimraf dist && tsc -p ."
  },
  "keywords": [
    "print"
  ],
  "author": "charles",
  "license": "ISC",
  "devDependencies": {
    "@types/node": "^18.11.14",
    "rimraf": "^3.0.2",
    "typescript": "^4.9.4",
    "vite": "^4.0.1"
  }
}
```

- `src/index.ts`内容：

```typescript
import { readFileSync } from "fs";
import type { Plugin, IndexHtmlTransformResult } from 'vite';

const handlePkgInfo = function () {
  // 读取项目目录下的package.json
  const pkg: string = readFileSync(process.cwd() + '/package.json', 'utf-8');
  const { name, version, author } = JSON.parse(pkg);
  // 组装即将插入到HTML的字符串
  const htmlStr = `
    const styles = [
        'padding: 5px',
        'font-size: 15px',
        'background: #0cc160',
        'color: white',
    ].join(';');
    console.log('%cPackageInfo:${name}-${version}-${author}', styles)
    `;
  return htmlStr;
};
export const printPlugin = function (
  printTxt = '',
  options = {
    printPkgInfo: false,
  }
): Plugin {
  const txt = 'Welcome ' + printTxt;
  return {
    name: 'vite-plugin-simple-print',
    transformIndexHtml(html: any): IndexHtmlTransformResult {
      let htmlStr = `console.log('${txt}')\n`;
      if (options.printPkgInfo) {
        htmlStr += handlePkgInfo();
      }
      return [
        {
          tag: 'script',
          children: htmlStr,
          injectTo: 'body',
        },
      ];
    },
  };
};
```

- tsconfig.json可以通过`npx tsc --init`自动生成，并将`compilerOptions.outDit`设置为`dist`

完成项目搭建后便可以通过NPM发布命令进行NPM包的发布

```shell

npm login # 登陆

npm publish # 发布NPM包

```

## 其他钩子函数

由于`Vite`插件机制是基于`Rollup`来构建的，故我们可以参考`Rollup`插件官方文档，根据实际需求选用对应的插件钩子进行插件开发

之前写过一篇关于Rollup插件机制的文章，有兴趣的读者可以看看～

[一起学Rollup｜构建工作流与插件机制]https://juejin.cn/post/7155702261724184589

## 讲到最后

本节文章我们学习了如何实现一个简单的`Vite`插件

一开始我们通过简单提供对象字面量的方式将插件提供给`Vite`，之后我们发现这种形式无法将部分插件能力的开关控制权交给业务开发者使用

故我们将原来以对象字面量形式提供`Vite`插件，改成了以`插件对象生成函数`的形式提供插件对象，后者便可以通过函数入参形成的闭包作用域控制插件内钩子的行为

最后，我们将开发好的`Vite`插件发布到NPM仓库，之后其他项目需要使用到插件能力时便可以直接安装依赖并导入到`Vite`配置文件中使用

## 参考补充

[Vite官方文档](https://cn.vitejs.dev/)

[Rollup官方文档](https://rollupjs.org/guide/en/)

[Esbuild官方文档](https://esbuild.github.io/)

[掘金小册](https://juejin.cn/book/7050063811973218341)

[Vue3文档](https://cn.vuejs.org/)








