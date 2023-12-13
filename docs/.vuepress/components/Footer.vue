<template>
  <transition>
    <div class="footer" v-if="showFooter">
      <a href="https://beian.miit.gov.cn/" target="_blank">粤ICP备2021155152号-1</a>
      <span class="content" style="display: block; width: 100%;line-height: 22px;">
        @2023 Charles
      </span>
    </div>
  </transition>
</template>

<script>
export default {
  data() {
    return {
      showFooter: true,
    }
  },
  mounted() {
    this.onEvent = () => {
      if ((window.innerHeight + window.scrollY) + 200 >= document.body.offsetHeight) {
        console.log("已经滚动到底部了!");
        this.showFooter = true
      } else {
        this.showFooter = false
      }
    }
    document.addEventListener("scrollend", this.onEvent);
  },
  unmounted() {
    document.removeEventListener('scrollend', this.onEvent)
    this.onEvent = null
  }
}
</script>

<style scoped>
.footer {
  /* 你的样式代码 */
  position: fixed;
  bottom: 0px;
  padding: 15px 0px;
  width: 100%;
  line-height: 22px;
  color: #000000;
  font-size: 14px;
  z-index: 4;
  background-color: rgba(255, 255, 255, 0.8);
  text-align: center;
}

.v-enter-active {
  animation: move 0.3s;
}

/* 离开动画 */
.v-leave-active {
  animation: move 0.3s reverse;
}

@keyframes move {
  from {
    transform: translateY(100%);
  }

  to {
    transform: translate(0);
  }
}
</style>