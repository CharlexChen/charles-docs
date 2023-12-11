<!--
 * @Author: charlexchen charlexchen@tencent.com
 * @Date: 2022-09-30 10:15:58
 * @LastEditors: charlexchen charlexchen@tencent.com
 * @LastEditTime: 2022-09-30 18:51:23
 * @FilePath: /frontend_study_charles/publish-article/vue3Diff算法-进阶.md
 * @Description: Diff算法-进阶
 * 
-->
# [陈同学i前端] 手写Vue3 | Diff算法-进阶

## 前言

大家好，我是陈同学，一枚野生前端开发者，感谢各位的点赞、收藏、评论

上一章节文章【Diff算法-基础】中我们学习了Vue3的Diff算法的基础概念与知识，接下来我们将继续上一节内容的学习，通过本篇文章你能掌握快速Diff算法，实现Vue3新旧子节点比较更新

> 若尚未阅读上一章节的【Diff算法-基础】滴同学，请点击此处[传送门](https://juejin.cn/post/7147586445266386958)

本文阅读成本与收益如下：

阅读耗时：`15mins`

全文字数：`10k+`

## 预期效益

- 比双端Diff更快的快速Diff算法核心实现，实现新旧子节点数组比较更新

## 快速Diff-补充知识

### 最长递增子序列

> 参考题目：https://leetcode.cn/problems/longest-increasing-subsequence/

给你一个整数数组`nums`，找到其中最长递增子序列的长度

子序列：是由数组派生而来的序列，删除（或不删除）数组中的元素而不改变其余元素的顺序

如: [4,3,10,6,7]是数组[4,3,10,6,2,1,7]的子序列

最长递增子序列：在一个给定的数值序列中，找到一个子序列，使得这个子序列元素的数值依次递增，并且这个子序列的长度尽可能地大。最长递增子序列中的元素在原序列中不一定是连续的

如: [4,5,6,7]（或[3,5,6,7]）是数组[4,3,5,6,2,1,7]的最长递增子序列

## 快速Diif算法

快速Diff：参考ivi与inferno库中虚拟节点的快速Diff的实现，被Vue3开发者用于替换双端Diff的新Diff算法

Diff算法的本质是找出新旧两组节点数组的不同并进行节点的移动与更新，而快速Diff算法能够在一定程度上弥补双端Diff算法在性能上的不足，Diff效率更高

与双端Diff进行比较的话，快速Diff多了节点的预处理流程以及在寻找需要移动位置的节点时的优化逻辑

当然这中间涉及到`最长递增子序列`，阅读本文前建议先了解一下

### 实现流程

快速Diff算法实现主要分为五个步骤

- 预处理：分别从前后遍历新旧子节点数组，处理新旧子节点数组相同的前置后置节点，尽可能地减少后续流程的Diff遍历次数
- 分情况处理预处理后的子节点数组
    - （理想情况）预处理已完全处理旧子节点数组，则遍历并挂载新子节点数组元素
    - （理想情况）预处理已完全处理新子节点数组，则遍历并卸载旧子节点数组元素
    - （非理想情况）进入下一环节
- 节点移动判断：寻找新旧子节点数组的需要移动的节点
- 节点移动：借助节点移动判断流程中产生的辅助变量进行节点的快速移动


### 前置后置预处理

分别从前后遍历新旧子节点数组，若发现当前遍历到的两节点`key`相同则直接进行`patch`更新，此两节点无需参与后续的Diff流程

![20220930150141](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20220930150141.png)

```javascript
const quickDiff = function (oldChildren, newChildren, container) {
    let curInd = 0;
    let newEnd = newChildren.length - 1;
    let oldEnd = oldChildren.length - 1;
    // 遍历处理新旧子节点数组前置节点
    while (newChildren[curInd].key === oldChildren[curInd].key) {
        patch(oldChildren[curInd], newChildren[curInd], container);
        curInd++;
    }
    // 遍历处理新旧子节点数组后置节点
    while (newChildren[newEnd].key === oldChildren[oldEnd].key) {
        patch(oldChildren[oldEnd], newChildren[newEnd], container);
        newEnd--;
        oldEnd--;
    }
    // some code
}
```

### 理想情况处理

- 预处理已完全处理旧子节点数组，尚有新子节点数组元素未处理

![20220930144834](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20220930144834.png)

```javascript
const quickDiff = function (oldChildren, newChildren, container) {
    let curInd = 0;
    let newEnd = newChildren.length - 1;
    let oldEnd = oldChildren.length - 1;
    // 遍历处理新旧子节点数组前置节点
    while (newChildren[curInd].key === oldChildren[curInd].key) {
        // some code
    }
    // 遍历处理新旧子节点数组后置节点
    while (newChildren[newEnd].key === oldChildren[oldEnd].key) {
        // some code
    }
    if (newEnd < curInd && oldEnd >= curInd) { // change_1
        // 预处理环节已经将新子节点数组完全处理，现遍历卸载旧子节点数组元素
        for (let i = curInd; i <= oldEnd; i++) {
            unmount(oldChildren[i]);
        }
    }
    // some code
}
```

- 预处理已完全处理新子节点数组，尚有旧子节点数组元素未处理

![20220930144759](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20220930144759.png)

```javascript
const quickDiff = function (oldChildren, newChildren, container) {
    let curInd = 0;
    let newEnd = newChildren.length - 1;
    let oldEnd = oldChildren.length - 1;
    // 遍历处理新旧子节点数组前置节点
    while (newChildren[curInd].key === oldChildren[curInd].key) {
        // some code
    }
    // 遍历处理新旧子节点数组后置节点
    while (newChildren[newEnd].key === oldChildren[oldEnd].key) {
        // some code
    }
    if (newEnd < curInd && oldEnd >= curInd) {
        // 预处理环节已经将新子节点数组完全处理，现遍历卸载旧子节点数组元素
        for (let i = curInd; i <= oldEnd; i++) {
            unmount(oldChildren[i]);
        }
    } else if (newEnd >= curInd && oldEnd < curInd) { // change_1
        // 预处理环节已经将旧子节点数组完全处理，现遍历挂载新子节点数组元素
        let anchorIndex = newEnd + 1;
        let anchor = anchorIndex < newChildren.length ? newChildren[anchorIndex].el : null;
        for (let i = curInd; i <= newEnd; i++) {
            patch(null, newChildren[i], container, anchor);
        }
    }
    // some code
}
```

### 非理想情况

若新旧子节点数组均未被处理完成，则我们需要在两数组中

- 对存在复用关系的节点进行打补丁更新并判断是否需要移动
- 对于没有找到复用关系的旧节点需要进行真实DOM卸载
- 对于没有找到复用关系的新节点需要进行真实DOM挂载

这一步骤与简单Diff算法当中有类似的地方

比如在遍历新子节点数组的过程中我们需要到旧子节点数组中寻找可复用的节点（key相等），时间复杂度为`O(n*m)`

此处我们也需要有这一流程，但为了降低时间复杂度，我们定义了一个`newChildrenKeyIndex`map，用于存储新子节点数组每一个元素的key与下标index的映射关系，最终将寻找可复用节点的复杂度降低到了`O(n)`

![20220930154634](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20220930154634.png)

```javascript
const quickDiff = function (oldChildren, newChildren, container) {
    let curInd = 0;
    let newEnd = newChildren.length - 1;
    let oldEnd = oldChildren.length - 1;
    while (newChildren[curInd].key === oldChildren[curInd].key) {
        // some code
    }
    while (newChildren[newEnd].key === oldChildren[oldEnd].key) {
        // some code
    }
    if (newEnd < curInd && oldEnd >= curInd) {
        // some code
    } else if (newEnd >= curInd && oldEnd < curInd) {
        // some code
    } else { // change_1:非理想情况处理
        let newChildrenKeyIndex = {}; // 用于存储新子节点数组的key-index键值对
        // 收集新子节点数组中的key-index
        for (let i = 0; i < newChildren.length; i++) {
            newChildrenKeyIndex[newChildren[i].key] = i;
        }
        // 遍历旧子节点数组，找到可复用节点进行打补丁更新，否则卸载旧节点对应的真实DOM
        for (let i = 0; i < oldChildren.length; i++) {
            let oldNode = oldChildren[i];
            let k = newChildrenKeyIndex[oldNode.key];
            if (typeof k !== 'undefined') {
                let newNode = newChildren[k];
                patch(oldNode, newNode, container);
            } else {
                unmount(oldNode);
            }
        }
    }
    // some code
}
```

以上我们实现了基于key标识位寻找可复用节点进行更新的逻辑，并进一步优化了时间复杂度

现在我们继续看看如何判断是否需要移动节点，并找到需要移动的节点进行DOM的移动

这里引入一个新的数组`source`以及几个辅助变量`move`、`handleCount`、`oldStart`、`newStart`、`patched`、`pos`

数组`source`: 用于存储新节点对应的可复用旧节点在旧子节点数组中的下标值

![20220930155304](https://charlex-1307761018.cos.ap-guangzhou.myqcloud.com/image/20220930155304.png)

```javascript
const quickDiff = function (oldChildren, newChildren, container) {
    let curInd = 0;
    let newEnd = newChildren.length - 1;
    let oldEnd = oldChildren.length - 1;
    while (newChildren[curInd].key === oldChildren[curInd].key) {
        // some code
    }
    while (newChildren[newEnd].key === oldChildren[oldEnd].key) {
        // some code
    }
    if (newEnd < curInd && oldEnd >= curInd) {
        // some code
    } else if (newEnd >= curInd && oldEnd < curInd) {
        // some code
    } else {
        let move = false; // 标记位：是否需要移动节点
        const handleCount = newEnd - curInd + 1; // 新子节点数组中未处理的节点数量
        const source = new Array(handleCount).fill(-1); // 用于保存新节点对应的可复用旧节点在旧子节点数组中的下标值
        const oldStart = curInd; // 旧子节点数组开始下标
        const newStart = curInd; // 新子节点数组开始下标

        let patched = 0; // 记录已经匹配的节点数量
        let pos = 0; // 当前遍历过程最大下标，有点类似lastIndex
        let newChildrenKeyIndex = {}; // 用于存储新子节点数组的key-index键值对
        // 收集新子节点数组中的key-index
        for (let i = 0; i < newChildren.length; i++) {
            newChildrenKeyIndex[newChildren[i].key] = i;
        }
        // 遍历旧子节点数组，找到可复用节点进行打补丁更新，否则卸载旧节点对应的真实DOM
        for (let i = 0; i < oldChildren.length; i++) {
            let oldNode = oldChildren[i];
            if (patched < handleCount) {
                let k = newChildrenKeyIndex[oldNode.key];
                if (typeof k !== 'undefined') {
                    let newNode = newChildren[k];
                    patch(oldNode, newNode, container);
                    patched++; // 统计已处理节点数量
                    source[k - newStart] = i; // 保存对应的可复用旧节点在旧子节点数组中的下标值
                    if (k < pos) { // 下标小于pos说明有节点需要移动，移动逻辑后续补充
                        move = true;
                    } else {
                        pos = k;
                    }
                } else {
                    unmount(oldNode);
                }
            } else {
                // 如果当前已处理节点数已经达到新子节点数组未处理节点数量，则说明旧子节点数组中未处理节点均需要进行节点卸载操作
                unmount(oldNode);
            }
        }
    }
    // some code
}
```

写到这里已经快完成了快速Diff算法的实现，但聪明的你肯定也已经发现，我们还没有写关于移动节点的逻辑，目前可以通过`move`变量判断是否有需要移动的节点

回顾文章开头提到的`最长递增子序列`的算法也还没有得到应用，没错，接下来我们将在移动节点的逻辑当中使用算法

### 节点移动

在进行节点移动的过程中我们需要用到上文中的`source`数组所保存的新节点对应的可复用旧节点在旧子节点数组中下标

```javascript
const quickDiff = function (oldChildren, newChildren, container) {
    let curInd = 0;
    let newEnd = newChildren.length - 1;
    let oldEnd = oldChildren.length - 1;
    while (newChildren[curInd].key === oldChildren[curInd].key) {
        // some code
    }
    while (newChildren[newEnd].key === oldChildren[oldEnd].key) {
        // some code
    }
    if (newEnd < curInd && oldEnd >= curInd) {
        // some code
    } else if (newEnd >= curInd && oldEnd < curInd) {
        // some code
    } else {
        // some code
    }
    if (move) { // change_1: 存在需要移动的节点
        let lisList = handleLIS(source); // 获取最大递增子序列
        let lisListEnd = lisList.length - 1;
        for (let i = handleCount - 1; i >= 0; i--) {
            if (source[i] == -1) { // 旧子节点数组中不存在可复用的节点，直接挂载新的DOM节点
                const pos = i + newStart;
                const newVNode = newChildren[pos];
                const nextPos = pos + 1;
                const anchor = nextPos < newChildren.length ? newChildren[nextPos] : null;
                patch(null, newVNode, container, anchor);
            } else if (i !== lisList[lisListEnd]) { // 最大递增子序列数组的最后一项不等于当前i
                const pos = i + newStart;
                const newVNode = newChildren[pos];
                const nextPos = pos + 1;
                const anchor = nextPos < newChildren.length ? newChildren[nextPos] : null;
                insert(newVNode, container, anchor);
            } else {
                lisListEnd--;
            }
        }
    }
}
```

## 完整代码

```javascript
const quickDiff = function (oldChildren, newChildren, container) {
    let curInd = 0;
    let newEnd = newChildren.length - 1;
    let oldEnd = oldChildren.length - 1;
    // 遍历处理新旧子节点数组前置节点
    while (newChildren[curInd].key === oldChildren[curInd].key) {
        patch(oldChildren[curInd], newChildren[curInd], container);
        curInd++;
    }
    // 遍历处理新旧子节点数组后置节点
    while (newChildren[newEnd].key === oldChildren[oldEnd].key) {
        patch(oldChildren[oldEnd], newChildren[newEnd], container);
        newEnd--;
        oldEnd--;
    }
    if (newEnd < curInd && oldEnd >= curInd) {
        // 预处理环节已经将新子节点数组完全处理，现遍历卸载旧子节点数组元素
        for (let i = curInd; i <= oldEnd; i++) {
            unmount(oldChildren[i]);
        }
    } else if (newEnd >= curInd && oldEnd < curInd) {
        // 预处理环节已经将旧子节点数组完全处理，现遍历挂载新子节点数组元素
        let anchorIndex = newEnd + 1;
        let anchor = anchorIndex < newChildren.length ? newChildren[anchorIndex].el : null;
        for (let i = curInd; i <= newEnd; i++) {
            patch(null, newChildren[i], container, anchor);
        }
    } else {
        let move = false; // 标记位：是否需要移动节点
        const handleCount = newEnd - curInd + 1;
        const source = new Array(handleCount).fill(-1);
        const oldStart = curInd;
        const newStart = curInd;

        let patched = 0; // 记录已经匹配的节点数量
        let pos = 0; // 当前遍历过程最大下标，有点类似lastIndex
        let newChildrenKeyIndex = {}; // 用于存储新子节点数组的key-index键值对
        // 收集新子节点数组中的key-index
        for (let i = 0; i < newChildren.length; i++) {
            newChildrenKeyIndex[newChildren[i].key] = i;
        }
        // 根据newChildrenKeyIndex在旧子节点数组遍历过程中寻找可复用节点，若未找到则卸载当前旧子节点，否则记录该旧子节点信息并按实际情况更新pos、move、patched、source
        for (let i = 0; i < oldChildren.length; i++) {
            let oldNode = oldChildren[i];
            if (patched < handleCount) {
                let k = newChildrenKeyIndex[oldNode.key];
                if (typeof k !== 'undefined') {
                    let newNode = newChildren[k];
                    patch(oldNode, newNode, container);
                    patched++;
                    source[k - newStart] = i;
                    if (k < pos) {
                        move = true;
                    } else {
                        pos = k;
                    }
                } else {
                    unmount(oldNode);
                }
            } else {
                unmount(oldNode);
            }
        }
        if (move) {
            let lisList = handleLIS(source); // 获取最大递增子序列
            let lisListEnd = lisList.length - 1;
            for (let i = handleCount - 1; i >= 0; i--) {
                if (source[i] == -1) { // 旧子节点数组中不存在可复用的节点，直接挂载新的DOM节点
                    const pos = i + newStart;
                    const newVNode = newChildren[pos];
                    const nextPos = pos + 1;
                    const anchor = nextPos < newChildren.length ? newChildren[nextPos] : null;
                    patch(null, newVNode, container, anchor);
                } else if (i !== lisList[lisListEnd]) { // 最大递增子序列数组的最后一项不等于当前i
                    const pos = i + newStart;
                    const newVNode = newChildren[pos];
                    const nextPos = pos + 1;
                    const anchor = nextPos < newChildren.length ? newChildren[nextPos] : null;
                    insert(newVNode, container, anchor);
                } else {
                    lisListEnd--;
                }
            }
        }
    }
}
```

## 讲到最后

快速Diff算法本质上也是比较更新两个数组节点

但在逻辑处理中进行了细节上的优化，巧妙的运用了辅助的标识位变量与数组进一步提高算法的综合性能

算法本身的思路不难理解，读者在阅读过程中需要将每一行代码的含义理解透彻

若此前没有算法基础则需要补上`最长递增子序列`的算法知识

谢谢大家，我们下节再见！！！

> 感谢各位看到这里，如果你觉得本节内容还不错的话，欢迎各位的**点赞、收藏、评论**，大家的支持是我做内容的最大动力

> 本文为作者原创，欢迎转载，但未经作者同意必须保留此段声明，且在文章页面明显位置给出原文链接，否则保留追究法律责任的权利

## 补充-Vue3传送门链接

[Vue3文档](https://cn.vuejs.org/)

[Vue3仓库](https://github.com/vuejs/core)

