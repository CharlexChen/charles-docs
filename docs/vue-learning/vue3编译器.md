<!--
 * @Author: charlexchen charlexchen@tencent.com
 * @Date: 2022-08-25 11:04:18
 * @LastEditors: charlexchen charlexchen@tencent.com
 * @LastEditTime: 2022-09-06 22:07:29
 * @FilePath: /frontend_study_charles/publish-article/vue3编译器.md
 * @Description: 手写Vue3 | 编译器
 * 
-->
# [陈同学i前端] 手写Vue3｜模版编译原理｜编译器实现

## 前言

大家好，我是陈同学，一枚野生前端开发者，感谢各位的**点赞、收藏、评论**

Vue3的正式发布已经有将近两年的时间，许多开源项目以及企业实际生产项目陆续采用Vue3作为渐进性开发框架，诚然它的架构设计值得我们每一位前端研发者学习，今天就来细聊一下`Vue3编译器`的整体实现思路

本文阅读成本与收益如下：

阅读耗时：`20mins`

全文字数：`25k`

## 预期效益
- 掌握Vue3编译器的实现思路

## 编译

1. 利用编译程序从源语言编写的源程序产生目标程序的过程

2. 用编译程序产生目标程序的动作

编译是一名有追求的技术人员永远都绕不开的话题，针对不同的用途场景，编译技术的难度都不一样

通过编译我们能对已经编写好的代码进行检查、注入、转化数据结构等等操作（联想一下babel进行语法降级的过程中也使用了编译器）

若想实现`通用用途语言`的编译（C、JS），需要掌握大量的编译技术，包括但不限于递归下降算法、类型系统

而在前端领域的编译，我们做的更多的是实现一种领域特定语言（DSL）的转化与应用，例如Vue.js的模版编译

## 模版DSL编译器

编译器听起来很高端，归根到底它终究还是一段程序，执行这段程序能够将一种语言（源代码）转化为另一种语言（目标代码）

编译的过程一般分为五个阶段：

- 词法分析
- 语法分析
- 中间代码生成（语义检查）
- 代码优化
- 目标代码生成

而Vue.js的模版作为DSL，编译流程上需要进行针对性的调整

我们编译的目标是为了将<u>源代码</u>（template模版代码）转化为**可运行在浏览器**上的<u>Javascript代码</u>（渲染函数）

![20220901113458](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20220901113458.png)

大致梳理下来Vue3模版编译器处理流程为：

- 对`template模版`进行**词法分析**、**语法分析**-输出`模版AST`（parse）
- 把`模版AST`转化为`Javascript AST`-输出`Javascript AST`（transformer）
- 根据`Javascript AST`生成Javascript代码-输出`目标代码`（generator）

![20220901142821](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20220901142821.png)

### AST-抽象语法树

AST的全称为**abstract syntax tree**-抽象语法书，Vue框架中模版AST即用于<u>描述template结构的抽象语法树</u>

如下一小段Vue3 template代码

```html
<template>
    <div>
        <h1 v-if="showTitle">Hello World</h1>
    </div>
</template>
```

经过解析后能得到一段模版AST产物

```javascript
const templateAst = {
    type: 'Root',
    children: [
        {
            type: 'Element', // 元素
            tag: 'div',
            children: [
                {
                    type: 'Element', // 元素
                    tag: 'h1',
                    props: [
                        {
                            type: 'Directive', // 指令
                            name: 'if', // 指令名
                            exp: {
                                type: 'Expression',
                                content: 'showTitle'
                            }
                        }
                    ],
                    children: 'Hello World'
                }
            ]
        }
    ]
}
```

通过该AST结构我们可以了解到

- 模版当中**不同类型**的标签节点通过`type属性`区分
- 标签节点的**属性节点**和**指令节点**存储在`props数组`当中
- 标签节点的子节点存储在`children数组`中
- 不同类型的标签节点会使用不同的属性（如：exp、name、content）来描述内容

### parser解析器实现原理

明确了输入与输出，我们开始学习**封装一个parser函数**，完成对模版template的**词法分析**、**语法分析**，最终生成模版AST

![20220901151406](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20220901151406.png)

```javascript
const demoTemplate = `
    <div>
        <h1 v-if="showTitle">Hello World</h1>
    </div>
`
const templateAST = parser(demoTemplate);
```

#### 解析第一阶段-模版标记化

解析器入参是一个字符串template，接收到字符串后解析器会逐个读取字符串模版中的字符，根据一定的规则将整个字符串切割为Token片段（词法记号，暂且理解为一个暂存信息的对象）

输入：
```html
<div>Hello World</div>
```

这段字符串作为输入会被处理输出为三个Token

输出：

- { type: 'tag', name: 'div' }
- { type: 'text', content: 'Hello World' }
- { type: 'tagEnd', name: 'div' }

而具体的字符读取规则相信大家都能第一时间联想到正则表达式进行匹配并消费字符，从而快速生成目标Token

但为了降低本节文章理解门槛，这里采取更加原始的解释说明

> 有限状态自动机：指一个"状态机"拥有有限个状态，而在程序运行过程中，能够自动的在不同状态之间转移；广义上：状态机是有限状态自动机的简称，是现实事物运行规则抽象而成的一个数学模型

举一个生活中的栗子：

就好比一道门，有`开`、`关`两种状态，初始状态为`关`

输入"open"指令后，门从`关`状态转移到`开`状态

在状态为`开`的前提下，输入"close"指令后，门从`开`状态转移到`关`状态

给定一个状态机（门），同时给定它的当前状态以及输入，那么输出状态时可以明确的计算出来的

解释完有限状态自动机的概念，我们便可以开始定制parser解析器需要用到的状态机

![20220901155438](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20220901155438.png)

这里我们拟定五个状态
- 初始状态：最开始状态机所处状态
- 标签开始状态：在**初始状态或文本状态**下，匹配到`'<'`字符，即切换到当前状态
- 标签名称状态：在**标签开始状态**下，匹配字母字符不为`'/'`，即切换到当前状态
- 文本状态：在**初始状态**下，匹配到`字母字符`，即切换到当前状态
- 结束标签状态：在**标签开始状态**下，匹配字符为`'/'`，即切换到当前状态
- 结束标签名称状态：在**结束标签状态**下，匹配到`字母字符`，即切换到当前状态

![20220901163012](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20220901163012.png)

根据以上状态转移图我们能够方便地编写好解析器的`模版标记化`（tokenized），最终得到一系列的Token

```javascript
const state = {
    initial: 1,
    tagOpen: 2,
    tagName: 3,
    text: 4,
    tagEnd: 5,
    tagEndName: 6,
}
// 判断字符是否为字母
const isAlpha = function (char) {
    return char >= 'a' && char <= 'z' || char >= 'A' && char <= 'Z';
}
// template字符串转化为Token
const tokenize = function (templateStr) {
    let currentState = state.initial; // 设置当前状态为初始状态
    const chars = []; // 临时存储匹配到的字符
    const tokens = []; // 存储已经解析好的Token
    while (templateStr) {
        const char = templateStr[0]; // 每一次循环均取首字符进行处理
        // switch-case分支处理
        switch (currentState) {
            case state.initial:
                // 初始状态下
                break;
            case state.tagOpen:
                // 标签开始状态
                break;
            case state.tagName:
                // 标签名称状态
                break;
            case state.text:
                // 文本状态
                break;
            case state.tagEnd:
                // 结束标签状态
                break;
            case state.tagEndName:
                // 结束标签名称状态
                break;
        }
    }
}
```

看到以上代码，聪明的你一定知道接下来要干什么了

没错！我们把switch-case中每一个分支对应的状态逻辑补充完整就可以了（看上去很简单，实际上就是很简单！）

PS: 此处读者可以先根据上方**输入输出**以及**状态转移图**自行思考一下每一个分支的处理逻辑应该是怎么样的，实在没想到可以继续往下看

- 初始状态
```javascript
let currentState = state.initial;
const chars = [];
const tokens = [];
while (templateStr) {
    const char = templateStr[0];
    switch (currentState) {
        case state.initial:
            // 初始状态下
            if (char === '<') {
                currentState = state.tagOpen; // 状态转移
                templateStr = templateStr.slice(1); // 消费一个字符
            } else if (isAlpha(char)) {
                currentState = state.text; // 状态转移
                chars.push(char); // 暂存当前字符
                templateStr = templateStr.slice(1); // 消费一个字符
            }
            break;
        // ...
    }
}
```

- 标签开始状态
```javascript
let currentState = state.initial;
const chars = [];
const tokens = [];
while (templateStr) {
    const char = templateStr[0];
    switch (currentState) {
        case state.tagOpen:
            // 标签开始状态
            if (char === '/') {
                currentState = state.tagEnd; // 状态转移-结束标签状态
                templateStr = templateStr.slice(1); // 消费一个字符‘/’
            } else if (isAlpha(char)) {
                currentState = state.tagName; // 状态转移-标签名称状态
                chars.push(char); // 暂存当前字符
                templateStr = templateStr.slice(1); // 消费一个字符
            }
            break;
        // ...
    }
}
```

- 标签名称状态
```javascript
let currentState = state.initial;
const chars = [];
const tokens = [];
while (templateStr) {
    const char = templateStr[0];
    switch (currentState) {
        case state.tagName:
            // 标签名称状态
            if (isAlpha(char)) {
                chars.push(char); // 暂存当前字符
                templateStr = templateStr.slice(1); // 消费一个字符
            } else if (char === '>') {
                currentState = state.initial; // 状态转移-初始状态
                tokens.push({
                    type: 'tag',
                    name: chars.join('')
                });
                chars.length = 0; // 已经消费chars临时数组内容，直接清空数组元素
                templateStr = templateStr.slice(1); // 消费一个字符‘>’
            }
            break;
        // ...
    }
}
```

- 文本状态
```javascript
let currentState = state.initial;
const chars = [];
const tokens = [];
while (templateStr) {
    const char = templateStr[0];
    switch (currentState) {
        case state.text:
            // 文本状态
            if (isAlpha(char)) {
                chars.push(char); // 暂存当前字符
                templateStr = templateStr.slice(1); // 消费一个字符
            } else if (char === '<') {
                currentState = state.tagOpen; // 状态转移-标签开始状态
                tokens.push({
                    type: 'text',
                    content: chars.join('')
                });
                chars.length = 0; // 已经消费chars临时数组内容，直接清空数组元素
                templateStr = templateStr.slice(1); // 消费一个字符‘<’
            }
            break;
        // ...
    }
}
```

- 结束标签状态
```javascript
let currentState = state.initial;
const chars = [];
const tokens = [];
while (templateStr) {
    const char = templateStr[0];
    switch (currentState) {
        case state.tagEnd:
            // 结束标签状态
            if (isAlpha(char)) {
                currentState = state.tagEndName; // 状态转移-结束标签名称状态
                chars.push(char); // 暂存当前字符
                templateStr = templateStr.slice(1); // 消费一个字符
            }
            break;
        // ...
    }
}
```

- 结束标签名称状态
```javascript
let currentState = state.initial;
const chars = [];
const tokens = [];
while (templateStr) {
    const char = templateStr[0];
    switch (currentState) {
        case state.tagEndName:
            // 结束标签名称状态
            if (isAlpha(char)) {
                chars.push(char); // 暂存当前字符
                templateStr = templateStr.slice(1); // 消费一个字符
            } else if (char === '>') {
                currentState = state.initial; // 状态转移-初始状态
                tokens.push({
                    type: 'tagEnd',
                    name: chars.join('')
                });
                chars.length = 0; // 已经消费chars临时数组内容，直接清空数组元素
                templateStr = templateStr.slice(1); // 消费一个字符‘<’
            }
            break;
        // ...
    }
}
```

以上便是每一个分支具体实现逻辑，不熟悉的读者可以对照`状态转移图`再次过一遍加深印象


#### 解析第二阶段-Token标记数组转AST

在将模版字符串转化为Token标记数组后我们需要进行下一步

循环扫描Token数组，结合栈的数据结构，实现将Token转化为AST树形结构

- { type: 'tag', name: 'div' } Token-1
- { type: 'text', content: 'Hello World' } Token-2
- { type: 'tagEnd', name: 'div' } Token-3

![20220905161907](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20220905161907.png)

![20220905161926](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20220905161926.png)

![20220905161941](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20220905161941.png)

![20220905162001](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20220905162001.png)

总结起来转化逻辑为：
- 模版字符串经过`tokenize`处理后输出Token数组
- 定义一个`elementStack`的数组用于临时存放Token元素
- 按照AST的结构要求定义一个虚拟根节点Root:{ type: 'Root', children: [] },并将其放入`elementStack`
- 循环扫描Token数组元素，对不同type的token对象进行不同处理
    - tag：创建Element类型的节点，将其push到当前`elementStack`栈顶元素的children数组属性中并将其压到`elementStack`中作为新的栈顶元素
    - text：创建Text类型的AST节点，将其push到当前`elementStack`栈顶元素的children数组属性中
    - tagEnd：将栈顶节点移除
- 当Token数组扫描完成后，返回Root节点对象

代码实现如下：

```javascript
const parse = function (str) {
    // 标记化
    const tokenArr = tokenize(str);
    // 虚拟根节点对象
    const root = {
        type: 'Root',
        children: []
    }
    // 栈结构
    const elementStack = [root];
    // 扫描Token数组
    while (tokenArr.length) {
        // 保存当前栈顶元素
        const parent = elementStack[elementStack.length - 1];
        const t = tokenArr[0];
        switch(t.type) {
            case 'tag':
                // 创建元素节点
                const elementNode = {
                    type: 'Element',
                    tag: t.name,
                    children: []
                }
                parent.children.push(elementNode);
                elementStack.push(elementNode);
                break;
            case 'text':
                // 创建文本节点
                const textNode = {
                    type: 'Text',
                    content: t.content
                }
                parent.children.push(textNode);
                break;
            case 'tagEnd':
                elementStack.pop();
                break;
        }
        tokenArr.shift();
    }
    return root;
}
const templateAST = parse('<div>Hello World</div>')
```

### transformer转换器实现原理

#### 模版AST节点访问

在进行下一步`transform`流程将模版AST转换为JS-AST之前，我们需要实现一个验证AST的方法

首先实现一个工具函数能够打印当前AST节点的信息

```javascript
const dumpAst = function(node, indent = 0) {
    const type = node.type;
    const desc = node.type === 'Root' ? '' : node.type === 'Element' ? node.tag : node.content;

    console.log(`${'-'.repeat(indent)}${type}: ${desc}`);

    if (node.children) {
        node.children.forEach((nod) => {
            dumpAst(nod, indent + 2);
        })
    }
}
```

接着实现AST节点访问，从根节点开始进行**深度优先遍历**（DFS）

```javascript
const traverseNode = function (ast) {
    const currentNode = ast;
    const children = currentNode.children;
    if (children) {
        for (let i = 0; i < children.length; i++) {
            traverseNode(children[i]);
        }
    }
}
```

在tracerseNode函数中，我们除了可以进行节点的访问，还可以实现一些额外的AST节点转换功能

比如将`p标签`转换为`span标签`...

```javascript
const traverseNode = function (ast) {
    const currentNode = ast;
    if (currentNode.type === 'Element' && currentNode.tag === 'p') {
        currentNode.tag = 'span';
    }
    // 其它转换...
    const children = currentNode.children;
    if (children) {
        for (let i = 0; i < children.length; i++) {
            traverseNode(children[i]);
        }
    }
}
```

但随着转化逻辑变多，这个函数便会变得复杂且庞大，因此我们采用提供上下文回调函数的形式将转换逻辑抽离

```javascript
const traverseNode = function (ast, context) {
    const currentNode = ast;
    // 获取转换逻辑回调函数数组nodeTransforms，遍历并将currentNode传入进行处理
    const transforms = context.nodeTransforms;
    for (let i = 0; i < transforms.length; i++) {
        transforms[i](currentNode, context);
    }
    const children = currentNode.children;
    if (children) {
        for (let i = 0; i < children.length; i++) {
            traverseNode(children[i]);
        }
    }
}
```

有了上下文的入参选项，后续便可以这样使用

```javascript
const transform = function (ast) {
    const context = {
        nodeTransforms: [
            transformElement, // 回调函数功能：转换标签节点
            transformText, // 回调函数功能：转换文本节点
        ]
    }
    // 将上下文传入traverseNode
    traverseNode(ast, context);
    console.log(dumpAst(ast));
}
```

#### 构造转换上下文对象信息

以上我们只用到上下文对象的基本信息，上下文的存在其实是因为我们在进行AST转换时会对当前正在处理的节点进行较多且复杂的操作，而上下文能够维护当前正在处理节点的状态

以下为构造上下文结构：

```javascript
const transformElement = function (node) {
    if (node.type === 'Element' && node.tag === 'p') {
        node.tag = 'h1'
    }
}
const transformText = function (node) {
    if (node.type === 'Text') {
        node.content = '_private' + node.content;
    }
}
const transform = function (ast) {
    const context = {
        currentNode: null, // 暂存正在转换的节点
        childIndex: 0, // 暂存当前节点在父节点children的位置索引
        parent: null, // 当前节点的父节点
        nodeTransforms: [
            transformElement, // 回调函数功能：转换标签节点
            transformText, // 回调函数功能：转换文本节点
        ]
    }
    // 将上下文传入traverseNode
    traverseNode(ast, context);
    console.log(dumpAst(ast));
}
```

traverseNode函数也同步更新一下

```javascript
const traverseNode = function (ast, context) {
    context.currentNode = ast; // change_1: 将ast直接保存到上下文currentNode中
    const transforms = context.nodeTransforms;
    for (let i = 0; i < transforms.length; i++) {
        transforms[i](context.currentNode, context); // change_2: 将上下文传入处理函数
    }
    const children = currentNode.children;
    if (children) {
        for (let i = 0; i < children.length; i++) {
            context.parent = context.currentNode; // change_3: 递归调用前，将当前节点设置为父节点
            context.childIndex = i; // change_4: 设置位置索引
            traverseNode(children[i], context);
        }
    }
}
```

到这里，我们实现的函数当中已经拥有记录上下文状态的能力，接下来我们便可以新增`节点替换功能`

回顾上述的编译流程当中，有一个子流程为：将模版AST转换为JS-AST

这中间需要用到节点替换的功能，说白了就是在上下文当中定义多一个属性方法，接收新节点对象参数并替换掉旧节点对象

```javascript
const transformText = function (node, context) {
    if (node.type === 'Text') {
        context.replaceNode({ // change_1
            type: 'Element',
            tag: 'p'
        });
    }
}
const transform = function (ast) {
    const context = {
        currentNode: null, // 暂存正在转换的节点
        childIndex: 0, // 暂存当前节点在父节点children的位置索引
        parent: null, // 当前节点的父节点
        replaceNode(node) { // change_2
            // 找到当前节点的父节点children数组，根据当前的childIndex标记找到当前节点所在位置进行替换
            context.parent.children[context.childIndex] = node;
            // 同时更新上下文中currentNode的值为新节点
            context.currentNode = node;
        },
        nodeTransforms: [
            transformElement, // 回调函数功能：转换标签节点
            transformText, // 回调函数功能：转换文本节点
        ]
    }
    traverseNode(ast, context);
    console.log(dumpAst(ast));
}
```

上文我们有学习到如何进行`节点属性的变换`，到这里我们进一步学习到如何通过**上下文**实现`整个节点的转换`

当然熟悉CRUD的同学们稍微联想一下，我们能够在这个思路当中实现移除当前访问节点的功能

```javascript
const transform = function (ast) {
    const context = {
        currentNode: null, // 暂存正在转换的节点
        childIndex: 0, // 暂存当前节点在父节点children的位置索引
        parent: null, // 当前节点的父节点
        replaceNode(node) {
            context.parent.children[context.childIndex] = node;
            context.currentNode = node;
        },
        removeNode() { // change_1: 新增移除节点功能
            if (context.parent) {
                context.parent.children.splice(context.childIndex, 1); // 找到当前父节点children并移除当前访问节点
                context.currentNode = null; // 将上下文currentNode属性置空
            }
        },
        nodeTransforms: [
            transformElement, // 回调函数功能：转换标签节点
            transformText, // 回调函数功能：转换文本节点
        ]
    }
    traverseNode(ast, context);
    console.log(dumpAst(ast));
}
const traverseNode = function (ast, context) {
    context.currentNode = ast; // 将ast直接保存到上下文currentNode中
    const transforms = context.nodeTransforms;
    for (let i = 0; i < transforms.length; i++) {
        transforms[i](context.currentNode, context); // 将上下文传入处理函数
        if (!context.currentNode) { // change_1: 转换函数有可能删除了当前节点，这里判断一下，若被删除直接返回，回到上一层递归的flag_1位置
            return ;
        }
    }
    const children = currentNode.children;
    if (children) {
        for (let i = 0; i < children.length; i++) {
            context.parent = context.currentNode; // 递归调用前，将当前节点设置为父节点
            context.childIndex = i; // 设置位置索引
            traverseNode(children[i], context); // flag_1
        }
    }
}
```

由于转换函数有可能删除了当前节点，故在`traverseNode`函数中每一个`transforms`转换函数执行后均需要判断一下当前访问节点是否被删除，若被删除直接返回，回到上一层递归的flag_1位置

#### 节点访问顺序

当前代码

```javascript
const templateAST = parse('<div>Hello World</div>');
const traverseNode = function (ast, context) {
    context.currentNode = ast; // 将ast直接保存到上下文currentNode中
    const transforms = context.nodeTransforms;
    for (let i = 0; i < transforms.length; i++) {
        transforms[i](context.currentNode, context); // 将上下文传入处理函数
        if (!context.currentNode) { // 转换函数有可能删除了当前节点，这里判断一下，若被删除直接返回，回到上一层递归的flag_1位置
            return ;
        }
    }
    const children = currentNode.children;
    if (children) {
        for (let i = 0; i < children.length; i++) {
            context.parent = context.currentNode; // 递归调用前，将当前节点设置为父节点
            context.childIndex = i; // 设置位置索引
            traverseNode(children[i], context);
        }
    }
}
const transform = function (ast) {
    const context = {
        currentNode: null, // 暂存正在转换的节点
        childIndex: 0, // 暂存当前节点在父节点children的位置索引
        parent: null, // 当前节点的父节点
        replaceNode(node) {
            // ...
        },
        removeNode() {
            // ...
        },
        nodeTransforms: [
            transformElement, // 回调函数功能：转换标签节点
            transformText, // 回调函数功能：转换文本节点
        ]
    }
    traverseNode(ast, context);
    console.log(dumpAst(ast));
}
transform(templateAST);
```

理解当前代码的逻辑后我们会发现现在的`traverseNode`函数执行时对AST树的遍历访问是自上而下的，也就是说访问到某一个`节点A`时，`节点A`的`父节点B`已经被转换函数处理过了

但如果我们现在有一个转换的需求是`依赖于子节点的转换结果`来`对当前节点进行转换`(即父节点的转换逻辑需要在子节点转换流程之后再执行)，当前的实现并无法满足我们的需求

我们称当前工作流为`进入阶段转换`，要想满足上述需求，我们必须设计一个`退出阶段转换`的逻辑（此处应该有图，小编lazy为true了！@TODO）

```javascript
const traverseNode = function (ast, context) {
    context.currentNode = ast;
    const exitFns = []; // change_1: 新增退出阶段回调函数数组
    const transforms = context.nodeTransforms;
    for (let i = 0; i < transforms.length; i++) {
        const exitCallback = transforms[i](context.currentNode, context); // change_2: 转换函数返回一个匿名回调函数作为退出阶段执行的方法
        if (exitCallback) { // change_3: 若返回不为空，将其保存到退出回调exitFns暂存数组中
            exitFns.push(exitCallback);
        }
        if (!context.currentNode) {
            return ;
        }
    }
    const children = currentNode.children;
    if (children) {
        for (let i = 0; i < children.length; i++) {
            context.parent = context.currentNode;
            context.childIndex = i;
            traverseNode(children[i], context);
        }
    }
    for (let i = exitFns.length - 1; i >= 0; i--) { // change_4: 由于是[退出阶段]的转换函数，逆序依次执行
        exitFns[i]();
    }
}

```

通过几处变动，我们提供了定义`退出转换阶段`执行逻辑的方法：转换函数执行返回一个回调函数，该回调函数会在**当前递归层**退出阶段执行（对应change_4）

```javascript
const transformText = function (node, context) {
    // Text节点转换逻辑...
    return () => {
        // change_1: 此处逻辑将在退出节点时执行，并且执行时节点的子节点均处理完成
    }
}
const transform = function (ast) {
    const context = {
        currentNode: null, // 暂存正在转换的节点
        childIndex: 0, // 暂存当前节点在父节点children的位置索引
        parent: null, // 当前节点的父节点
        replaceNode(node) {
            // ...
        },
        removeNode() {
            // ...
        },
        nodeTransforms: [
            transformText, // 回调函数功能：转换文本节点
        ]
    }
    traverseNode(ast, context);
    console.log(dumpAst(ast));
}
```

这种`退出转换`机制设计有两个好处：
- 保证所有子节点全部处理完成
- 保证所有后续注册的转换函数执行完成

#### 模版AST转JavaScriptAST

以上我们学习了三个在AST转化过程中最重要的知识：

`实现模版AST节点访问方法`

`实现借助上下文对象实现简单插件机制`

`实现提供节点退出访问机制`

接下来我们学习实践最终的转换流程

声明式-template模版：

```html
<div><span>Hello</span><span>World</span></div>
```

命令式JS实现-渲染函数：

```javascript
function render() {
    return h('div', [
        h('span', 'Hello'),
        h('span', 'World'),
    ]);
}
```

和上文提到的模版AST相似，JS-AST是这段JS渲染函数代码的描述

> JS普通函数组成（不考虑箭头函数等情况）

函数声明由几部分组成：
- id：函数名称-标识符Identifier
- params：函数的参数（数组）
- body：函数体（数组），含有多条代码语句

简单JS函数的AST节点：
```javascript
const FunctionDecNode = {
    type: 'FunctionDeclaration', // 函数声明类型节点
    id: {
        type: 'Identifier',
        name: 'render' // 函数名（标识符的名称）
    },
    params: [], // 函数无入参，数组为空
    body: [
        {
            type: 'ReturnStatement', // 类型：返回声明
            return: null // 暂时为空
        }
    ]
}
```

常用JS的AST节点：

```javascript
const CallExp = {
    type: 'CallExpression',
    callee: {
        type: 'Identifier',
        name: 'h' // 被调用函数名称
    },
    arguments: []
}
const StrExp = {
    type: 'Literal',
    value: 'div'
}
const ArrExp = {
    type: 'ArrayExpression',
    elements: []
}
```

- callee: 用于描述被调用函数的名称，本身是一个标识符节点
- arguments: 被调用函数的形式参数（数组）
- elements：存储数组元素AST节点对象

了解了常用AST节点的结构组成后，我们便可以对渲染函数进行JS-AST构造

> AST预览器：https://astexplorer.net/

```javascript
const renderNode = {
    type: "FunctionDeclaration", // 函数定义节点
    id: { type: 'Identifier', name: 'render' }, // 标识符节点: render
    params: [],
    body: {
        type: 'BlockStatement',
        body: [
            {
                type: 'ReturnStatement', // 返回声明节点
                argument: {
                    type: 'CallExpression',
                    callee: { type: 'Identifier', name: 'h' }, // 标识符节点: h
                    arguments: [
                        { type: 'Literal', value: 'div',},
                        {
                            type: 'ArrayExpression', // 数组节点
                            elements: [
                                {
                                    type: 'CallExpression', // 调用表达式节点
                                    callee: { type: 'Identifier', name: 'h' }, // 标识符节点: h
                                    arguments: [
                                        { type: 'Literal', value: 'span' },
                                        { type: 'Literal', value: 'Hello' }
                                    ],
                                },
                                {
                                    type: 'CallExpression', // 调用表达式节点
                                    callee: { type: 'Identifier', name: 'h' }, // 标识符节点: h
                                    arguments: [
                                        { type: 'Literal', value: 'span' },
                                        { type: 'Literal', value: 'World' }
                                    ],
                                }
                            ]
                        }
                    ],
                }
            }
        ]
    }
}
```

了解了AST常用节点的结构以及他们之间的关系后，我们便可以着手实现转换函数

首先定义几个辅助函数，方便我们进行节点转换

```javascript
const createLiteral = function (value) {
    return {
        type: 'Literal',
        value
    }
}
const createIdentifier = function (name) {
    return {
        type: 'Identifier',
        name
    }
}
const createArrayExpression = function (elements) {
    return {
        type: 'ArrayExpression',
        elements
    }
}
const createCallExpression = function (callee, arguments) {
    return {
        type: 'CallExpression',
        callee: createIdentifier(callee),
        arguments
    }
}
```

接着定义两个转换函数（重要‼️）

```javascript
const transformText = function (node) {
    if (node.type !== 'Text') {
        return ;
    }
    node.jsNode = createLiteral(node.content);
}

const transformElement = function (node) {
    // 转换逻辑放在退出阶段，保证所有子节点已经处理完成
    return () => {
        if (node.type !== 'Element') {
            return ;
        }
        const callExp = createCallExpression('h', [
            createLiteral(node.tag);
        ]);
        node.children.length === 1 ? callExp.arguments.push(node.children[0].jsNode) : callExp.arguments.push(createArrayExpression(node.children.map(item => item.jsNode)));
        node.jsNode = callExp;
    }
}
```

注意：
- 在转换标签节点时，需要将转换逻辑写在退出阶段执行的回调函数当中，保证子节点全部已经处理完成
- 所有节点转换后的JS-AST均保存到节点的node.jsNode属性当中

最后我们需要将描述render函数本身的函数声明语句节点添加到JS-AST当中(**第三个重要转换函数**)

```javascript
const transformRoot = function (node) {
    return () => {
        if (node.type !== 'Root') {
            return;
        }
        const vnodeJSAST = node.children[0].jsNode;
        node.jsNode = {
            type: 'FunctionDeclaration',
            id: { type: 'Identifier', name: 'render' },
            params: [],
            body: [
                {
                    type: 'ReturnStatement',
                    return: vnodeJSAST
                }
            ]
        }
    }
}
```

现在我们便可以直接通过访问`Root节点对象`中的`jsNode`拿到转换好的`JS-AST`

### 代码生成器实现原理

上一节中已经完成`JS-AST`的构造

本节将进行最后一步：`生成目标代码`

```javascript
const cimpile = function (template) {
    const templateAST = parse(template); // 解析
    trasform(templateAST); // AST转换
    const jsAST = templateAST.jsNode;
    const code = generate(jsAST); // 目标代码生成
    return code;
}
```

首先定义一个上下文用于维护代码生成过程中的状态以及提供一些工具函数用于优化代码格式提高目标代码可读性

```javascript
const generate = function (node) {
    const context = {
        code: '',
        // 拼接代码字符串
        push(code) {
            context.code += code;
        },
        // 记录当前缩进
        currentIndent: 0,
        // 换行
        newline() {
            context.code += '\n' + `  `.repeat(context.currentIndent)
        },
        // 新增缩进
        indent() {
            context.currentIndent++;
            context.newline();
        },
        // 取消缩进
        deIndent() {
            context.currentIndent--;
            context.newline();
        }
    }
    genNode(node, context); //生成代码
    return context.code;
}
```

有了上下文对象支持后开始编写genNode函数完成`代码生成`

```javascript
const genNode = function (node, context) {
    switch(node.type) {
        case 'FunctionDeclaration':
            genFunctionDeclaration(node, context); // 生成函数声明代码
            break;
        case 'ReturnStatement':
            genReturnStatement(node, context); // 生成函数返回声明代码
            break;
        case 'CallExpression':
            genCallExpression(node, context); // 生成调用表达式代码
            break;
        case 'Literal':
            genLiteral(node, context); // 生成文本代码
            break;
        case 'ArrayExpression':
            genArrayExpression(node, context); // 生成数组表达式代码
            break;
    }
}
```

最后实现每一个类型节点的代码生成函数即可完成

```javascript
// 处理函数声明入参字符串拼接
const genNodeList = function () {
    const { push } = context;
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        genNode(node, context);
        if (i < nodes.length - 1) {
            push(', ');
        }
    }
}
const genFunctionDeclaration = function (node, context) {
    const { push, indent, deIndent } = context;
    push(`function ${node.id.name}`);
    push(`(`);
    genNodeList(node.params, context);
    push(')');
    push('{');
    indent();
    // 遍历执行函数体内每一条语句的代码拼接
    node.body.forEach((item) => {
        genNode(item, context);
    });
    deIndent();
    push('}');
}
```

聪明滴同学肯定已经发现其中的实现思路了，没错，就是利用上下文中的`push函数`不断进行代码字符串拼接

剩下还有`genReturnStatement`、`genCallExpression`、`genLiteral`、`genArrayExpression`就留给大家自行实现啦～（lazy警告⚠️）

```javascript
const templateAST = parse('<div><span>Hello</span><span>World</span></div>');
transform(templateAST);
const jsAST = templateAST.jsNode;
const code = generate(jsAST); // 目标代码
```

code对应的字符串为：

```javascript
function render() {
    return h('div', [h('span', 'Hello'), h('span', 'World')])
}
```

## 讲到最后

以上我们已经完成了一个简易版本的`Vue3编译器`

我们首先学习了Vue3模版编译器工作流程，对应三大步骤：

- 分析`template模版`并转化为`模版AST`
- `模版AST`通过`transformer`转换为渲染函数的`JS-AST`
- 依据`JS-AST`生成`渲染函数代码`

然后我们开始按照这个流程学习解析器parser的实现，掌握了利用`有限状态自动机`进行`字符串切割`的方法，了解到正则底层的实现就是有限状态自动机

后来我们为transform逻辑做铺垫，实现了一个简易的`AST转换插件化机制`，引入`上下文`的概念维护当前节点状态，辅助完成复杂的转换工作，还另外提供了退出阶段转换逻辑的注册方法，实现`节点转换时机控制`

最后我们能够根据JS-AST生成出渲染函数JS代码字符串

大家通过上述内容，能够拥有模版编译实现的清晰思路，那将会是一件非常棒的事情！

谢谢大家，我们下节再见！！！

> 感谢各位看到这里，如果你觉得本节内容还不错的话，欢迎各位的**点赞、收藏、评论**，大家的支持是我做内容的最大动力

> 本文为作者原创，欢迎转载，但未经作者同意必须保留此段声明，且在文章页面明显位置给出原文链接，否则保留追究法律责任的权利

## 补充-Vue3传送门链接

[Vue3文档](https://cn.vuejs.org/)

[Vue3仓库](https://github.com/vuejs/core)













