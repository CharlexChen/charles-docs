<!--
 * @Author: charlexchen charlexchen@tencent.com
 * @Date: 2022-08-25 11:02:59
 * @LastEditors: charlexchen charlexchen@tencent.com
 * @LastEditTime: 2022-08-30 21:58:33
 * @FilePath: /frontend_study_charles/publish-article/vue3渲染器.md
 * @Description: 手写Vue3 | 渲染器
 * 
-->
# [陈同学i前端] 手写Vue3 | 渲染器

## 前言

大家好，我是陈同学，一枚野生前端开发者，感谢各位的**点赞、收藏、评论**

Vue3的正式发布已经有将近两年的时间，许多开源项目以及企业实际生产项目陆续采用Vue3作为渐进性开发框架，诚然它的架构设计值得我们每一位前端研发者学习

Vue3通过一定的机制，将一份模板转换为真实的 DOM 节点，并且实现高效地更新这些节点，接下来将尝试深入研究 Vue 的内部渲染机制

> PS：本文存在较多代码示例，若发现有陌生方法，使用Ctrl+F搜索即可

本文阅读成本与收益如下：

阅读耗时：`13mins`

全文字数：`10k`

## 预期效益
- 掌握Vue3渲染器的实现思路

## 虚拟DOM

**虚拟DOM(VDOM)**：是一种编程概念，意为将目标所需的 UI 通过数据结构“虚拟”地表示出来，保存在内存中，然后将真实的 DOM 与之保持同步

简单的例子：

```javascript
const vnode = {
  type: 'div',
  props: {
    id: 'vue3'
  },
  children: [
    {
        type: 'div',
        props: {
            id: 'my'
        },
        children: 'Hello World'
    }
    /* 更多 vnode */
  ]
}

```

```html
<!-- 渲染结果：output.html -->
<div id="vue3">
  <div id="my">Hello World</div>
</div>
```

**挂载 (mount)**：一个运行时渲染器将会遍历整个虚拟 DOM 树，并据此构建真实的 DOM 树

**更新 (patch)**：有两份虚拟 DOM 树，渲染器将会有比较地遍历它们，找出它们之间的区别，并应用这其中的变化到真实的 DOM 上

**虚拟 DOM 的效益**：让开发者能够灵活、声明式地创建、检查和组合所需 UI 的结构，同时只需把具体的 DOM 操作留给渲染器去处理

## 渲染流程

![20220829112305](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20220829112305.png)

Vue 组件挂载后触发：

1. 编译（见文章）：Vue 模板被编译为了渲染函数：即用来返回虚拟 DOM 树的函数。这一步骤可以通过构建步骤提前完成，也可以通过使用运行时编译器即时完成

2. 挂载：运行时渲染器调用渲染函数，遍历返回的虚拟 DOM 树，并基于它创建实际的 DOM 节点。这一步会作为响应式副作用执行，因此它会追踪其中所用到的所有响应式依赖

3. 更新：当一个依赖发生变化后，副作用会重新运行，这时候会创建一个更新后的虚拟 DOM 树。运行时渲染器遍历这棵新树，将它与旧树进行比较，然后将必要的更新应用到真实 DOM 上去

## 渲染器简单实现

了解了虚拟DOM以及渲染流程后，我们可以进行简单渲染器的编写

```javascript
/**
 * 渲染器创建函数
 */
export const createRenderer = function (options) {
  const {
    createElement: hostCreateElement,
    setElementText: hostSetElementText,
    patchProp: hostPatchProp,
    insert: hostInsert,
    remove: hostRemove,
    setText: hostSetText,
    createText: hostCreateText,
  } = options;
  const patch = function (oldVNode, newVNode, container) {
    const { type } = newVNode;
    switch(type) {
        case Text:
            // 创建并挂载文本结点
            break;
        case Fragment:
            // 创建并挂载Fragment结点
            break;
    }
  };
  return function render(vnode, container) {
    patch(null, vnode, container);
  };
};
```

> 文章后面若不做说明，所有**新定义的函数**均放在`createRenderer`函数体内

以上为渲染器创建函数，入参options需要包括`createElement`、`setElementText`、`patchProp`、`insert`、`remove`、`setText`、`createText`的方法实现

此刻可能会有小伙伴提出疑问，为什么需要一个工厂函数而不是直接定义render方法

试想一下若现在我们直接定义好一个`render函数`，里面写满了通过`document`操作DOM的API，那么这个渲染器就只能用于浏览器环境（window、document），到了其它平台上便无法使用，所以为了**通用性**、**可扩展性**，vue3渲染器开发者提供一个`createRenderer工厂函数`，让开发者们自定义具体元素操作的逻辑

### 自定义节点操作

这里给出本节文章自定义具体节点元素操作的逻辑实现：

```javascript
// 判断标签的props中key是否为事件名称
export const isOn = (key) => /^on[A-Z]/.test(key);
// 用于创建普通的Element-DOM节点
function createElement(type) {
  console.log('>>>createElement', type);
  return document.createElement(type);
}
// 用于创建普通的Text-DOM节点
function createText(text) {
  console.log('>>>createText', text);
  return document.createTextNode(text);
}
// 用于设置已有节点的nodeValue值
function setText(node, text) {
  node.nodeValue = text;
}
// 用于设置已有节点的textContent值
function setElementText(el, text) {
  console.log('>>>setElementText', el, text);
  el.textContent = text;
}
// 用于处理节点中prop属性
// 两种情况：onXxx形式的事件绑定、xxx形式的普通属性绑定
function patchProp(el, key, preValue, nextValue) {
  console.log(`>>>patchProp`);
  console.log(`key:${key} preValue:${preValue} nextValue:${nextValue}`);
  if (isOn(key)) {
    /**
     * 添加/更新事件处理函数
     * _vei用于存储所有该节点上的事件key->function
     */
    const invokers = el._vei || (el._vei = {});
    const existingInvoker = invokers[key];
    if (nextValue && existingInvoker) {
      /**
       * 修改函数的值
       */
      existingInvoker.value = nextValue;
    } else {
      /**
       * 添加/移除事件处理函数
       */
      const eventName = key.slice(2).toLowerCase();
      if (nextValue) {
        const invoker = (invokers[key] = nextValue);
        el.addEventListener(eventName, invoker);
      } else {
        el.removeEventListener(eventName, existingInvoker);
        invokers[key] = undefined;
      }
    }
  } else {
    /**
     * 处理普通标签属性
     */
    if (nextValue === null || nextValue === '') {
      el.removeAttribute(key);
    } else {
      el.setAttribute(key, nextValue);
    }
  }
}
// 插入一个子节点
function insert(child, parent, anchor = null) {
  console.log('>>>insert');
  parent.insertBefore(child, anchor);
}
// 移除一个节点
function remove(child) {
  console.log('>>>remove');
  const parent = child.parentNode;
  if (parent) {
    parent.removeChild(child);
  }
}
```

定义完成后，只需要将函数组装成options对象传递给`createRenderer函数`即可获得一个渲染器实例

```javascript
const options = {
  // ...
}
const renderInstance = createRenderer(options);
const vnode = {
  type: 'div',
  props: {
    style: 'color: red'
  },
  children: [
    {
      type: 'span',
      props: {
        style: 'color: blue'
      }
    }
  ]
}
// 通过渲染实例将虚拟DOM挂载到实际DOM（id=app）上
renderInstance(vnode, document.querySelector('#app'));
```

### 渲染器节点创建与更新

接下来我们继续看一下渲染器内部都做了些啥

```javascript
/**
 * 渲染器创建函数
 */
export const createRenderer = function (options) {
  // ...
  const patch = function (oldVNode, newVNode, container) {
    const { type } = newVNode;
    switch(type) {
        case Text:
          // 创建并挂载文本结点 processText
          processText(oldVNode, newVNode, container);
          break;
        case Fragment:
          // 创建并挂载Fragment结点 processFragment
          processFragment(oldVNode, newVNode, container);
          break;
        default:
          // 创建并挂载Element节点 processElement
          processElement(oldVNode, newVNode, container, anchor, parentComponent);
          // 此处暂时省略processComponent,vue3中基于vdom的shapeFlag进行判断
          break;
    }
  };
  return function render(vnode, container) {
    patch(null, vnode, container);
  };
};
```

`renderInstance`实际上就是带有闭包信息的`render函数`

而在render函数内部调用`patch方法`

patch函数：根据类型调用合适的处理方法
- 提取`newVNode`的`type`属性
- 根据`type`属性调用不同的处理函数（进行**目标节点的创建与挂载**）

> 文本节点

文本节点虚拟DOM对象中的`children`属性为字符串格式

```javascript
const processText = function (oldVNode, newVNode, container) {
  // newVNode.children为string类型
  console.log('>>>processText');
  if (oldVNode === null) {
    // 旧节点为空，创建并挂载文本节点
    hostInsert((newVNode.el = hostCreateText(newVNode.children)), container);
  } else {
    // 旧节点存在，更新Text节点
    // 防止后续无法找到真实DOM元素的引用：oldVNode.el赋值给newVNode.el
    const el = (newVNode.el = oldVNode.el!);
    if (newVNode.children !== oldVNode.children) {
      hostSetText(el, newVNode.children);
    }
  }
}
```

以上为处理文本节点的方法，关于`hostCreateText`、`hostSetText`、`hostInsert`的实现在本文前面部分，大家可以`Ctrl+F`进行搜索定位

> Fragment节点

Fragment类型的节点比较特殊，我们只需要遍历挂载它的`children`数组中所有的虚拟DOM对象

```javascript
const processFragment = function (oldVNode, newVNode, container) {
  /**
   * 渲染children添加到container内（如template标签）
   */
  if (!oldVNode) {
    mountChildren(newVNode.children, container);
  }
}
const mountChildren = function (children, container) {
  console.log(">>>mountChildren", children);
  children.forEach((VNodeChild) => {
    patch(null, VNodeChild, container);
  });
}
```


> Element节点

Element节点为通用节点，常用的div、span等标签均可以归为Element节点

以下代码段稍长，说明与注释会加入到代码片段当中

```javascript
const processElement = function (oldVNode, newVNode, container, anchor, parentComponent) {
  if (!oldVNode) {
    // 无旧节点，直接挂载新Element节点
    mountElement(newVNode, container, anchor);
  } else {
    // 有旧节点，对比更新旧节点
    patchElement(oldVNode, newVNode, container, anchor, parentComponent);
  }
}

// 挂载Element节点
const mountElement = function (vnode, container, anchor) {
  const { props } = vnode;
  // 创建 Element 节点
  const el = (vnode.el = hostCreateElement(vnode.type));
  // 判断children类型
  if (typeof vnode.children == 'string') {
    // children为字符串，直接设置文本内容
    hostSetElementText(el, vnode.children);
  } else if (Array.isArray(vnode.children)) {
    // children为数组，递归进行patch
    mountChildren(vnode.children, el);
  }
  // 处理Element虚拟DOM对象中的props
  if (props) {
    for (const key in props) {
      const nextVal = props[key];
      hostPatchProp(el, key, null, nextVal);
    }
  }
  // trigger：触发 beforeMount 钩子（TODO）
  console.log("vnodeHook -> onVnodeBeforeMount");
  console.log("DirectiveHook -> beforeMount");
  console.log("transition -> beforeEnter");

  // 挂载真实节点（DOM操作：插入节点）
  hostInsert(el, container, anchor);

  // trigger：触发 mounted 钩子（TODO）
  console.log("vnodeHook -> onVnodeMounted");
  console.log("DirectiveHook -> mounted");
  console.log("transition -> enter");
}

// 更新Element节点
function patchElement(n1, n2, container, anchor, parentComponent) {
  const oldProps = (n1 && n1.props) || {};
  const newProps = n2.props || {};
  // 更新element
  console.log("旧的 vnode", n1);
  console.log("新的 vnode", n2);

  // 新的vnode关联el（真实DOM引用）
  const el = (n2.el = n1.el);

  // 对比 props 并处理更新
  patchProps(el, oldProps, newProps);

  // 对比 children（本节文章省略）
  patchChildren(n1, n2, el, anchor, parentComponent);
}
// 遍历children数组并进行patch
const mountChildren = function (children, container) {
  console.log(">>>mountChildren", children);
  children.forEach((VNodeChild) => {
    patch(null, VNodeChild, container);
  });
}

// 处理props属性的变更
const patchProps = function (el, oldProps, newProps) {
  if (oldProps !== newProps) {
    // 以新的props为基准，更新存在的属性，新增不存在的属性
    for (const key in newProps) {
      // 判断是否保留字段，如：
      /**
       * ',key,ref,ref_for,ref_key,' +
        'onVnodeBeforeMount,onVnodeMounted,' +
        'onVnodeBeforeUpdate,onVnodeUpdated,' +
        'onVnodeBeforeUnmount,onVnodeUnmounted'
       */
      if (isReservedProp(key)) continue;
      const next = newProps[key]
      const prev = oldProps[key]
      // defer patching value
      if (next !== prev && key !== 'value') {
        hostPatchProp(el, key, prev, next);
      }
    }
    if (oldProps !== EMPTY_OBJ) {
      // 以旧的props为基准，删除已过期的属性
      for (const key in oldProps) {
        if (!isReservedProp(key) && !(key in newProps)) {
          hostPatchProp(el, key, oldProps[key], null);
        }
      }
    }
    /**
     * 对newProps中的value进行特殊处理
     */
    if ('value' in newProps) {
      hostPatchProp(el, 'value', oldProps.value, newProps.value);
    }
  }
}
```

在Element节点的process当中还有一个函数逻辑尚未实现`patchChildren`,该函数用于对比并更新节点的子节点数组，也就是我们常说的`diff`节点更新对比流程(由于需要控制篇幅，diff相关放在下一章节进行讲解)

## 讲到最后

以上我们已经完成了一个简易可扩展的`渲染器创建工厂`

一开始我们讲述专门定义一个函数进行渲染器函数的生产是为了提高渲染系统的可扩展性，接着我们重点了解了渲染器内部三种类型的节点是如何进行虚拟DOM对象的挂载、对比、更新

本节省略了新旧节点children数组的对比diff逻辑，将在下一节文章中进行讲述，尽情期待～！

谢谢大家，我们下节再见！！！

> 感谢各位看到这里，如果你觉得本节内容还不错的话，欢迎各位的**点赞、收藏、评论**，大家的支持是我做内容的最大动力

> 本文为作者原创，欢迎转载，但未经作者同意必须保留此段声明，且在文章页面明显位置给出原文链接，否则保留追究法律责任的权利

## 补充-Vue3传送门链接

[Vue3文档](https://cn.vuejs.org/)

[Vue3仓库](https://github.com/vuejs/core)






