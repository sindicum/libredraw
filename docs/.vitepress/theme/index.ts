import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import LiveDemo from './components/LiveDemo.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('LiveDemo', LiveDemo);
  },
} satisfies Theme;
