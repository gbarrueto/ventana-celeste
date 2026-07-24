import { mount } from 'svelte';
import Viewer from './Viewer.svelte';

const app = mount(Viewer, { target: document.getElementById('app') });

export default app;
