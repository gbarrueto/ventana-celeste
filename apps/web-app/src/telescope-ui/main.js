import { mount } from 'svelte';
import { initDebugLog } from '../lib/debug-log.js';
import './styles/tokens.css';
import App from './App.svelte';

initDebugLog();

const app = mount(App, { target: document.getElementById('app') });

export default app;
