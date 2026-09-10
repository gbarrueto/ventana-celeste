<script module>
  const TABS = [
    { id: 'mirar', icon: 'telescope', label: 'Mirar' },
    { id: 'cielo', icon: 'sliders-horizontal', label: 'Cielo' },
    { id: 'lugar', icon: 'map-pin', label: 'Lugar y hora' },
  ];
</script>

<script>
  import Icon from './ds/Icon.svelte';

  let { tab, onTab } = $props();
</script>

<nav class="bottom-nav">
  {#each TABS as t (t.id)}
    {@const on = t.id === tab}
    <button
      type="button"
      aria-current={on ? 'page' : undefined}
      class="bottom-nav-btn"
      style="color:{on ? 'var(--digitale)' : 'var(--text-faint)'}"
      onclick={() => onTab(t.id)}
    >
      <Icon name={t.icon} size={24} />
      <span class="bottom-nav-label" style="font-weight:{on ? 700 : 500}">{t.label}</span>
    </button>
  {/each}
</nav>

<style>
  .bottom-nav {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    border-top: 1px solid var(--border-hairline);
    background: var(--surface-panel);
    flex-shrink: 0;
  }
  .bottom-nav-btn {
    display: grid;
    justify-items: center;
    gap: 4px;
    padding: 10px 4px 14px;
    min-height: 62px;
    background: none;
    border: none;
    cursor: pointer;
    transition: color var(--dur-fast) var(--ease-standard);
  }
  .bottom-nav-label {
    font-family: var(--font-display);
    font-size: var(--text-11);
    letter-spacing: var(--track-wide);
  }
</style>
