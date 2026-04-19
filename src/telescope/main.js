import { mount } from 'svelte';
import Telescope from './Telescope.svelte';

const app = mount(Telescope, { target: document.getElementById('app') });

export default app;
