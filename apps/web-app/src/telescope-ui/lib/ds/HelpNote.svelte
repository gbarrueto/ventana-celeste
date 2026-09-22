<script>
  import Icon from './Icon.svelte';

  let { children, iconName = null, iconSize = 16, tone = 'sky', style = '', ...rest } = $props();

  let c = $derived(tone === 'star' ? 'var(--stella)' : 'var(--digitale)');
</script>

<p class="vc-helpnote" style="border-left-color:{c};{style}" {...rest}>
  {#if iconName}
    <span class="vc-helpnote-icon" style="color:{c}"><Icon name={iconName} size={iconSize} /></span>
  {/if}
  <span>{@render children?.()}</span>
</p>

<style>
  .vc-helpnote {
    margin: 0;
    display: flex;
    gap: var(--space-10);
    align-items: flex-start;
    border-left: 3px solid var(--digitale);
    padding-left: var(--space-12);
    font: var(--type-body-sm);
    color: var(--text-secondary);
    text-wrap: pretty;
  }
  .vc-helpnote-icon {
    flex-shrink: 0;
    margin-top: 1px;
  }
</style>
