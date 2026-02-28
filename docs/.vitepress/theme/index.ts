import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import LiveDemo from './components/LiveDemo.vue';
import BasicDemo from './components/BasicDemo.vue';
import ModesDemo from './components/ModesDemo.vue';
import ApiDemo from './components/ApiDemo.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('LiveDemo', LiveDemo);
    app.component('BasicDemo', BasicDemo);
    app.component('ModesDemo', ModesDemo);
    app.component('ApiDemo', ApiDemo);
  },
} satisfies Theme;
