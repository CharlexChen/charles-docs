<!--
 * @Author: charlexchen charlexchen@tencent.com
 * @Date: 2022-09-18 11:20:55
 * @LastEditors: charlexchen charlexchen@tencent.com
 * @LastEditTime: 2022-09-26 15:25:24
 * @FilePath: /frontend_study_charles/publish-article/vue3Diff算法.md
 * @Description: 手写Vue3 | DIFF算法
 * 
-->
# [陈同学i前端] 手写Vue3 | Diff算法-基础

## 前言

大家好，我是陈同学，一枚野生前端开发者，感谢各位的点赞、收藏、评论

上一章节文章中我们学习了Vue3的渲染器相关概念与知识，接下来我们将继续上一节内容的学习，通过本篇文章你能快速掌握Diff算法，实现Vue3新旧子节点比较更新

> 若尚未阅读上一章节的【渲染器】滴同学，请点击此处[传送门](https://juejin.cn/post/7137670384073064478)

本文阅读成本与收益如下：

阅读耗时：`15mins`

全文字数：`20k+`

## 预期效益

- 快速掌握Diff算法核心实现，实现新旧子节点数组比较更新

## 为什么需要Diff算法

上一章节中我们学习了虚拟DOM（`vnode`）的概念以及数据结构（一个描述节点信息的对象）

试想一下当有一个旧的`vnode`和一个新的`vnode`，他们的`children`属性都是保存一组节点描述信息对象的`数组`

当我们需要进行节点更新（旧节点更新到新节点）时，**最简单的做法**是遍历将旧节点的children元素对应的DOM进行卸载，再重新遍历挂载新节点的children元素对应的DOM，但这样会导致比较大的开销

> 举个简单的例子

```javascript
const oldVNode = {
    type: 'div',
    children: [
        { type: 'span', children: 'a' },
        { type: 'span', children: 'b' },
        { type: 'span', children: 'c' },
        { type: 'span', children: 'e' },
        { type: 'span', children: 'f' },
    ]
}
const newVNode = {
    type: 'div',
    children: [
        { type: 'span', children: 'g' },
        { type: 'span', children: 'h' },
        { type: 'span', children: 'i' },
        { type: 'span', children: 'j' },
        { type: 'span', children: 'k' },
    ]
}
```

假设现在有两份虚拟DOM节点（newVNode、oldVNode）分别代表新旧节点，我们现在按照`卸载旧节点，挂载新节点`的方法进行节点更新的话，步骤如下

- 卸载旧节点（5次删除DOM操作）
- 挂载新节点（5次创建DOM操作）

总共**10次的DOM操作**，但很快我们发现其实更新前后的子节点都是`span标签`，他们的差异仅在span标签的文本节点内容上，故我们可以直接更新这个文本节点的内容（1次DOM更新操作）就完成一个子节点的更新，总共需要更新的节点有5个，最终只需要进行**5次DOM更新操作**即可（提升一倍性能）

---

当然上述举例为简单情况是为了说明对节点更新过程进行针对性优化的必要性

而为了以最小的性能完成更新操作，需要比较计算两组子节点的差异，比较过程中我们采用的算法就叫作`Diff算法`

## Diff算法-基础原理

接下来我们一步一步构建对比子节点的方法`patchChildren`

由于新旧子节点均为数组，那么我们先对其进行数组元素数量差异上的讨论

- 新旧子节点数量一致

![20220918181433](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20220918181433.png)

- 旧子节点数量多于新子节点数量

![20220918181510](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20220918181510.png)

- 新子节点数量多于旧子节点数量

![20220918181557](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20220918181557.png)

通过上面三张图片我们可以知道，我们需要遍历长度较短的子节点数组并尽可能多地调用patch函数进行更新，然后再对比新旧节点的长度，新的子节点更长则**有新的子节点需要创建挂载**，旧的子节点则有**旧子节点需要卸载**

```javascript
const patchChildren = function (n1, n2, container) {
    if (typeof n2.children === 'string') {
        // sth
    } else if (Array.isArray(n2.children)) {
        const oldChildren = n1.children;
        const newChildren = n2.children;
        const oldLen = oldChildren.length;
        const newLen = newChildren.length;
        const commonLength = Math.min(oldLen, newLen);
        // 遍历更新｜新旧子节点的公共长度
        for (let i = 0; i < commonLength; i++) {
            patch(oldChildren[i], newChildren[i]);
        }
        if (newLen > oldLen) {
            // 若新子节点长度大于旧节点长度则创建并挂载新节点
            for (let i = commonLength; i < newLen; i++) {
                patch(null, newChildren[i], container);
            }
        } else if (newLen < oldLen) {
            // 若旧子节点长度大于新节点长度则创建并挂载新节点
            for (let i = commonLength; i < oldLen; i++) {
                unmount(oldChildren[i]);
            }
        }
    } else {
        // sth
    }
}
```

### key与DOM复用

假设有如下两新旧子节点数组

```javascript
const oldChildren = [
    { type: 'span' }, // index：0
    { type: 'div' },
    { type: 'a' },
]
const newChildren = [
    { type: 'div' },
    { type: 'a' },
    { type: 'span' }, // index：2
]
```

若我们仍然采取上面的方法进行子节点的更新则需要进行6次DOM操作，但是上面两组子节点元素只是在位置上存在差异，节点本身可以进行复用

如`oldChildren`下标index为0，对应的可复用节点在`newChildren`中下标index为2

在这里我们需要引入key的概念，参与过Vue项目开发的同学们对于`:key`应该都并不陌生

key的存在可以帮助我们快速确认`新子节点数组`中是否含有**可复用**的节点，即当前访问的旧子节点的key能否在新子节点数组中找到一个包含相等key的元素节点,若能则说明`当前访问的旧子节点对应的真实DOM`可进行复用

```javascript
const oldChildren = [
    { type: 'span', key: 1 }, // vnode
    { type: 'div', key: 2 }, // vnode
    { type: 'a', key: 3 }, // vnode
]
const newChildren = [
    { type: 'div', key: 2 }, // vnode
    { type: 'a', key: 3 }, // vnode
    { type: 'span', key: 1 }, // vnode
]
```

每个vnode对象在key的作用下便拥有的唯一标识，所有我们在进行Vue项目开发时必须保证`:key` 对应的数值是唯一的，否则便会导致性能下降

![20220918191219](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20220918191219.png)

![20220918191208](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20220918191208.png)


PS：节点可复用并不意味着完全不用更新节点中的内容，如下面的`vnode-1`节点，可以进行复用但仍然需要进行打补丁操作（更新文本节点内容hello->world）

```javascript
const oldChildren = [
    { type: 'span', key: 1, children: 'hello' }, // vnode-1
    { type: 'div', key: 2 }, // vnode
    { type: 'a', key: 3 }, // vnode
]
const newChildren = [
    { type: 'div', key: 2 }, // vnode
    { type: 'a', key: 3 }, // vnode
    { type: 'span', key: 1, children: 'world' }, // vnode-1
]
```

故我们可以对`patchChildren`方法进行优化

```javascript
const patchChildren = function (n1, n2, container) {
    if (typeof n2.children === 'string') {
        // sth
    } else if (Array.isArray(n2.children)) {
        const oldChildren = n1.children;
        const newChildren = n2.children;
        for (let i = 0; i < newChildren.length; i++) {
            const newVNode = newChildren[i];
            for (let curIndex = 0; curIndex < oldChildren.length; curIndex++) { // 到旧子节点数组中寻找可复用的节点
                const oldVNode = oldChildren[curIndex];
                // 找到可复用节点进行打补丁操作
                if (newVNode?.key === oldVNode?.key) {
                    patch(oldVNode, newVNode, container);
                    break;
                }
            }
        }
    } else {
        // sth
    }
}
```

经过上述代码逻辑处理后的**真实DOM元素仍然保持着原本的排列顺序**，因此我们还需要**通过移动节点来完成真实DOM顺序的更新**

这里的`移动节点`操作会有点小绕，见下图

<!-- ![20220924235748](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20220924235748.png) -->

![image-20220925165131369](https://cr-pic-1257999694.cos.ap-guangzhou.myqcloud.com/markdown/image-20220925165131369.png)

我们通过遍历每一个新子节点数组元素`新子节点A`时到旧子节点数组中寻找可复用的节点`旧子节点B`（key相同）

若能够找到可复用的旧节点B，则进行新旧节点的打补丁操作将新节点A更新的内容同步到可复用的真实DOM节点上

> `lastIndex`标记位：用于记录可复用节点的最大下标值

接着判断`旧子节点B`所在children数组的下标值是否小于`lastIndex`标记位

若是则取当前遍历`新子节点数组`过程中的上一个下标值对应的`真实DOM-C`引用，将经过打补丁后的新节点对应的真实DOM插入到`真实DOM-C`后面

```javascript
const patchChildren = function (n1, n2, container) {
    if (typeof n2.children === 'string') {
        // sth
    } else if (Array.isArray(n2.children)) {
        const oldChildren = n1.children;
        const newChildren = n2.children;

        let lastIndex = 0; // 
        for (let i = 0; i < newChildren.length; i++) {
            const newVNode = newChildren[i];
            
            for (let curIndex = 0; curIndex < oldChildren.length; curIndex++) {
                const oldVNode = oldChildren[curIndex];
                if (newVNode?.key === oldVNode?.key) {
                    patch(oldVNode, newVNode, container);
                    if (curIndex < lastIndex) {
                        // 若当前找到的节点在旧children中的索引小于最大索引值，则当前节点对应的dom需要移动
                        const preVNode = newChildren[i - 1];
                        if (preVNode) {
                            const anchor = preVNode.el.nextSibling; // 获取preVNode对应真实DOM的下一个兄弟节点并将其作为锚点
                            insert(newVNode.el, container, anchor); // 将经过打补丁后的新节点对应的真实DOM插入到前一个节点的后面
                        }
                    } else {
                        // 若当前找到的节点在旧children中的索引不小于最大索引值，更新lastIndex值
                        lastIndex = curIndex;
                    }
                }
            }
        }
    } else {
        // sth
    }
}

const renderer = createRenderer({
    insert(el, parent, anchor = null) {
        parent.insertBefore(el, anchor);
    }
    // ...
});
```

### 添加元素

![image-20220925174101355](https://cr-pic-1257999694.cos.ap-guangzhou.myqcloud.com/markdown/image-20220925174101355.png)

若新数组当中出现无法在旧子节点数组找到可复用节点的`节点A`，则需要创建一个新的真实DOM节点并将其挂载到父节点下


```javascript
const patchChildren = function (n1, n2, container) {
    if (typeof n2.children === 'string') {
        // sth
    } else if (Array.isArray(n2.children)) {
        const oldChildren = n1.children;
        const newChildren = n2.children;

        let lastIndex = 0;
        for (let i = 0; i < newChildren.length; i++) {
            const newVNode = newChildren[i];
            let canFindReuseNode = false; // change_1: 能否找到可复用节点
            for (let curIndex = 0; curIndex < oldChildren.length; curIndex++) {
                const oldVNode = oldChildren[curIndex];
                if (newVNode?.key === oldVNode?.key) {
                    canFindReuseNode = true; // change_2：找到可复用节点
                    patch(oldVNode, newVNode, container);
                    if (curIndex < lastIndex) {
                        const preVNode = newChildren[i - 1];
                        if (preVNode) {
                            const anchor = preVNode.el.nextSibling;
                            insert(newVNode.el, container, anchor);
                        }
                    } else {
                        lastIndex = curIndex;
                    }
                }
            }
            // change_3：canFindReuseNode == false则说明当前newVNode是新增节点，需要挂载
            if (!canFindReuseNode) {
                const preVNode = newChildren[i - 1];
                let anchor = null;
                if (preVNode) {
                    anchor = preVNode.el.nextSibling;
                } else {
                    anchor = container.firstChild;
                }
                patch(null, newVNode, container, anchor);
            }

        }
    } else {
        // sth
    }
}

const patch = function (n1, n2, container, anchor) {
    // some code
    const { type } = n2;
    if (typeof type === 'string') {
        // 没有n1
        if (!n1) {
            mountElement(n2, container, anchor); // 挂载新节点到锚点位置
        } else {
            patchElement(n1, n2);
        }
    } else if (type === Text) {
        // some code
    } else if (type === Fragment) {
        // some code
    }
}

const renderer = createRenderer({
    insert(el, parent, anchor = null) {
        parent.insertBefore(el, anchor);
    }
    // ...
});
```



### 移除元素

![image-20220925174115315](https://cr-pic-1257999694.cos.ap-guangzhou.myqcloud.com/markdown/image-20220925174115315.png)

若旧子节点数组元素A在新子节点数组中不存在了，则说明这个节点被删除了

那么具体怎么实现呢，思路比较简单

当第一轮遍历新子节点数组的更新逻辑结束后，遍历一次旧的子节点数组，遍历过程中去新的子节点数组中寻找具有相同key值的节点，若找不到则将当前旧子节点对应的真实DOM移除

```javascript
const patchChildren = function (n1, n2, container) {
    if (typeof n2.children === 'string') {
        // sth
    } else if (Array.isArray(n2.children)) {
        const oldChildren = n1.children;
        const newChildren = n2.children;

        let lastIndex = 0;
        for (let i = 0; i < newChildren.length; i++) {
            const newVNode = newChildren[i];
            let canFindReuseNode = false;
            for (let curIndex = 0; curIndex < oldChildren.length; curIndex++) {
                const oldVNode = oldChildren[curIndex];
                if (newVNode?.key === oldVNode?.key) {
                    canFindReuseNode = true;
                    patch(oldVNode, newVNode, container);
                    if (curIndex < lastIndex) {
                        const preVNode = newChildren[i - 1];
                        if (preVNode) {
                            const anchor = preVNode.el.nextSibling;
                            insert(newVNode.el, container, anchor);
                        }
                    } else {
                        lastIndex = curIndex;
                    }
                }
            }
            if (!canFindReuseNode) {
                const preVNode = newChildren[i - 1];
                let anchor = null;
                if (preVNode) {
                    anchor = preVNode.el.nextSibling;
                } else {
                    anchor = container.firstChild;
                }
                patch(null, newVNode, container, anchor);
            }
        }
        // change_1：遍历旧子节点数组
        for (let i = 0; i < oldChildren.length; i++) {
            const oldVNode = oldChildren[i];
            const canFind = newChildren.find((vnode => vnode.key === oldVNode.key));
            if (!canFind) {
                unmount(oldVNode); // 卸载找不到对应新节点的旧节点
            }
        }

    } else {
        // sth
    }
}
```

## Diff算法-双端

以上我们已经明白了Diff算法的基础实现思路，那么接下来我们继续对其进行优化

我们先来看一种情况

![image-20220925200339034](https://cr-pic-1257999694.cos.ap-guangzhou.myqcloud.com/markdown/image-20220925200339034.png)

按照上面我们所学习到的Diff算法逻辑处理这个例子时，需要进行**两次的真实DOM节点移动**，分别是

- `span-1`对应的真实DOM移动到`span-3`对应的真实DOM后面
- `span-2`对应的真实DOM移动到`span-1`对应的真实DOM后面

但其实只要我们细看就能发现，我们只需要将`span-3`对应的真实DOM移动到`span-1`对应真实DOM前面即可达到更新目的

`双端DIFF算法`就是为了解决这类问题而产生

### 实现原理

双端Diff算法：同时对新旧两组子节点的两个端点进行比较的算法，实现过程中我们需要四个索引值分别指向新旧两组子节点的首尾节点

我们开始对代码进行修改

```javascript

const patchKeyedChildren = function (n1, n2, container) {
    const oldChildren = n1.children;
    const newChildren = n2.children;
    // 四个索引值
    let oldStartIdx = 0;
    let oldEndIdx = oldChildren.length - 1;
    let newStartIdx = 0;
    let newEndIdx = newChildren.length - 1;

    let oldStartVNode = oldChildren[oldStartIdx];
    let oldEndIdx = oldChildren[oldEndIdx];
    let newStartIdx = newChildren[newStartIdx];
    let newEndIdx = newChildren[newEndIdx];
}

const patchChildren = function (n1, n2, container) {
    if (typeof n2.children === 'string') {
        // sth
    } else if (Array.isArray(n2.children)) {
        // 封装 patchKeyedChildren 函数处理两组子节点的比较更新
        patchKeyedChildren(n1, n2, container);
    } else {
        // sth
    }
}

```

准备好了四个索引变量以及对应的VNode变量我们便可以开始进行`双端比较`

![image-20220925202912881](https://cr-pic-1257999694.cos.ap-guangzhou.myqcloud.com/markdown/image-20220925202912881.png)

- `旧子节点数组第一个节点span-1` 与 `新子节点第一个节点span-4`比较，key不同
- `旧子节点数组最后一个节点span-4` 与 `新子节点最后一个节点span-3`比较，key不同
- `旧子节点数组第一个节点span-1` 与 `新子节点最后一个节点span-3`比较，key不同
- `旧子节点数组最后一个节点span-4` 与 `新子节点第一个节点span-4`比较，key相同，可以执行复用更新逻辑

节点span-4更新之后对应的真实DOM为第一个DOM节点，故更新逻辑为：将索引oldEndIdx标记的虚拟节点对应的真实DOM移动到索引oldStartIdx指向的虚拟节点对应的真实DOM前面


```javascript

const patchKeyedChildren = function (n1, n2, container) {
    const oldChildren = n1.children;
    const newChildren = n2.children;
    // 四个索引值
    let oldStartIdx = 0;
    let oldEndIdx = oldChildren.length - 1;
    let newStartIdx = 0;
    let newEndIdx = newChildren.length - 1;
    // 四个VNode节点
    let oldStartVNode = oldChildren[oldStartIdx];
    let oldEndVNode = oldChildren[oldEndIdx];
    let newStartVNode = newChildren[newStartIdx];
    let newEndVNode = newChildren[newEndIdx];

    if (oldStartVNode.key === newStartVNode.key) {
        // some code
    } else if (oldEndVNode.key === newEndVNode.key) {
        // some code
    } else if (oldStartVNode.key === newEndVNode.key) {
        // some code
    } else if (oldEndVNode.key === newStartVNode.key) {
        // 上述例子进入当前逻辑分支
        patch(oldEndVNode, newStartVNode, container); // 更新打补丁
        insert(oldEndVNode.el, container, oldStartVNode.el); // 将oldEndVNode.el移动到oldStartVNode.el前面
        oldEndVNode = oldChildren[--oldEndIdx];
        newStartVNode = newChildren[++newStartIdx];
    }
}

const patchChildren = function (n1, n2, container) {
    if (typeof n2.children === 'string') {
        // sth
    } else if (Array.isArray(n2.children)) {
        // 封装 patchKeyedChildren 函数处理两组子节点的比较更新
        patchKeyedChildren(n1, n2, container);
    } else {
        // sth
    }
}

```


![image-20220925212018913](https://cr-pic-1257999694.cos.ap-guangzhou.myqcloud.com/markdown/image-20220925212018913.png)


每一轮更新完成后四个索引值的其中两个总会发生变更

而因为双端对比一次只能够移动一次节点，并不能保证其结果就是最终的预期结果

故我们需要加一个`while`不断进行双端对比更新，直到索引的相对顺序发生了改变

```javascript

const patchKeyedChildren = function (n1, n2, container) {
    const oldChildren = n1.children;
    const newChildren = n2.children;
    // 四个索引值
    let oldStartIdx = 0;
    let oldEndIdx = oldChildren.length - 1;
    let newStartIdx = 0;
    let newEndIdx = newChildren.length - 1;
    // 四个VNode节点
    let oldStartVNode = oldChildren[oldStartIdx];
    let oldEndVNode = oldChildren[oldEndIdx];
    let newStartVNode = newChildren[newStartIdx];
    let newEndVNode = newChildren[newEndIdx];

    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) { // change_1：多轮双端比较更新
        if (oldStartVNode.key === newStartVNode.key) {
            // some code
        } else if (oldEndVNode.key === newEndVNode.key) {
            // some code
        } else if (oldStartVNode.key === newEndVNode.key) {
            // some code
        } else if (oldEndVNode.key === newStartVNode.key) {
            // 上述例子进入当前逻辑分支
            patch(oldEndVNode, newStartVNode, container); // 更新打补丁
            insert(oldEndVNode.el, container, oldStartVNode.el); // 将oldEndVNode.el移动到oldStartVNode.el前面
            oldEndVNode = oldChildren[--oldEndIdx];
            newStartVNode = newChildren[++newStartIdx];
        }
    }
}

const patchChildren = function (n1, n2, container) {
    if (typeof n2.children === 'string') {
        // sth
    } else if (Array.isArray(n2.children)) {
        // 封装 patchKeyedChildren 函数处理两组子节点的比较更新
        patchKeyedChildren(n1, n2, container);
    } else {
        // sth
    }
}
```

理解了上面的实现后我们便能轻松补全另外三个逻辑分支的代码

```javascript

const patchKeyedChildren = function (n1, n2, container) {
    const oldChildren = n1.children;
    const newChildren = n2.children;
    // 四个索引值
    let oldStartIdx = 0;
    let oldEndIdx = oldChildren.length - 1;
    let newStartIdx = 0;
    let newEndIdx = newChildren.length - 1;
    // 四个VNode节点
    let oldStartVNode = oldChildren[oldStartIdx];
    let oldEndVNode = oldChildren[oldEndIdx];
    let newStartVNode = newChildren[newStartIdx];
    let newEndVNode = newChildren[newEndIdx];

    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
        if (oldStartVNode.key === newStartVNode.key) {
            patch(oldStartVNode, newStartVNode, container);
            oldStartVNode = oldChildren[++oldStartIdx];
            newStartVNode = newChildren[++newStartIdx];
        } else if (oldEndVNode.key === newEndVNode.key) {
            patch(oldEndVNode, newEndVNode, container);
            oldEndVNode = oldChildren[--oldEndIdx];
            newEndVNode = newChildren[--newEndIdx];
        } else if (oldStartVNode.key === newEndVNode.key) {
            patch(oldStartVNode, newEndVNode, container);
            insert(oldStartVNode.el, container, oldEndVNode.el.nextSibling);
            oldStartVNode = oldChildren[++oldStartIdx];
            newEndVNode = newChildren[--newEndIdx];
        } else if (oldEndVNode.key === newStartVNode.key) {
            patch(oldEndVNode, newStartVNode, container);
            insert(oldEndVNode.el, container, oldStartVNode.el);
            oldEndVNode = oldChildren[--oldEndIdx];
            newStartVNode = newChildren[++newStartIdx];
        }
    }
}

const patchChildren = function (n1, n2, container) {
    if (typeof n2.children === 'string') {
        // sth
    } else if (Array.isArray(n2.children)) {
        // 封装 patchKeyedChildren 函数处理两组子节点的比较更新
        patchKeyedChildren(n1, n2, container);
    } else {
        // sth
    }
}
```

到这里我们已经有了一个Diff算法的基本实现，但很快我们又会发现这里存在问题

如果进行了四次索引之间的key比较发现都不相等，则需要退化到非双端Diff算法的实现

以newStartIdx、newStartVNode为基点，遍历旧子节点数组中找可复用节点

- 若找到复用节点则进行打补丁更新并调整顺序
- 若没找到则newStartVNode作为新的节点挂载到头部节点前面（oldStartVNode.el为锚点）


```javascript

const patchKeyedChildren = function (n1, n2, container) {
    const oldChildren = n1.children;
    const newChildren = n2.children;
    // 四个索引值
    let oldStartIdx = 0;
    let oldEndIdx = oldChildren.length - 1;
    let newStartIdx = 0;
    let newEndIdx = newChildren.length - 1;
    // 四个VNode节点
    let oldStartVNode = oldChildren[oldStartIdx];
    let oldEndVNode = oldChildren[oldEndIdx];
    let newStartVNode = newChildren[newStartIdx];
    let newEndVNode = newChildren[newEndIdx];

    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
        if (oldStartVNode.key === newStartVNode.key) {
            patch(oldStartVNode, newStartVNode, container);
            oldStartVNode = oldChildren[++oldStartIdx];
            newStartVNode = newChildren[++newStartIdx];
        } else if (oldEndVNode.key === newEndVNode.key) {
            patch(oldEndVNode, newEndVNode, container);
            oldEndVNode = oldChildren[--oldEndIdx];
            newEndVNode = newChildren[--newEndIdx];
        } else if (oldStartVNode.key === newEndVNode.key) {
            patch(oldStartVNode, newEndVNode, container);
            insert(oldStartVNode.el, container, oldEndVNode.el.nextSibling);
            oldStartVNode = oldChildren[++oldStartIdx];
            newEndVNode = newChildren[--newEndIdx];
        } else if (oldEndVNode.key === newStartVNode.key) {
            patch(oldEndVNode, newStartVNode, container);
            insert(oldEndVNode.el, container, oldStartVNode.el);
            oldEndVNode = oldChildren[--oldEndIdx];
            newStartVNode = newChildren[++newStartIdx];
        } else {
            // change_1：处理未匹配情况
            const oldIdx = oldChildren.findIndex((node) => node.key === newStartVNode.key);
            if (oldIdx > 0) {
                const vnodeToMove = oldChildren[oldIdx];
                patch(vnodeToMove, newStartVNode, container);
                insert(vnodeToMove.el, container, oldStartVNode.el);
                oldChildren[oldIdx] = undefined;
            } else {
                patch(null, newStartVNode, container, oldStartVNode.el);
            }
            newStartVNode = newChildren[++newStartIdx];
        }
    }
}

const patchChildren = function (n1, n2, container) {
    if (typeof n2.children === 'string') {
        // sth
    } else if (Array.isArray(n2.children)) {
        // 封装 patchKeyedChildren 函数处理两组子节点的比较更新
        patchKeyedChildren(n1, n2, container);
    } else {
        // sth
    }
}
```

### 遗漏处理-新增节点

咋一看，似乎我们已经处理好所有的比较情况，但这里仍然存在缺陷

![20220926105659](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20220926105659.png)

用当前已经编写好的代码逻辑处理图中的新旧子数组，无法得到最终正确的真实DOM节点状态

读者可以根据上面这张图，自行思考一下这是为什么

（自行模拟过程完成后往下看）

---

经过自行思考模拟后会发现此处循环遍历结束后，新子节点数组中存在被遗漏的节点没有如何处理

```javascript
 while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
    // some code
 }
 if (oldEndIdx < oldStartIdx && newStartIdx <= newEndIdx) {
    // change_1: 遍历处理遗漏未处理的新增节点
    for (let i = newStartIdx; i <= newEndIdx; i++) {
        patch(null, newChildren[i], container, oldStartVNode.el);
    }
 }
```

### 遗漏处理-移除节点

既然新子节点数组中存在被遗漏的节点，那么我们自然会想旧节点数组中是否也存在同样的情况呢

![20220926142424](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20220926142424.png)

模拟过程后可以发现，在双端比较更新结束后，旧子节点数组中存在未被处理的元素，即存在待卸载的真实DOM节点

如下图所示

![20220926143137](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20220926143137.png)

```javascript
 while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
    // some code
 }
 if (oldEndIdx < oldStartIdx && newStartIdx <= newEndIdx) {
    // 遍历处理遗漏未处理的新增节点
    for (let i = newStartIdx; i <= newEndIdx; i++) {
        patch(null, newChildren[i], container, oldStartVNode.el);
    }
 } else if (newEndIdx < newStartIdx && oldStartIdx <= oldEndIdx) {
    // change_1: 遍历未处理的待卸载节点
    for (let i = oldStartIdx; i <= oldEndIdx; i++) {
        unmount(oldChildren[i]);
    }
 }
```


## 双端Diif算法代码

```javascript

const patchKeyedChildren = function (n1, n2, container) {
    const oldChildren = n1.children;
    const newChildren = n2.children;
    // 四个索引值
    let oldStartIdx = 0;
    let oldEndIdx = oldChildren.length - 1;
    let newStartIdx = 0;
    let newEndIdx = newChildren.length - 1;
    // 四个VNode节点
    let oldStartVNode = oldChildren[oldStartIdx];
    let oldEndVNode = oldChildren[oldEndIdx];
    let newStartVNode = newChildren[newStartIdx];
    let newEndVNode = newChildren[newEndIdx];

    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
        if (oldStartVNode.key === newStartVNode.key) {
            patch(oldStartVNode, newStartVNode, container);
            oldStartVNode = oldChildren[++oldStartIdx];
            newStartVNode = newChildren[++newStartIdx];
        } else if (oldEndVNode.key === newEndVNode.key) {
            patch(oldEndVNode, newEndVNode, container);
            oldEndVNode = oldChildren[--oldEndIdx];
            newEndVNode = newChildren[--newEndIdx];
        } else if (oldStartVNode.key === newEndVNode.key) {
            patch(oldStartVNode, newEndVNode, container);
            insert(oldStartVNode.el, container, oldEndVNode.el.nextSibling);
            oldStartVNode = oldChildren[++oldStartIdx];
            newEndVNode = newChildren[--newEndIdx];
        } else if (oldEndVNode.key === newStartVNode.key) {
            patch(oldEndVNode, newStartVNode, container);
            insert(oldEndVNode.el, container, oldStartVNode.el);
            oldEndVNode = oldChildren[--oldEndIdx];
            newStartVNode = newChildren[++newStartIdx];
        } else {
            const oldIdx = oldChildren.findIndex((node) => node.key === newStartVNode.key);
            if (oldIdx > 0) {
                const vnodeToMove = oldChildren[oldIdx];
                patch(vnodeToMove, newStartVNode, container);
                insert(vnodeToMove.el, container, oldStartVNode.el);
                oldChildren[oldIdx] = undefined;
            } else {
                patch(null, newStartVNode, container, oldStartVNode.el);
            }
            newStartVNode = newChildren[++newStartIdx];
        }
    }
    if (oldEndIdx < oldStartIdx && newStartIdx <= newEndIdx) {
        for (let i = newStartIdx; i <= newEndIdx; i++) {
            patch(null, newChildren[i], container, oldStartVNode.el);
        }
    } else if (newEndIdx < newStartIdx && oldStartIdx <= oldEndIdx) {
        for (let i = oldStartIdx; i <= oldEndIdx; i++) {
            unmount(oldChildren[i]);
        }
    }
}

const patchChildren = function (n1, n2, container) {
    if (typeof n2.children === 'string') {
        // sth
    } else if (Array.isArray(n2.children)) {
        // 封装 patchKeyedChildren 函数处理两组子节点的比较更新
        patchKeyedChildren(n1, n2, container);
    } else {
        // sth
    }
}
```

## 小结

本节文章我们补充学习了`手写Vue3 | 渲染器`当中patchChildren方法的具体实现Diff算法思路

从一开始我们开始研究更新新旧两节点的子节点数组最简单的方法便是<u>直接遍历旧的子节点数组卸载旧的真实DOM节点，然后遍历新的子节点数组创建挂载新的DOM节点</u>

但是这会导致大量的DOM操作，而我们都知道DOM操作会损耗较大的性能，所以我们需要尽可能对现存的真实DOM节点进行复用以减少性能消耗

复用的前提是节点包含一个唯一标识`key`在遍历新子节点数组每一个元素时，去旧子节点数组寻找是否存在可以复用的旧子节点（可复用对应的真实DOM），若存在则可以通过打补丁更新、移动真实DOM位置后达到预期更新结果（可复用不代表不需要更新）

实现了DOM节点复用后，我们还要考虑如何优化移动可复用节点的流程，故我们学习了双端Diff算法，通过在遍历过程中对四个索引值所指向的`vnode`的进行比较，以优化节点移动的性能

最后我们也通过cover一些遗漏情况来完善了代码

## 讲到最后

大家通过上述内容，能够掌握Diff算法的核心思路，我们能够借助这种思路处理对比数组差异化更新的相关需求场景，进一步可扩展到对复杂树的Diff，但需要根据实际业务需要进行调整

由于本节内容较长，故不能将`快速Diff`内容放在当前文章当中，若后续有更新将同步提供传送门在此处

谢谢大家，我们下节再见！！！

> 感谢各位看到这里，如果你觉得本节内容还不错的话，欢迎各位的**点赞、收藏、评论**，大家的支持是我做内容的最大动力

> 本文为作者原创，欢迎转载，但未经作者同意必须保留此段声明，且在文章页面明显位置给出原文链接，否则保留追究法律责任的权利

## 补充-Vue3传送门链接

[Vue3文档](https://cn.vuejs.org/)

[Vue3仓库](https://github.com/vuejs/core)





